import postgres from "postgres";
import { randomUUID } from "crypto";
import {
  DAILY_REWARD_MAX_STREAK_DAY,
  getDailyStarReward,
  getPlacementStartingLp,
  getRankedDivision,
  RANKED_LP_BY_PLACEMENT,
  RANKED_PLACEMENT_MATCHES,
  RANKED_PLACEMENT_POINTS,
  DEFAULT_NAME_COLOR,
  DEFAULT_NAME_COLOR_ID,
  DEFAULT_AVATAR_ID,
  DEFAULT_FRAME_ID,
  CosmeticType,
  getCosmeticStarPrice,
  getNameColorCosmetic,
  isAvatarCosmeticId,
  isFrameCosmeticId,
} from "@confidence-trivia/shared";

const databaseUrl = process.env.DATABASE_URL;

// A missing database is allowed during local gameplay development. Render gets
// DATABASE_URL as a secret, never as a value committed to the repository.
const sql = databaseUrl
  ? postgres(databaseUrl, { max: 3, idle_timeout: 20 })
  : null;

export type DatabaseStatus = "connected" | "not_configured" | "unavailable";

export interface PlayerAccount {
  playerId: string;
  accountType: "guest" | "registered";
  provider: string | null;
  displayName: string;
}

export async function getDatabaseStatus(): Promise<DatabaseStatus> {
  if (!sql) return "not_configured";
  try {
    await sql`select 1`;
    return "connected";
  } catch (error) {
    console.error("Database health check failed", error);
    return "unavailable";
  }
}

export async function isRegisteredPlayer(playerId: string): Promise<boolean> {
  if (!sql) return false;
  const [player] = await sql<{ account_type: string }[]>`select account_type from public.players where id = ${playerId}`;
  return player?.account_type === "registered";
}

export async function isAuthenticatedPlayer(playerId: string, authUserId: string): Promise<boolean> {
  if (!sql) return false;
  const [player] = await sql<{ id: string }[]>`
    select id from public.players where id = ${playerId} and account_type = 'registered' and auth_user_id = ${authUserId}
  `;
  return Boolean(player);
}

export async function linkPlayerAccount(guestPlayerId: string, displayName: string, authUserId: string, provider: string): Promise<PlayerAccount | null> {
  if (!sql) return null;
  try {
    return await sql.begin(async (transaction) => {
      await transaction`
        insert into public.players (id, display_name, last_seen_at)
        values (${guestPlayerId}, ${displayName || "Guest"}, now())
        on conflict (id) do update set last_seen_at = excluded.last_seen_at
      `;
      const [existing] = await transaction<{ id: string; account_type: string; auth_provider: string | null; display_name: string }[]>`
        select id, account_type, auth_provider, display_name from public.players
        where auth_user_id = ${authUserId} for update
      `;
      if (existing) return { playerId: existing.id, accountType: "registered", provider: existing.auth_provider, displayName: existing.display_name };

      const [guest] = await transaction<{ id: string; display_name: string }[]>`
        select id, display_name from public.players where id = ${guestPlayerId} for update
      `;
      if (!guest) return null;
      const [linked] = await transaction<{ id: string; display_name: string }[]>`
        update public.players
        set account_type = 'registered', auth_user_id = ${authUserId}, auth_provider = ${provider}, linked_at = now()
        where id = ${guestPlayerId} and account_type = 'guest'
        returning id, display_name
      `;
      return linked ? { playerId: linked.id, accountType: "registered", provider, displayName: linked.display_name } : null;
    });
  } catch (error) {
    console.error("Could not link player account", error);
    return null;
  }
}

export interface CompletedMatchPlayer {
  deviceId: string;
  displayName: string;
  finalScore: number;
  finalRank: number;
}

export interface CompletedMatch {
  id: string;
  roomCode: string;
  gameMode: string;
  locale: string;
  roundCount: number;
  startedAt: Date;
  players: CompletedMatchPlayer[];
}

