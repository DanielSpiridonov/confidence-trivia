"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAccountProfile = getAccountProfile;
exports.updateAccountDisplayName = updateAccountDisplayName;
exports.getDatabaseStatus = getDatabaseStatus;
exports.isRegisteredPlayer = isRegisteredPlayer;
exports.isAuthenticatedPlayer = isAuthenticatedPlayer;
exports.linkPlayerAccount = linkPlayerAccount;
exports.getPlayerCustomization = getPlayerCustomization;
exports.equipFreeNameColor = equipFreeNameColor;
exports.equipFreeAvatar = equipFreeAvatar;
exports.equipFreeFrame = equipFreeFrame;
exports.reserveDamageWager = reserveDamageWager;
exports.settleDamageWager = settleDamageWager;
exports.getRankedLeaderboard = getRankedLeaderboard;
exports.upsertPlayer = upsertPlayer;
exports.getPlayerStars = getPlayerStars;
exports.getDailyRewardStatus = getDailyRewardStatus;
exports.claimDailyReward = claimDailyReward;
exports.saveCompletedMatch = saveCompletedMatch;
const postgres_1 = __importDefault(require("postgres"));
const crypto_1 = require("crypto");
const shared_1 = require("@confidence-trivia/shared");
const databaseUrl = process.env.DATABASE_URL;
// A missing database is allowed during local gameplay development. Render gets
// DATABASE_URL as a secret, never as a value committed to the repository.
const sql = databaseUrl
    ? (0, postgres_1.default)(databaseUrl, { max: 3, idle_timeout: 20 })
    : null;