export interface PlayerProgressUpdate {
  stars: number;
  starsEarned: number;
  rewardedGamesToday: number;
}

export interface PlayerCustomization {
  nameColorId: string;
  nameColor: string;
  avatarId: string;
  frameId: string;
  stars: number;
  rankKey: string;
  ownedCosmeticIds: string[];
}

export async function getPlayerCustomization(deviceId: string): Promise<PlayerCustomization | null> {
  if (!sql) return { nameColorId: DEFAULT_NAME_COLOR_ID, nameColor: DEFAULT_NAME_COLOR, avatarId: DEFAULT_AVATAR_ID, frameId: DEFAULT_FRAME_ID, stars: 0, rankKey: "novice", ownedCosmeticIds: [DEFAULT_NAME_COLOR_ID, DEFAULT_AVATAR_ID] };
  try {
    const [equipped, owned, player] = await Promise.all([
      sql<{ cosmetic_id: string; cosmetic_type: string }[]>`
        select cosmetic_id, cosmetic_type from public.player_cosmetics
        where player_id = ${deviceId} and cosmetic_type in ('name_color', 'avatar', 'frame') and equipped = true
      `,
      sql<{ cosmetic_id: string }[]>`select cosmetic_id from public.player_cosmetics where player_id = ${deviceId}`,
      sql<{ stars: number; ranked_lp: number; ranked_placement_matches: number }[]>`
        select stars, ranked_lp, ranked_placement_matches from public.players where id = ${deviceId}
      `.then((rows) => rows[0]),
    ]);
    const nameColorId = equipped.find((item) => item.cosmetic_type === "name_color")?.cosmetic_id;
    const avatarId = equipped.find((item) => item.cosmetic_type === "avatar")?.cosmetic_id;
    const frameId = equipped.find((item) => item.cosmetic_type === "frame")?.cosmetic_id;
    const cosmetic = getNameColorCosmetic(nameColorId) ?? getNameColorCosmetic(DEFAULT_NAME_COLOR_ID)!;
    const ownedCosmeticIds = [...new Set([DEFAULT_NAME_COLOR_ID, DEFAULT_AVATAR_ID, DEFAULT_FRAME_ID, ...owned.map((item) => item.cosmetic_id)])];
    const rankKey = player && player.ranked_placement_matches >= RANKED_PLACEMENT_MATCHES ? getRankedDivision(player.ranked_lp).key : "novice";
    const validAvatarId = isAvatarCosmeticId(avatarId) && (avatarId !== "omniscient_avatar" || rankKey === "omniscient") ? avatarId : DEFAULT_AVATAR_ID;
    return { nameColorId: cosmetic.id, nameColor: cosmetic.color, avatarId: validAvatarId, frameId: isFrameCosmeticId(frameId) ? frameId : DEFAULT_FRAME_ID, stars: player?.stars ?? 0, rankKey, ownedCosmeticIds };
  } catch (error) {
    console.error("Could not load player customization", error);
    return null;
  }
}

export async function equipFreeNameColor(deviceId: string, cosmeticId: string, displayName: string): Promise<PlayerCustomization | null> {
  const cosmetic = getNameColorCosmetic(cosmeticId);
  return cosmetic ? acquireAndEquipCosmetic(deviceId, cosmetic.id, "name_color", displayName) : null;
}

export async function equipFreeAvatar(deviceId: string, cosmeticId: string, displayName: string): Promise<PlayerCustomization | null> {
  return isAvatarCosmeticId(cosmeticId) ? acquireAndEquipCosmetic(deviceId, cosmeticId, "avatar", displayName) : null;
}

export async function equipFreeFrame(deviceId: string, cosmeticId: string, displayName: string): Promise<PlayerCustomization | null> {
  return isFrameCosmeticId(cosmeticId) ? acquireAndEquipCosmetic(deviceId, cosmeticId, "frame", displayName) : null;
}

async function acquireAndEquipCosmetic(deviceId: string, cosmeticId: string, cosmeticType: CosmeticType, displayName: string): Promise<PlayerCustomization | null> {
  if (!sql) return null;
  const price = getCosmeticStarPrice(cosmeticType, cosmeticId);
  if (price === undefined) return null;
  try {
    await sql.begin(async (transaction) => {
      await transaction`
        insert into public.players (id, display_name, last_seen_at)
        values (${deviceId}, ${displayName || "Player"}, now())
        on conflict (id) do update set display_name = excluded.display_name, last_seen_at = excluded.last_seen_at
      `;
      const [player] = await transaction<{ stars: number; ranked_lp: number; ranked_placement_matches: number }[]>`
        select stars, ranked_lp, ranked_placement_matches from public.players where id = ${deviceId} for update
      `;
      const [owned] = await transaction<{ cosmetic_id: string }[]>`
        select cosmetic_id from public.player_cosmetics where player_id = ${deviceId} and cosmetic_id = ${cosmeticId}
      `;
      if (cosmeticId === "omniscient_avatar") {
        const isOmniscient = player.ranked_placement_matches >= RANKED_PLACEMENT_MATCHES && getRankedDivision(player.ranked_lp).key === "omniscient";
        if (!isOmniscient) throw new Error("omniscient_rank_required");
      }
      if (!owned) {
        if (cosmeticId !== "omniscient_avatar") {
          if (price === null || player.stars < price) throw new Error("insufficient_stars");
          if (price > 0) {
            await transaction`update public.players set stars = stars - ${price} where id = ${deviceId}`;
            await transaction`
              insert into public.star_transactions (id, player_id, amount, reason)
              values (${randomUUID()}, ${deviceId}, ${-price}, ${`cosmetic_purchase:${cosmeticType}:${cosmeticId}`})
            `;
          }
        }
      }
      await transaction`
        update public.player_cosmetics set equipped = false, equipped_at = null
        where player_id = ${deviceId} and cosmetic_type = ${cosmeticType} and equipped = true
      `;
      await transaction`
        insert into public.player_cosmetics (player_id, cosmetic_id, cosmetic_type, equipped, equipped_at)
        values (${deviceId}, ${cosmeticId}, ${cosmeticType}, true, now())
        on conflict (player_id, cosmetic_id) do update set equipped = true, equipped_at = now()
      `;
    });
    return await getPlayerCustomization(deviceId);
  } catch (error) {
    console.error("Could not acquire or equip cosmetic", error);
    return null;
  }
}

export interface DamageWagerReservation {
  ok: boolean;
  balances: Map<string, number>;
  insufficientPlayerIds: string[];
}

export async function reserveDamageWager(matchId: string, playerIds: string[], stake: number): Promise<DamageWagerReservation> {
  const failed = { ok: false, balances: new Map<string, number>(), insufficientPlayerIds: playerIds };
  if (!sql || playerIds.length !== 2) return failed;
  try {
    return await sql.begin(async (transaction) => {
      const players = await transaction<{ id: string; stars: number }[]>`
        select id, stars from public.players
        where id in ${transaction(playerIds)}
        order by id
        for update
      `;
      const insufficientPlayerIds = players.filter((player) => player.stars < stake).map((player) => player.id);
      if (players.length !== 2 || insufficientPlayerIds.length > 0) {
        return { ok: false, balances: new Map(players.map((player) => [player.id, player.stars])), insufficientPlayerIds };
      }
      await transaction`
        insert into public.damage_wagers (match_id, player_one_id, player_two_id, stake)
        values (${matchId}, ${playerIds[0]}, ${playerIds[1]}, ${stake})
      `;
      for (const player of players) {
        await transaction`update public.players set stars = stars - ${stake} where id = ${player.id}`;
        await transaction`
          insert into public.star_transactions (id, player_id, amount, reason, source_wager_id)
          values (${randomUUID()}, ${player.id}, ${-stake}, 'damage_wager_stake', ${matchId})
        `;
      }
      return { ok: true, balances: new Map(players.map((player) => [player.id, player.stars - stake])), insufficientPlayerIds: [] };
    });
  } catch (error) {
    console.error("Could not reserve Damage wager", error);
    return failed;
  }
}