async function getAccountProfile(playerId, authUserId) {
    if (!sql)
        return null;
    const [player] = await sql `
    select id, display_name, auth_provider, stars, games_played, wins, ranked_lp, ranked_placement_matches
    from public.players where id = ${playerId} and auth_user_id = ${authUserId} and account_type = 'registered'
  `;
    if (!player)
        return null;
    return { playerId: player.id, accountType: "registered", provider: player.auth_provider, displayName: player.display_name, stars: player.stars, gamesPlayed: player.games_played, wins: player.wins, rankedLp: player.ranked_lp, rankKey: player.ranked_placement_matches < shared_1.RANKED_PLACEMENT_MATCHES ? "novice" : (0, shared_1.getRankedDivision)(player.ranked_lp).key };
}
async function updateAccountDisplayName(playerId, authUserId, displayName) {
    if (!sql)
        return null;
    const normalized = displayName.toLocaleLowerCase("en-US");
    try {
        const [updated] = await sql `
      update public.players set display_name = ${displayName}, normalized_display_name = ${normalized}, last_seen_at = now()
      where id = ${playerId} and auth_user_id = ${authUserId} and account_type = 'registered' returning id
    `;
        return updated ? getAccountProfile(playerId, authUserId) : null;
    }
    catch (error) {
        if (typeof error === "object" && error && "code" in error && error.code === "23505")
            return "taken";
        console.error("Could not update account display name", error);
        return null;
    }
}
async function getDatabaseStatus() {
    if (!sql)
        return "not_configured";
    try {
        await sql `select 1`;
        return "connected";
    }
    catch (error) {
        console.error("Database health check failed", error);
        return "unavailable";
    }
}
async function isRegisteredPlayer(playerId) {
    if (!sql)
        return false;
    const [player] = await sql `select account_type from public.players where id = ${playerId}`;
    return player?.account_type === "registered";
}
async function isAuthenticatedPlayer(playerId, authUserId) {
    if (!sql)
        return false;
    const [player] = await sql `
    select id from public.players where id = ${playerId} and account_type = 'registered' and auth_user_id = ${authUserId}
  `;
    return Boolean(player);
}
async function linkPlayerAccount(guestPlayerId, displayName, authUserId, provider) {
    if (!sql)
        return null;
    try {
        return await sql.begin(async (transaction) => {
            await transaction `
        insert into public.players (id, display_name, last_seen_at)
        values (${guestPlayerId}, ${displayName || "Guest"}, now())
        on conflict (id) do update set last_seen_at = excluded.last_seen_at
      `;
            const [existing] = await transaction `
        select id, account_type, auth_provider, display_name from public.players
        where auth_user_id = ${authUserId} for update
      `;
            if (existing)
                return { playerId: existing.id, accountType: "registered", provider: existing.auth_provider, displayName: existing.display_name };
            const [guest] = await transaction `
        select id, display_name from public.players where id = ${guestPlayerId} for update
      `;
            if (!guest)
                return null;
            const [linked] = await transaction `
        update public.players
        set account_type = 'registered', auth_user_id = ${authUserId}, auth_provider = ${provider}, linked_at = now()
        where id = ${guestPlayerId} and account_type = 'guest'
        returning id, display_name
      `;
            return linked ? { playerId: linked.id, accountType: "registered", provider, displayName: linked.display_name } : null;
        });
    }
    catch (error) {
        console.error("Could not link player account", error);
        return null;
    }
}
async function getPlayerCustomization(deviceId) {
    if (!sql)
        return { nameColorId: shared_1.DEFAULT_NAME_COLOR_ID, nameColor: shared_1.DEFAULT_NAME_COLOR, avatarId: shared_1.DEFAULT_AVATAR_ID, frameId: shared_1.DEFAULT_FRAME_ID, stars: 0, rankKey: "novice", ownedCosmeticIds: [shared_1.DEFAULT_NAME_COLOR_ID, shared_1.DEFAULT_AVATAR_ID] };
    try {
        const [equipped, owned, player] = await Promise.all([
            sql `
        select cosmetic_id, cosmetic_type from public.player_cosmetics
        where player_id = ${deviceId} and cosmetic_type in ('name_color', 'avatar', 'frame') and equipped = true
      `,
            sql `select cosmetic_id from public.player_cosmetics where player_id = ${deviceId}`,
            sql `
        select stars, ranked_lp, ranked_placement_matches from public.players where id = ${deviceId}
      `.then((rows) => rows[0]),
        ]);
        const nameColorId = equipped.find((item) => item.cosmetic_type === "name_color")?.cosmetic_id;
        const avatarId = equipped.find((item) => item.cosmetic_type === "avatar")?.cosmetic_id;
        const frameId = equipped.find((item) => item.cosmetic_type === "frame")?.cosmetic_id;
        const cosmetic = (0, shared_1.getNameColorCosmetic)(nameColorId) ?? (0, shared_1.getNameColorCosmetic)(shared_1.DEFAULT_NAME_COLOR_ID);
        const ownedCosmeticIds = [...new Set([shared_1.DEFAULT_NAME_COLOR_ID, shared_1.DEFAULT_AVATAR_ID, shared_1.DEFAULT_FRAME_ID, ...owned.map((item) => item.cosmetic_id)])];
        const rankKey = player && player.ranked_placement_matches >= shared_1.RANKED_PLACEMENT_MATCHES ? (0, shared_1.getRankedDivision)(player.ranked_lp).key : "novice";
        const validAvatarId = (0, shared_1.isAvatarCosmeticId)(avatarId) && (avatarId !== "omniscient_avatar" || rankKey === "omniscient") ? avatarId : shared_1.DEFAULT_AVATAR_ID;
        return { nameColorId: cosmetic.id, nameColor: cosmetic.color, avatarId: validAvatarId, frameId: (0, shared_1.isFrameCosmeticId)(frameId) ? frameId : shared_1.DEFAULT_FRAME_ID, stars: player?.stars ?? 0, rankKey, ownedCosmeticIds };
    }
    catch (error) {
        console.error("Could not load player customization", error);
        return null;
    }
}
async function equipFreeNameColor(deviceId, cosmeticId, displayName) {
    const cosmetic = (0, shared_1.getNameColorCosmetic)(cosmeticId);
    return cosmetic ? acquireAndEquipCosmetic(deviceId, cosmetic.id, "name_color", displayName) : null;
}
async function equipFreeAvatar(deviceId, cosmeticId, displayName) {
    return (0, shared_1.isAvatarCosmeticId)(cosmeticId) ? acquireAndEquipCosmetic(deviceId, cosmeticId, "avatar", displayName) : null;
}
async function equipFreeFrame(deviceId, cosmeticId, displayName) {
    return (0, shared_1.isFrameCosmeticId)(cosmeticId) ? acquireAndEquipCosmetic(deviceId, cosmeticId, "frame", displayName) : null;
}
async function acquireAndEquipCosmetic(deviceId, cosmeticId, cosmeticType, displayName) {
    if (!sql)
        return null;
    const price = (0, shared_1.getCosmeticStarPrice)(cosmeticType, cosmeticId);
    if (price === undefined)
        return null;
    try {
        await sql.begin(async (transaction) => {
            await transaction `
        insert into public.players (id, display_name, last_seen_at)
        values (${deviceId}, ${displayName || "Player"}, now())
        on conflict (id) do update set display_name = excluded.display_name, last_seen_at = excluded.last_seen_at
      `;
            const [player] = await transaction `
        select stars, ranked_lp, ranked_placement_matches from public.players where id = ${deviceId} for update
      `;
            const [owned] = await transaction `
        select cosmetic_id from public.player_cosmetics where player_id = ${deviceId} and cosmetic_id = ${cosmeticId}
      `;
            if (cosmeticId === "omniscient_avatar") {
                const isOmniscient = player.ranked_placement_matches >= shared_1.RANKED_PLACEMENT_MATCHES && (0, shared_1.getRankedDivision)(player.ranked_lp).key === "omniscient";
                if (!isOmniscient)
                    throw new Error("omniscient_rank_required");
            }
            if (!owned) {
                if (cosmeticId !== "omniscient_avatar") {
                    if (price === null || player.stars < price)
                        throw new Error("insufficient_stars");
                    if (price > 0) {
                        await transaction `update public.players set stars = stars - ${price} where id = ${deviceId}`;
                        await transaction `
              insert into public.star_transactions (id, player_id, amount, reason)
              values (${(0, crypto_1.randomUUID)()}, ${deviceId}, ${-price}, ${`cosmetic_purchase:${cosmeticType}:${cosmeticId}`})
            `;
                    }
                }
            }
            await transaction `
        update public.player_cosmetics set equipped = false, equipped_at = null
        where player_id = ${deviceId} and cosmetic_type = ${cosmeticType} and equipped = true
      `;
            await transaction `
        insert into public.player_cosmetics (player_id, cosmetic_id, cosmetic_type, equipped, equipped_at)
        values (${deviceId}, ${cosmeticId}, ${cosmeticType}, true, now())
        on conflict (player_id, cosmetic_id) do update set equipped = true, equipped_at = now()
      `;
        });
        return await getPlayerCustomization(deviceId);
    }
    catch (error) {
        console.error("Could not acquire or equip cosmetic", error);
        return null;
    }
}
async function reserveDamageWager(matchId, playerIds, stake) {
    const failed = { ok: false, balances: new Map(), insufficientPlayerIds: playerIds };
    if (!sql || playerIds.length !== 2)
        return failed;
    try {
        return await sql.begin(async (transaction) => {
            const players = await transaction `
        select id, stars from public.players
        where id in ${transaction(playerIds)}
        order by id
        for update
      `;
            const insufficientPlayerIds = players.filter((player) => player.stars < stake).map((player) => player.id);
            if (players.length !== 2 || insufficientPlayerIds.length > 0) {
                return { ok: false, balances: new Map(players.map((player) => [player.id, player.stars])), insufficientPlayerIds };
            }
            await transaction `
        insert into public.damage_wagers (match_id, player_one_id, player_two_id, stake)
        values (${matchId}, ${playerIds[0]}, ${playerIds[1]}, ${stake})
      `;
            for (const player of players) {
                await transaction `update public.players set stars = stars - ${stake} where id = ${player.id}`;
                await transaction `
          insert into public.star_transactions (id, player_id, amount, reason, source_wager_id)
          values (${(0, crypto_1.randomUUID)()}, ${player.id}, ${-stake}, 'damage_wager_stake', ${matchId})
        `;
            }
            return { ok: true, balances: new Map(players.map((player) => [player.id, player.stars - stake])), insufficientPlayerIds: [] };
        });
    }
    catch (error) {
        console.error("Could not reserve Damage wager", error);
        return failed;
    }
}
async function settleDamageWager(matchId, winnerId) {
    const balances = new Map();
    if (!sql)
        return balances;
    try {
        await sql.begin(async (transaction) => {
            const [wager] = await transaction `
        select player_one_id, player_two_id, stake, status
        from public.damage_wagers where match_id = ${matchId} for update
      `;
            if (!wager || wager.status !== 'active')
                return;
            const playerIds = [wager.player_one_id, wager.player_two_id];
            const validWinner = winnerId && playerIds.includes(winnerId) ? winnerId : null;
            const recipients = validWinner ? [{ id: validWinner, amount: wager.stake * 2, reason: 'damage_wager_payout' }] : playerIds.map((id) => ({ id, amount: wager.stake, reason: 'damage_wager_refund' }));
            for (const recipient of recipients) {
                await transaction `update public.players set stars = stars + ${recipient.amount} where id = ${recipient.id}`;
                await transaction `
          insert into public.star_transactions (id, player_id, amount, reason, source_wager_id)
          values (${(0, crypto_1.randomUUID)()}, ${recipient.id}, ${recipient.amount}, ${recipient.reason}, ${matchId})
        `;
            }
            await transaction `
        update public.damage_wagers
        set status = ${validWinner ? 'paid' : 'refunded'}, winner_id = ${validWinner}, settled_at = now()
        where match_id = ${matchId}
      `;
            const updated = await transaction `select id, stars from public.players where id in ${transaction(playerIds)}`;
            updated.forEach((player) => balances.set(player.id, player.stars));
        });
    }
    catch (error) {
        console.error("Could not settle Damage wager", error);
    }
    return balances;
}
async function getRankedLeaderboard(deviceId) {
    if (!sql)
        return null;
    try {
        const rows = await sql `
      select id, display_name, ranked_lp, ranked_wins, ranked_placement_matches, position::int
      from (
        select id, display_name, ranked_lp, ranked_wins, ranked_placement_matches,
          row_number() over (order by ranked_lp desc, ranked_wins desc, created_at asc) as position
        from public.players
        where ranked_placement_matches >= ${shared_1.RANKED_PLACEMENT_MATCHES}
      ) ranked
      order by position
      limit 10
    `;
        const top = rows.map((player) => ({
            playerId: player.id,
            displayName: player.display_name,
            lp: player.ranked_lp,
            rankKey: (0, shared_1.getRankedDivision)(player.ranked_lp).key,
            wins: player.ranked_wins,
            position: player.position,
            placementMatches: player.ranked_placement_matches,
        }));
        const [current] = await sql `
      select p.id, p.display_name, p.ranked_lp, p.ranked_wins, p.ranked_placement_matches,
        case when p.ranked_placement_matches >= ${shared_1.RANKED_PLACEMENT_MATCHES} then (
          select count(*)::int + 1
          from public.players ahead
          where ahead.ranked_placement_matches >= ${shared_1.RANKED_PLACEMENT_MATCHES}
            and (
              ahead.ranked_lp > p.ranked_lp
              or (ahead.ranked_lp = p.ranked_lp and ahead.ranked_wins > p.ranked_wins)
              or (ahead.ranked_lp = p.ranked_lp and ahead.ranked_wins = p.ranked_wins and ahead.created_at < p.created_at)
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
            rankKey: current.ranked_placement_matches < shared_1.RANKED_PLACEMENT_MATCHES
                ? "novice"
                : (0, shared_1.getRankedDivision)(current.ranked_lp).key,
            wins: current.ranked_wins,
            position: current.position,
            placementMatches: current.ranked_placement_matches,
        } : null;
        return { top, currentPlayer };
    }
    catch (error) {
        console.error("Could not load ranked leaderboard", error);
        return null;
    }
}
function nextUtcDayIso() {
    const next = new Date();
    next.setUTCHours(24, 0, 0, 0);
    return next.toISOString();
}
async function upsertPlayer(deviceId, displayName) {
    if (!sql)
        return null;
    try {
        const [player] = await sql `
      insert into public.players (id, display_name, last_seen_at)
      values (${deviceId}, ${displayName}, now())
      on conflict (id) do update
      set display_name = excluded.display_name,
          last_seen_at = excluded.last_seen_at
      returning stars
    `;
        return player?.stars ?? 0;
    }
    catch (error) {
        // Persistence must never prevent a player from joining a live game.
        console.error("Could not persist player profile", error);
        return null;
    }
}
async function getPlayerStars(deviceId) {
    if (!sql)
        return null;
    try {
        const [player] = await sql `
      select stars
      from public.players
      where id = ${deviceId}
    `;
        return player?.stars ?? 0;
    }
    catch (error) {
        console.error("Could not load player stars", error);
        return null;
    }
}
async function getDailyRewardStatus(deviceId) {
    if (!sql)
        return null;
    try {
        const [player] = await sql `
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
                ? Math.min(shared_1.DAILY_REWARD_MAX_STREAK_DAY, lastStreakDay + 1)
                : 1;
        return {
            stars: player?.stars ?? 0,
            available: !player?.claimed_today,
            amount: player?.claimed_today ? (player.last_amount ?? (0, shared_1.getDailyStarReward)(streakDay)) : (0, shared_1.getDailyStarReward)(streakDay),
            streakDay,
            nextClaimAt: nextUtcDayIso(),
        };
    }
    catch (error) {
        console.error("Could not load daily reward status", error);
        return null;
    }
}
async function claimDailyReward(deviceId, displayName) {
    if (!sql)
        return null;
    try {
        return await sql.begin(async (transaction) => {
            await transaction `
        insert into public.players (id, display_name, last_seen_at)
        values (${deviceId}, ${displayName || "Player"}, now())
        on conflict (id) do update set last_seen_at = excluded.last_seen_at
      `;
            await transaction `select id from public.players where id = ${deviceId} for update`;
            const [lastClaim] = await transaction `
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
                const [player] = await transaction `
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
                ? Math.min(shared_1.DAILY_REWARD_MAX_STREAK_DAY, lastClaim.streak_day + 1)
                : 1;
            const rewardAmount = (0, shared_1.getDailyStarReward)(streakDay);
            const inserted = await transaction `
        insert into public.star_transactions (
          id, player_id, amount, reason, reward_day, reward_streak_day
        ) values (
          ${(0, crypto_1.randomUUID)()}, ${deviceId}, ${rewardAmount}, 'daily_claim',
          (now() at time zone 'UTC')::date, ${streakDay}
        )
        on conflict do nothing
        returning id
      `;
            if (inserted.length > 0) {
                await transaction `
          update public.players set stars = stars + ${rewardAmount} where id = ${deviceId}
        `;
            }
            const [player] = await transaction `
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
    }
    catch (error) {
        console.error("Could not claim daily reward", error);
        return null;
    }
}
async function saveCompletedMatch(match) {
    const progressUpdates = new Map();
    if (!sql || match.players.length === 0)
        return progressUpdates;
    try {
        await sql.begin(async (transaction) => {
            const insertedMatches = await transaction `
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
            if (insertedMatches.length === 0)
                return;
            for (const player of match.players) {
                await transaction `
          insert into public.players (id, display_name, last_seen_at)
          values (${player.deviceId}, ${player.displayName}, now())
          on conflict (id) do update
          set display_name = excluded.display_name,
              last_seen_at = excluded.last_seen_at
        `;
                await transaction `
          insert into public.match_players (
            match_id, player_id, display_name, final_score, final_rank
          ) values (
            ${match.id}, ${player.deviceId}, ${player.displayName},
            ${player.finalScore}, ${player.finalRank}
          )
        `;
                await transaction `
          update public.players
          set games_played = games_played + 1,
              wins = wins + ${player.finalRank === 1 ? 1 : 0}
          where id = ${player.deviceId}
        `;
                // Serialize currency decisions per player so two matches finishing at
                // the same time cannot both claim the fifth daily reward slot.
                await transaction `
          select id from public.players where id = ${player.deviceId} for update
        `;
                if (match.gameMode === "ranked") {
                    const [rankedPlayer] = await transaction `
            select ranked_lp, ranked_placement_matches, ranked_placement_points
            from public.players
            where id = ${player.deviceId}
          `;
                    if (rankedPlayer) {
                        const placement = Math.min(4, Math.max(1, player.finalRank));
                        const isPlacementMatch = rankedPlayer.ranked_placement_matches < shared_1.RANKED_PLACEMENT_MATCHES;
                        const placementPointsAwarded = isPlacementMatch ? (shared_1.RANKED_PLACEMENT_POINTS[placement] ?? 0) : 0;
                        const placementMatchesAfter = isPlacementMatch
                            ? rankedPlayer.ranked_placement_matches + 1
                            : rankedPlayer.ranked_placement_matches;
                        const placementPointsAfter = isPlacementMatch
                            ? rankedPlayer.ranked_placement_points + placementPointsAwarded
                            : rankedPlayer.ranked_placement_points;
                        const lpAfter = isPlacementMatch
                            ? placementMatchesAfter === shared_1.RANKED_PLACEMENT_MATCHES
                                ? (0, shared_1.getPlacementStartingLp)(placementPointsAfter)
                                : rankedPlayer.ranked_lp
                            : Math.max(0, rankedPlayer.ranked_lp + (shared_1.RANKED_LP_BY_PLACEMENT[placement] ?? 0));
                        const lpDelta = lpAfter - rankedPlayer.ranked_lp;
                        await transaction `
              insert into public.ranked_match_results (
                match_id, player_id, placement, was_placement_match,
                placement_points_awarded, lp_before, lp_delta, lp_after
              ) values (
                ${match.id}, ${player.deviceId}, ${placement}, ${isPlacementMatch},
                ${placementPointsAwarded}, ${rankedPlayer.ranked_lp}, ${lpDelta}, ${lpAfter}
              )
            `;
                        await transaction `
              update public.players
              set ranked_lp = ${lpAfter},
                  ranked_placement_matches = ${placementMatchesAfter},
                  ranked_placement_points = ${placementPointsAfter},
                  ranked_wins = ranked_wins + ${placement === 1 ? 1 : 0}
              where id = ${player.deviceId}
            `;
                    }
                }
                const [dailyCount] = await transaction `
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
                    const insertedRewards = await transaction `
            insert into public.star_transactions (
              id, player_id, amount, reason, source_match_id
            ) values (
              ${(0, crypto_1.randomUUID)()}, ${player.deviceId}, 10, 'game_completion', ${match.id}
            )
            on conflict (player_id, reason, source_match_id) do nothing
            returning id
          `;
                    if (insertedRewards.length > 0) {
                        starsEarned = 10;
                        rewardedGamesToday += 1;
                        await transaction `
              update public.players set stars = stars + 10 where id = ${player.deviceId}
            `;
                    }
                }
                const [updatedPlayer] = await transaction `
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
    }
    catch (error) {
        // Final results remain valid in-room even when persistence is unavailable.
        console.error("Could not persist completed match", error);
    }
    return progressUpdates;
}