export async function settleDamageWager(matchId: string, winnerId: string | null): Promise<Map<string, number>> {
  const balances = new Map<string, number>();
  if (!sql) return balances;
  try {
    await sql.begin(async (transaction) => {
      const [wager] = await transaction<{ player_one_id: string; player_two_id: string; stake: number; status: string }[]>`
        select player_one_id, player_two_id, stake, status
        from public.damage_wagers where match_id = ${matchId} for update
      `;
      if (!wager || wager.status !== 'active') return;
      const playerIds = [wager.player_one_id, wager.player_two_id];
      const validWinner = winnerId && playerIds.includes(winnerId) ? winnerId : null;
      const recipients = validWinner ? [{ id: validWinner, amount: wager.stake * 2, reason: 'damage_wager_payout' }] : playerIds.map((id) => ({ id, amount: wager.stake, reason: 'damage_wager_refund' }));
      for (const recipient of recipients) {
        await transaction`update public.players set stars = stars + ${recipient.amount} where id = ${recipient.id}`;
        await transaction`
          insert into public.star_transactions (id, player_id, amount, reason, source_wager_id)
          values (${randomUUID()}, ${recipient.id}, ${recipient.amount}, ${recipient.reason}, ${matchId})
        `;
      }
      await transaction`
        update public.damage_wagers
        set status = ${validWinner ? 'paid' : 'refunded'}, winner_id = ${validWinner}, settled_at = now()
        where match_id = ${matchId}
      `;
      const updated = await transaction<{ id: string; stars: number }[]>`select id, stars from public.players where id in ${transaction(playerIds)}`;
      updated.forEach((player) => balances.set(player.id, player.stars));
    });
  } catch (error) {
    console.error("Could not settle Damage wager", error);
  }
  return balances;
}

export interface DailyRewardStatus {
  stars: number;
  available: boolean;
  amount: number;
  streakDay: number;
  nextClaimAt: string;
}

export interface RankedLeaderboardEntry {
  playerId: string;
  displayName: string;
  lp: number;
  rankKey: string;
  wins: number;
  position: number | null;
  placementMatches: number;
}

export interface RankedLeaderboardResponse {
  top: RankedLeaderboardEntry[];
  currentPlayer: RankedLeaderboardEntry | null;
}

export async function getRankedLeaderboard(deviceId: string): Promise<RankedLeaderboardResponse | null> {
  if (!sql) return null;

  try {
    const rows = await sql<{
      id: string;
      display_name: string;
      ranked_lp: number;
      wins: number;
      ranked_placement_matches: number;
      position: number;
    }[]>`
      select id, display_name, ranked_lp, wins, ranked_placement_matches, position::int
      from (
        select id, display_name, ranked_lp, wins, ranked_placement_matches,
          row_number() over (order by ranked_lp desc, wins desc, created_at asc) as position
        from public.players
        where ranked_placement_matches >= ${RANKED_PLACEMENT_MATCHES}
      ) ranked
      order by position
      limit 10
    `;

    const top = rows.map((player) => ({
      playerId: player.id,
      displayName: player.display_name,
      lp: player.ranked_lp,
      rankKey: getRankedDivision(player.ranked_lp).key,
      wins: player.wins,
      position: player.position,
      placementMatches: player.ranked_placement_matches,
    }));

    const [current] = await sql<{
      id: string;
      display_name: string;
      ranked_lp: number;
      wins: number;
      ranked_placement_matches: number;
      position: number | null;
    }[]>`
      select p.id, p.display_name, p.ranked_lp, p.wins, p.ranked_placement_matches,
        case when p.ranked_placement_matches >= ${RANKED_PLACEMENT_MATCHES} then (
          select count(*)::int + 1
          from public.players ahead
          where ahead.ranked_placement_matches >= ${RANKED_PLACEMENT_MATCHES}
            and (
              ahead.ranked_lp > p.ranked_lp
              or (ahead.ranked_lp = p.ranked_lp and ahead.wins > p.wins)
              or (ahead.ranked_lp = p.ranked_lp and ahead.wins = p.wins and ahead.created_at < p.created_at)
            )
        )
        end as position
      from public.players p
      where p.id = ${deviceId}
    `;

    const currentPlayer = current ? {
      playerId: current.id,
      displayName: current.display_name,
      lp: current.ranked_lp,
      rankKey: current.ranked_placement_matches < RANKED_PLACEMENT_MATCHES
        ? "novice"
        : getRankedDivision(current.ranked_lp).key,
      wins: current.wins,
      position: current.position,
      placementMatches: current.ranked_placement_matches,
    } : null;

    return { top, currentPlayer };
  } catch (error) {
    console.error("Could not load ranked leaderboard", error);
    return null;
  }
}

function nextUtcDayIso(): string {
  const next = new Date();
  next.setUTCHours(24, 0, 0, 0);
  return next.toISOString();
}

export async function upsertPlayer(deviceId: string, displayName: string): Promise<number | null> {
  if (!sql) return null;

  try {
    const [player] = await sql<{ stars: number }[]>`
      insert into public.players (id, display_name, last_seen_at)
      values (${deviceId}, ${displayName}, now())
      on conflict (id) do update
      set display_name = excluded.display_name,
          last_seen_at = excluded.last_seen_at
      returning stars
    `;
    return player?.stars ?? 0;
  } catch (error) {
    // Persistence must never prevent a player from joining a live game.
    console.error("Could not persist player profile", error);
    return null;
  }
}

export async function getPlayerStars(deviceId: string): Promise<number | null> {
  if (!sql) return null;

  try {
    const [player] = await sql<{ stars: number }[]>`
      select stars
      from public.players
      where id = ${deviceId}
    `;
    return player?.stars ?? 0;
  } catch (error) {
    console.error("Could not load player stars", error);
    return null;
  }
}

export async function getDailyRewardStatus(deviceId: string): Promise<DailyRewardStatus | null> {
  if (!sql) return null;

  try {
    const [player] = await sql<{
      stars: number;
      claimed_today: boolean;
      claimed_yesterday: boolean;
      last_streak_day: number | null;
      last_amount: number | null;
    }[]>`
      select p.stars,
        coalesce(last_claim.reward_day = (now() at time zone 'UTC')::date, false) as claimed_today,
        coalesce(last_claim.reward_day = (now() at time zone 'UTC')::date - 1, false) as claimed_yesterday,
        last_claim.reward_streak_day as last_streak_day,
        last_claim.amount as last_amount
      from public.players p
      left join lateral (
        select reward_day, reward_streak_day, amount
        from public.star_transactions
        where player_id = p.id and reason = 'daily_claim'
        order by reward_day desc
        limit 1
      ) last_claim on true
      where p.id = ${deviceId}
    `;
    const lastStreakDay = player?.last_streak_day ?? 1;
    const streakDay = player?.claimed_today
      ? lastStreakDay
      : player?.claimed_yesterday
        ? Math.min(DAILY_REWARD_MAX_STREAK_DAY, lastStreakDay + 1)
        : 1;
    return {
      stars: player?.stars ?? 0,
      available: !player?.claimed_today,
      amount: player?.claimed_today ? (player.last_amount ?? getDailyStarReward(streakDay)) : getDailyStarReward(streakDay),
      streakDay,
      nextClaimAt: nextUtcDayIso(),
    };
  } catch (error) {
    console.error("Could not load daily reward status", error);
    return null;
  }
}

export async function claimDailyReward(deviceId: string, displayName: string): Promise<DailyRewardStatus | null> {
  if (!sql) return null;

  try {
    return await sql.begin(async (transaction) => {
      await transaction`
        insert into public.players (id, display_name, last_seen_at)
        values (${deviceId}, ${displayName || "Player"}, now())
        on conflict (id) do update set last_seen_at = excluded.last_seen_at
      `;
      await transaction`select id from public.players where id = ${deviceId} for update`;

      const [lastClaim] = await transaction<{
        claimed_today: boolean;
        claimed_yesterday: boolean;
        streak_day: number;
        amount: number;
      }[]>`
        select
          reward_day = (now() at time zone 'UTC')::date as claimed_today,
          reward_day = (now() at time zone 'UTC')::date - 1 as claimed_yesterday,
          coalesce(reward_streak_day, 1)::int as streak_day,
          amount
        from public.star_transactions
        where player_id = ${deviceId} and reason = 'daily_claim'
        order by reward_day desc
        limit 1
      `;

      if (lastClaim?.claimed_today) {
        const [player] = await transaction<{ stars: number }[]>`
          select stars from public.players where id = ${deviceId}
        `;
        return {
          stars: player?.stars ?? 0,
          available: false,
          amount: lastClaim.amount,
          streakDay: lastClaim.streak_day,
          nextClaimAt: nextUtcDayIso(),
        };
      }

      const streakDay = lastClaim?.claimed_yesterday
        ? Math.min(DAILY_REWARD_MAX_STREAK_DAY, lastClaim.streak_day + 1)
        : 1;
      const rewardAmount = getDailyStarReward(streakDay);

      const inserted = await transaction<{ id: string }[]>`
        insert into public.star_transactions (
          id, player_id, amount, reason, reward_day, reward_streak_day
        ) values (
          ${randomUUID()}, ${deviceId}, ${rewardAmount}, 'daily_claim',
          (now() at time zone 'UTC')::date, ${streakDay}
        )
        on conflict do nothing
        returning id
      `;

      if (inserted.length > 0) {
        await transaction`
          update public.players set stars = stars + ${rewardAmount} where id = ${deviceId}
        `;
      }

      const [player] = await transaction<{ stars: number }[]>`
        select stars from public.players where id = ${deviceId}
      `;
      return {
        stars: player?.stars ?? 0,
        available: false,
        amount: rewardAmount,
        streakDay,
        nextClaimAt: nextUtcDayIso(),
      };
    });
  } catch (error) {
    console.error("Could not claim daily reward", error);
    return null;
  }
}

export async function saveCompletedMatch(match: CompletedMatch): Promise<Map<string, PlayerProgressUpdate>> {
  const progressUpdates = new Map<string, PlayerProgressUpdate>();
  if (!sql || match.players.length === 0) return progressUpdates;

  try {
    await sql.begin(async (transaction) => {
      const insertedMatches = await transaction<{ id: string }[]>`
        insert into public.matches (
          id, room_code, game_mode, locale, round_count, started_at
        ) values (
          ${match.id}, ${match.roomCode}, ${match.gameMode}, ${match.locale},
          ${match.roundCount}, ${match.startedAt}
        )
        on conflict (id) do nothing
        returning id
      `;

      // Makes retries safe if the same room attempts to persist twice.
      if (insertedMatches.length === 0) return;

      for (const player of match.players) {
        await transaction`
          insert into public.players (id, display_name, last_seen_at)
          values (${player.deviceId}, ${player.displayName}, now())
          on conflict (id) do update
          set display_name = excluded.display_name,
              last_seen_at = excluded.last_seen_at
        `;

        await transaction`
          insert into public.match_players (
            match_id, player_id, display_name, final_score, final_rank
          ) values (
            ${match.id}, ${player.deviceId}, ${player.displayName},
            ${player.finalScore}, ${player.finalRank}
          )
        `;

        await transaction`
          update public.players
          set games_played = games_played + 1,
              wins = wins + ${player.finalRank === 1 ? 1 : 0}
          where id = ${player.deviceId}
        `;

        // Serialize currency decisions per player so two matches finishing at
        // the same time cannot both claim the fifth daily reward slot.
        await transaction`
          select id from public.players where id = ${player.deviceId} for update
        `;

        if (match.gameMode === "ranked") {
          const [rankedPlayer] = await transaction<{
            ranked_lp: number;
            ranked_placement_matches: number;
            ranked_placement_points: number;
          }[]>`
            select ranked_lp, ranked_placement_matches, ranked_placement_points
            from public.players
            where id = ${player.deviceId}
          `;

          if (rankedPlayer) {
            const placement = Math.min(4, Math.max(1, player.finalRank));
            const isPlacementMatch = rankedPlayer.ranked_placement_matches < RANKED_PLACEMENT_MATCHES;
            const placementPointsAwarded = isPlacementMatch ? (RANKED_PLACEMENT_POINTS[placement] ?? 0) : 0;
            const placementMatchesAfter = isPlacementMatch
              ? rankedPlayer.ranked_placement_matches + 1
              : rankedPlayer.ranked_placement_matches;
            const placementPointsAfter = isPlacementMatch
              ? rankedPlayer.ranked_placement_points + placementPointsAwarded
              : rankedPlayer.ranked_placement_points;
            const lpAfter = isPlacementMatch
              ? placementMatchesAfter === RANKED_PLACEMENT_MATCHES
                ? getPlacementStartingLp(placementPointsAfter)
                : rankedPlayer.ranked_lp
              : Math.max(0, rankedPlayer.ranked_lp + (RANKED_LP_BY_PLACEMENT[placement] ?? 0));
            const lpDelta = lpAfter - rankedPlayer.ranked_lp;

            await transaction`
              insert into public.ranked_match_results (
                match_id, player_id, placement, was_placement_match,
                placement_points_awarded, lp_before, lp_delta, lp_after
              ) values (
                ${match.id}, ${player.deviceId}, ${placement}, ${isPlacementMatch},
                ${placementPointsAwarded}, ${rankedPlayer.ranked_lp}, ${lpDelta}, ${lpAfter}
              )
            `;

            await transaction`
              update public.players
              set ranked_lp = ${lpAfter},
                  ranked_placement_matches = ${placementMatchesAfter},
                  ranked_placement_points = ${placementPointsAfter}
              where id = ${player.deviceId}
            `;
          }
        }

        const [dailyCount] = await transaction<{ count: number }[]>`
          select count(*)::int as count
          from public.star_transactions
          where player_id = ${player.deviceId}
            and reason = 'game_completion'
            and created_at >= (date_trunc('day', now() at time zone 'UTC') at time zone 'UTC')
            and created_at < (date_trunc('day', now() at time zone 'UTC') at time zone 'UTC') + interval '1 day'
        `;

        let starsEarned = 0;
        let rewardedGamesToday = dailyCount?.count ?? 0;
        if (rewardedGamesToday < 5) {
          const insertedRewards = await transaction<{ id: string }[]>`
            insert into public.star_transactions (
              id, player_id, amount, reason, source_match_id
            ) values (
              ${randomUUID()}, ${player.deviceId}, 10, 'game_completion', ${match.id}
            )
            on conflict (player_id, reason, source_match_id) do nothing
            returning id
          `;
          if (insertedRewards.length > 0) {
            starsEarned = 10;
            rewardedGamesToday += 1;
            await transaction`
              update public.players set stars = stars + 10 where id = ${player.deviceId}
            `;
          }
        }

        const [updatedPlayer] = await transaction<{ stars: number }[]>`
          select stars from public.players where id = ${player.deviceId}
        `;
        if (updatedPlayer) {
          progressUpdates.set(player.deviceId, {
            stars: updatedPlayer.stars,
            starsEarned,
            rewardedGamesToday,
          });
        }
      }
    });
  } catch (error) {
    // Final results remain valid in-room even when persistence is unavailable.
    console.error("Could not persist completed match", error);
  }

  return progressUpdates;
}
