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

export interface NewsPost { id: string; title: string; body: string; publishedAt: string; }
export type RedeemCodeResult = { ok: true; stars: number; reward: number } | { ok: false; error: string };
export type PlayerReportResult = { ok: true } | { ok: false; error: string };

export async function submitPlayerReport(reporterId: string, rawReportedName: string, rawDescription: string): Promise<PlayerReportResult> {
  if (!sql) return { ok: false, error: "Player reports are temporarily unavailable" };
  const reportedName = rawReportedName.trim();
  const normalizedName = reportedName.toLocaleLowerCase("en-US");
  const description = rawDescription.trim();
  try {
    return await sql.begin(async (transaction) => {
      const [reported] = await transaction<{ id: string; display_name: string }[]>`
        select id, display_name from public.players
        where account_type = 'registered' and normalized_display_name = ${normalizedName}
        limit 1
      `;
      if (!reported) return { ok: false, error: "No player with that exact name was found" } as PlayerReportResult;
      if (reported.id === reporterId) return { ok: false, error: "You cannot report yourself" } as PlayerReportResult;

      const [recent] = await transaction<{ id: string }[]>`
        select id from public.player_reports
        where reporter_id = ${reporterId} and reported_player_id = ${reported.id}
          and created_at > now() - interval '24 hours'
        limit 1
      `;
      if (recent) return { ok: false, error: "You already reported this player recently" } as PlayerReportResult;

      await transaction`
        insert into public.player_reports (reporter_id, reported_player_id, reported_name, description)
        values (${reporterId}, ${reported.id}, ${reported.display_name}, ${description})
      `;
      return { ok: true } as PlayerReportResult;
    });
  } catch (error) {
    console.error("Could not submit player report", error);
    return { ok: false, error: "Could not submit this report" };
  }
}

export async function getNewsPosts(locale: "en" | "bg"): Promise<NewsPost[] | null> {
  if (!sql) return null;
  try {
    const rows = await sql<{ id: string; title: string; body: string; published_at: Date }[]>`
      select id, title, body, published_at from public.news_posts
      where locale = ${locale} and active = true and published_at <= now()
      order by published_at desc limit 30
    `;
    return rows.map((row) => ({ id: row.id, title: row.title, body: row.body, publishedAt: row.published_at.toISOString() }));
  } catch (error) { console.error("Could not load news", error); return null; }
}

export async function redeemPromoCode(playerId: string, rawCode: string): Promise<RedeemCodeResult> {
  if (!sql) return { ok: false, error: "Promo codes are temporarily unavailable" };
  const code = rawCode.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) return { ok: false, error: "Invalid promo code" };
  try {
    return await sql.begin(async (transaction) => {
      const [promo] = await transaction<{ id: string; star_reward: number; redemption_count: number; max_redemptions: number | null }[]>`
        select id, star_reward, redemption_count, max_redemptions from public.promo_codes
        where code = ${code} and active = true and (expires_at is null or expires_at > now()) for update
      `;
      if (!promo) return { ok: false, error: "This code is invalid or expired" } as RedeemCodeResult;
      if (promo.max_redemptions !== null && promo.redemption_count >= promo.max_redemptions) return { ok: false, error: "This code has reached its redemption limit" } as RedeemCodeResult;
      const [existing] = await transaction<{ promo_code_id: string }[]>`select promo_code_id from public.promo_code_redemptions where promo_code_id = ${promo.id} and player_id = ${playerId}`;
      if (existing) return { ok: false, error: "You have already redeemed this code" } as RedeemCodeResult;
      await transaction`insert into public.promo_code_redemptions (promo_code_id, player_id) values (${promo.id}, ${playerId})`;
      await transaction`update public.promo_codes set redemption_count = redemption_count + 1 where id = ${promo.id}`;
      const [player] = await transaction<{ stars: number }[]>`update public.players set stars = stars + ${promo.star_reward} where id = ${playerId} returning stars`;
      if (!player) throw new Error("player_not_found");
      await transaction`insert into public.star_transactions (id, player_id, amount, reason) values (${randomUUID()}, ${playerId}, ${promo.star_reward}, ${`promo_code:${promo.id}`})`;
      return { ok: true, stars: player.stars, reward: promo.star_reward } as RedeemCodeResult;
    });
  } catch (error) { console.error("Could not redeem promo code", error); return { ok: false, error: "Could not redeem this code" }; }
}

export interface PlayerAccount {
  playerId: string;
  accountType: "guest" | "registered";
  provider: string | null;
  displayName: string;
}

export interface AccountProfile extends PlayerAccount {
  stars: number;
  gamesPlayed: number;
  wins: number;
  rankedLp: number;
  rankKey: string;
}

export async function getAccountProfile(playerId: string, authUserId: string): Promise<AccountProfile | null> {
  if (!sql) return null;
  const [player] = await sql<{ id: string; display_name: string; auth_provider: string | null; stars: number; games_played: number; wins: number; ranked_lp: number; ranked_placement_matches: number }[]>`
    select id, display_name, auth_provider, stars, games_played, wins, ranked_lp, ranked_placement_matches
    from public.players where id = ${playerId} and auth_user_id = ${authUserId} and account_type = 'registered'
  `;
  if (!player) return null;
  return { playerId: player.id, accountType: "registered", provider: player.auth_provider, displayName: player.display_name, stars: player.stars, gamesPlayed: player.games_played, wins: player.wins, rankedLp: player.ranked_lp, rankKey: player.ranked_placement_matches < RANKED_PLACEMENT_MATCHES ? "novice" : getRankedDivision(player.ranked_lp).key };
}

export async function updateAccountDisplayName(playerId: string, authUserId: string, displayName: string): Promise<AccountProfile | "taken" | null> {
  if (!sql) return null;
  const normalized = displayName.toLocaleLowerCase("en-US");
  try {
    const [updated] = await sql<{ id: string }[]>`
      update public.players set display_name = ${displayName}, normalized_display_name = ${normalized}, last_seen_at = now()
      where id = ${playerId} and auth_user_id = ${authUserId} and account_type = 'registered' returning id
    `;
    return updated ? getAccountProfile(playerId, authUserId) : null;
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "23505") return "taken";
    console.error("Could not update account display name", error);
    return null;
  }
}

export async function anonymizePlayerAccount(playerId: string): Promise<boolean> {
  if (!sql) return false;
  try {
    return await sql.begin(async (transaction) => {
      const [player] = await transaction<{ id: string }[]>`
        select id from public.players
        where id = ${playerId} and account_type = 'registered'
        for update
      `;
      if (!player) return false;

      await transaction`update public.match_players set display_name = 'Deleted User' where player_id = ${playerId}`;
      await transaction`delete from public.player_reports where reporter_id = ${playerId}`;
      await transaction`update public.player_reports set reported_name = 'Deleted User' where reported_player_id = ${playerId}`;
      await transaction`delete from public.friendships where ${playerId} in (player_low_id, player_high_id)`;
      await transaction`delete from public.player_challenges where ${playerId} in (challenger_id, challenged_id)`;
      await transaction`delete from public.player_presence where player_id = ${playerId}`;
      await transaction`delete from public.player_cosmetics where player_id = ${playerId}`;
      await transaction`
        update public.players set
          display_name = 'Deleted User', normalized_display_name = null,
          account_type = 'deleted', auth_user_id = null, auth_provider = null, linked_at = null,
          stars = 0, total_points = 0, games_played = 0, wins = 0,
          ranked_lp = 0, ranked_placement_matches = 0, ranked_placement_points = 0,
          ranked_wins = 0, last_seen_at = now()
        where id = ${playerId}
      `;
      return true;
    });
  } catch (error) {
    console.error("Could not anonymize deleted account", error);
    return false;
  }
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

export interface FriendSummary {
  friendshipId: string;
  playerId: string;
  displayName: string;
  direction: "friend" | "incoming" | "outgoing" | "blocked";
  giftSentToday: boolean;
  giftId: string | null;
}

export interface FriendsResponse {
  friends: FriendSummary[];
  incoming: FriendSummary[];
  outgoing: FriendSummary[];
  blocked: FriendSummary[];
  unclaimedGiftCount: number;
}

export interface FriendSearchResult {
  playerId: string;
  displayName: string;
  relationship: "none" | "friend" | "incoming" | "outgoing" | "blocked";
}

type FriendActionResult = { ok: true; stars?: number; claimedCount?: number } | { ok: false; error: string };

export interface PlayerChallenge {
  id: string;
  challengerId: string;
  challengerName: string;
  challengedId: string;
  gameMode: "damage";
  status: "pending" | "accepted";
  damageWager: number;
  expiresAt: string;
}

export async function updatePlayerPresence(playerId: string, available: boolean): Promise<boolean> {
  if (!sql) return false;
  try {
    await sql`insert into public.player_presence (player_id, available, last_seen_at) values (${playerId}, ${available}, now()) on conflict (player_id) do update set available = excluded.available, last_seen_at = now()`;
    return true;
  } catch (error) { console.error("Could not update player presence", error); return false; }
}

export async function createPlayerChallenge(challengerId: string, challengedId: string, damageWager: number): Promise<FriendActionResult & { challengeId?: string }> {
  if (!sql || challengerId === challengedId) return { ok: false, error: "Invalid challenge" };
  try {
    const [eligible] = await sql<{ available: boolean }[]>`
      select presence.available
      from public.player_presence presence
      where presence.player_id = ${challengedId} and presence.available = true and presence.last_seen_at > now() - interval '20 seconds'
        and exists (
          select 1 from public.friendships friendship
          where friendship.player_low_id = least(${challengerId}::uuid, ${challengedId}::uuid)
            and friendship.player_high_id = greatest(${challengerId}::uuid, ${challengedId}::uuid) and friendship.status = 'accepted'
        )
    `;
    if (!eligible) return { ok: false, error: "Player is not online" };
    await sql`update public.player_challenges set status = 'expired' where status = 'pending' and expires_at <= now()`;
    const [challenge] = await sql<{ id: string }[]>`
      insert into public.player_challenges (challenger_id, challenged_id, damage_wager)
      values (${challengerId}, ${challengedId}, ${damageWager}) returning id
    `;
    return { ok: true, challengeId: challenge.id };
  } catch (error) { console.error("Could not create challenge", error); return { ok: false, error: "Could not send challenge" }; }
}

export async function getPlayerChallenges(playerId: string): Promise<PlayerChallenge[] | null> {
  if (!sql) return null;
  try {
    await sql`update public.player_challenges set status = 'expired' where status = 'pending' and expires_at <= now()`;
    const rows = await sql<{ id: string; challenger_id: string; challenger_name: string; challenged_id: string; status: "pending" | "accepted"; damage_wager: number; expires_at: Date }[]>`
      select challenge.id, challenge.challenger_id, challenger.display_name as challenger_name,
        challenge.challenged_id, challenge.status, challenge.damage_wager, challenge.expires_at
      from public.player_challenges challenge
      join public.players challenger on challenger.id = challenge.challenger_id
      where ${playerId} in (challenge.challenger_id, challenge.challenged_id)
        and (challenge.status = 'pending' or (challenge.status = 'accepted' and challenge.responded_at > now() - interval '20 seconds'))
      order by challenge.created_at desc limit 5
    `;
    return rows.map((row) => ({ id: row.id, challengerId: row.challenger_id, challengerName: row.challenger_name, challengedId: row.challenged_id, gameMode: "damage", status: row.status, damageWager: row.damage_wager, expiresAt: row.expires_at.toISOString() }));
  } catch (error) { console.error("Could not load challenges", error); return null; }
}

export async function respondToPlayerChallenge(playerId: string, challengeId: string, accept: boolean): Promise<FriendActionResult> {
  if (!sql) return { ok: false, error: "Challenges are temporarily unavailable" };
  try {
    const [updated] = await sql<{ id: string }[]>`
      update public.player_challenges set status = ${accept ? "accepted" : "declined"}, responded_at = now()
      where id = ${challengeId} and challenged_id = ${playerId} and status = 'pending' and expires_at > now()
      returning id
    `;
    return updated ? { ok: true } : { ok: false, error: "Challenge has expired" };
  } catch (error) { console.error("Could not respond to challenge", error); return { ok: false, error: "Could not respond to challenge" }; }
}

export async function isAcceptedChallengeParticipant(challengeId: string, playerId: string): Promise<boolean> {
  if (!sql) return false;
  const [challenge] = await sql<{ id: string }[]>`
    select id from public.player_challenges
    where id = ${challengeId} and status = 'accepted' and ${playerId} in (challenger_id, challenged_id)
  `;
  return Boolean(challenge);
}

export async function getAcceptedChallengeParticipantRole(challengeId: string, playerId: string): Promise<"challenger" | "challenged" | null> {
  if (!sql) return null;
  const [challenge] = await sql<{ challenger_id: string; challenged_id: string }[]>`
    select challenger_id, challenged_id from public.player_challenges
    where id = ${challengeId} and status = 'accepted' and ${playerId} in (challenger_id, challenged_id)
  `;
  if (!challenge) return null;
  return challenge.challenger_id === playerId ? "challenger" : "challenged";
}

export async function listFriends(playerId: string): Promise<FriendsResponse | null> {
  if (!sql) return null;
  try {
    const rows = await sql<{
      friendship_id: string; status: string; requested_by: string; other_id: string; display_name: string;
      gift_sent_today: boolean; gift_id: string | null;
    }[]>`
      select f.id as friendship_id, f.status, f.requested_by,
        other_player.id as other_id, other_player.display_name,
        exists(
          select 1 from public.friend_gifts sent
          where sent.friendship_id = f.id and sent.sender_id = ${playerId}
            and sent.gift_date = (now() at time zone 'utc')::date
        ) as gift_sent_today,
        (
          select received.id from public.friend_gifts received
          where received.friendship_id = f.id and received.receiver_id = ${playerId}
            and received.gift_date = (now() at time zone 'utc')::date and received.claimed_at is null
          limit 1
        ) as gift_id
      from public.friendships f
      join public.players other_player on other_player.id = case
        when f.player_low_id = ${playerId} then f.player_high_id else f.player_low_id end
      where ${playerId} in (f.player_low_id, f.player_high_id)
        and (f.status <> 'blocked' or f.blocked_by = ${playerId})
      order by lower(other_player.display_name), other_player.id
    `;
    const response: FriendsResponse = { friends: [], incoming: [], outgoing: [], blocked: [], unclaimedGiftCount: 0 };
    for (const row of rows) {
      const direction: FriendSummary["direction"] = row.status === "blocked"
        ? "blocked"
        : row.status === "accepted"
        ? "friend"
        : row.requested_by === playerId ? "outgoing" : "incoming";
      const item: FriendSummary = {
        friendshipId: row.friendship_id,
        playerId: row.other_id,
        displayName: row.display_name,
        direction,
        giftSentToday: row.gift_sent_today,
        giftId: row.gift_id,
      };
      if (direction === "blocked") response.blocked.push(item);
      else if (direction === "friend") response.friends.push(item);
      else if (direction === "incoming") response.incoming.push(item);
      else response.outgoing.push(item);
      if (row.gift_id) response.unclaimedGiftCount += 1;
    }
    return response;
  } catch (error) {
    console.error("Could not load friends", error);
    return null;
  }
}

export async function searchFriendPlayers(playerId: string, query: string): Promise<FriendSearchResult[] | null> {
  if (!sql) return null;
  try {
    const normalizedQuery = query.toLocaleLowerCase("en-US");
    const rows = await sql<{ id: string; display_name: string; status: string | null; requested_by: string | null }[]>`
      select candidate.id, candidate.display_name, friendship.status, friendship.requested_by
      from public.players candidate
      left join public.friendships friendship on
        friendship.player_low_id = least(candidate.id, ${playerId}::uuid)
        and friendship.player_high_id = greatest(candidate.id, ${playerId}::uuid)
      where candidate.account_type = 'registered' and candidate.id <> ${playerId}
        and candidate.normalized_display_name like ${`${normalizedQuery}%`}
      order by lower(candidate.display_name), candidate.id
      limit 12
    `;
    return rows.map((row) => ({
      playerId: row.id,
      displayName: row.display_name,
      relationship: row.status === "accepted" ? "friend"
        : row.status === "blocked" ? "blocked"
        : row.status === "pending" ? row.requested_by === playerId ? "outgoing" : "incoming"
        : "none",
    }));
  } catch (error) {
    console.error("Could not search friend players", error);
    return null;
  }
}

export async function suggestFriendPlayers(playerId: string): Promise<FriendSearchResult[] | null> {
  if (!sql) return null;
  try {
    const rows = await sql<{ id: string; display_name: string }[]>`
      select candidate.id, candidate.display_name
      from public.players candidate
      where candidate.account_type = 'registered' and candidate.id <> ${playerId}
        and not exists (
          select 1 from public.friendships friendship
          where friendship.player_low_id = least(candidate.id, ${playerId}::uuid)
            and friendship.player_high_id = greatest(candidate.id, ${playerId}::uuid)
        )
      order by random()
      limit 8
    `;
    return rows.map((row) => ({ playerId: row.id, displayName: row.display_name, relationship: "none" }));
  } catch (error) {
    console.error("Could not suggest friend players", error);
    return null;
  }
}

export async function sendFriendRequest(playerId: string, targetPlayerId: string): Promise<FriendActionResult> {
  if (!sql || playerId === targetPlayerId) return { ok: false, error: "Invalid player" };
  const [low, high] = [playerId, targetPlayerId].sort();
  try {
    return await sql.begin(async (transaction) => {
      const [target] = await transaction<{ id: string }[]>`select id from public.players where id = ${targetPlayerId} and account_type = 'registered'`;
      if (!target) return { ok: false, error: "Player not found" } as FriendActionResult;
      const [existing] = await transaction<{ status: string; requested_by: string }[]>`
        select status, requested_by from public.friendships where player_low_id = ${low} and player_high_id = ${high} for update
      `;
      if (existing?.status === "blocked") return { ok: false, error: "Friend request unavailable" };
      if (existing?.status === "accepted") return { ok: false, error: "You are already friends" };
      if (existing?.status === "pending") return { ok: false, error: existing.requested_by === playerId ? "Request already sent" : "This player already sent you a request" };
      await transaction`
        insert into public.friendships (player_low_id, player_high_id, requested_by)
        values (${low}, ${high}, ${playerId})
      `;
      return { ok: true } as FriendActionResult;
    });
  } catch (error) {
    console.error("Could not send friend request", error);
    return { ok: false, error: "Could not send friend request" };
  }
}

export async function respondToFriendRequest(playerId: string, friendshipId: string, accept: boolean): Promise<FriendActionResult> {
  if (!sql) return { ok: false, error: "Friends are temporarily unavailable" };
  try {
    return await sql.begin(async (transaction) => {
      const [friendship] = await transaction<{ player_low_id: string; player_high_id: string; requested_by: string; status: string }[]>`
        select player_low_id, player_high_id, requested_by, status from public.friendships where id = ${friendshipId} for update
      `;
      if (!friendship || friendship.status !== "pending" || friendship.requested_by === playerId || ![friendship.player_low_id, friendship.player_high_id].includes(playerId)) {
        return { ok: false, error: "Friend request is no longer available" } as FriendActionResult;
      }
      if (!accept) {
        await transaction`delete from public.friendships where id = ${friendshipId}`;
        return { ok: true } as FriendActionResult;
      }
      const counts = await transaction<{ player_id: string; count: number }[]>`
        select member.player_id, count(f.id)::int as count
        from (values (${friendship.player_low_id}::uuid), (${friendship.player_high_id}::uuid)) member(player_id)
        left join public.friendships f on member.player_id in (f.player_low_id, f.player_high_id) and f.status = 'accepted'
        group by member.player_id
      `;
      if (counts.some((item) => item.count >= 25)) return { ok: false, error: "The 25 friend limit has been reached" } as FriendActionResult;
      await transaction`update public.friendships set status = 'accepted', responded_at = now() where id = ${friendshipId}`;
      return { ok: true } as FriendActionResult;
    });
  } catch (error) {
    console.error("Could not respond to friend request", error);
    return { ok: false, error: "Could not update friend request" };
  }
}

export async function updateFriendRelationship(playerId: string, friendshipId: string, action: "remove" | "block" | "unblock"): Promise<FriendActionResult> {
  if (!sql) return { ok: false, error: "Friends are temporarily unavailable" };
  try {
    const rows = action === "block"
      ? await sql`update public.friendships set status = 'blocked', blocked_by = ${playerId}, responded_at = now() where id = ${friendshipId} and ${playerId} in (player_low_id, player_high_id) returning id`
      : action === "unblock"
        ? await sql`delete from public.friendships where id = ${friendshipId} and blocked_by = ${playerId} returning id`
        : await sql`delete from public.friendships where id = ${friendshipId} and ${playerId} in (player_low_id, player_high_id) and status <> 'blocked' returning id`;
    return rows.length ? { ok: true } : { ok: false, error: "Friendship is no longer available" };
  } catch (error) {
    console.error("Could not remove or block friend", error);
    return { ok: false, error: "Could not update friendship" };
  }
}

export async function sendFriendGift(playerId: string, friendshipId: string): Promise<FriendActionResult> {
  if (!sql) return { ok: false, error: "Gifts are temporarily unavailable" };
  try {
    return await sql.begin(async (transaction) => {
      const [friendship] = await transaction<{ player_low_id: string; player_high_id: string; status: string }[]>`
        select player_low_id, player_high_id, status from public.friendships where id = ${friendshipId} for update
      `;
      if (!friendship || friendship.status !== "accepted" || ![friendship.player_low_id, friendship.player_high_id].includes(playerId)) {
        return { ok: false, error: "You can only gift accepted friends" } as FriendActionResult;
      }
      const receiverId = friendship.player_low_id === playerId ? friendship.player_high_id : friendship.player_low_id;
      const inserted = await transaction`
        insert into public.friend_gifts (friendship_id, sender_id, receiver_id)
        values (${friendshipId}, ${playerId}, ${receiverId})
        on conflict (sender_id, receiver_id, gift_date) do nothing returning id
      `;
      return inserted.length ? { ok: true } as FriendActionResult : { ok: false, error: "Gift already sent today" } as FriendActionResult;
    });
  } catch (error) {
    console.error("Could not send friend gift", error);
    return { ok: false, error: "Could not send gift" };
  }
}

export async function claimFriendGift(playerId: string, giftId: string): Promise<FriendActionResult> {
  if (!sql) return { ok: false, error: "Gifts are temporarily unavailable" };
  try {
    return await sql.begin(async (transaction) => {
      const [gift] = await transaction<{ id: string; stars: number }[]>`
        select id, stars from public.friend_gifts
        where id = ${giftId} and receiver_id = ${playerId}
          and gift_date = (now() at time zone 'utc')::date and claimed_at is null
        for update
      `;
      if (!gift) return { ok: false, error: "Gift is no longer available" } as FriendActionResult;
      await transaction`update public.friend_gifts set claimed_at = now() where id = ${giftId}`;
      const [updated] = await transaction<{ stars: number }[]>`update public.players set stars = stars + ${gift.stars} where id = ${playerId} returning stars`;
      await transaction`
        insert into public.star_transactions (id, player_id, amount, reason)
        values (${randomUUID()}, ${playerId}, ${gift.stars}, ${`friend_gift:${gift.id}`})
      `;
      return { ok: true, stars: updated.stars } as FriendActionResult;
    });
  } catch (error) {
    console.error("Could not claim friend gift", error);
    return { ok: false, error: "Could not claim gift" };
  }
}

export async function claimAllFriendGifts(playerId: string): Promise<FriendActionResult> {
  if (!sql) return { ok: false, error: "Gifts are temporarily unavailable" };
  try {
    return await sql.begin(async (transaction) => {
      const gifts = await transaction<{ id: string; stars: number }[]>`
        select id, stars from public.friend_gifts
        where receiver_id = ${playerId} and gift_date = (now() at time zone 'utc')::date and claimed_at is null
        order by sent_at for update
      `;
      if (gifts.length === 0) return { ok: false, error: "No blessings are waiting to be claimed" } as FriendActionResult;
      const total = gifts.reduce((sum, gift) => sum + gift.stars, 0);
      await transaction`update public.friend_gifts set claimed_at = now() where id in ${transaction(gifts.map((gift) => gift.id))}`;
      const [updated] = await transaction<{ stars: number }[]>`update public.players set stars = stars + ${total} where id = ${playerId} returning stars`;
      for (const gift of gifts) {
        await transaction`
          insert into public.star_transactions (id, player_id, amount, reason)
          values (${randomUUID()}, ${playerId}, ${gift.stars}, ${`friend_gift:${gift.id}`})
        `;
      }
      return { ok: true, stars: updated.stars, claimedCount: gifts.length } as FriendActionResult;
    });
  } catch (error) {
    console.error("Could not claim all friend gifts", error);
    return { ok: false, error: "Could not claim blessings" };
  }
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
      ranked_wins: number;
      ranked_placement_matches: number;
      position: number;
    }[]>`
      select id, display_name, ranked_lp, ranked_wins, ranked_placement_matches, position::int
      from (
        select id, display_name, ranked_lp, ranked_wins, ranked_placement_matches,
          row_number() over (order by ranked_lp desc, ranked_wins desc, created_at asc) as position
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
      wins: player.ranked_wins,
      position: player.position,
      placementMatches: player.ranked_placement_matches,
    }));

    const [current] = await sql<{
      id: string;
      display_name: string;
      ranked_lp: number;
      ranked_wins: number;
      ranked_placement_matches: number;
      position: number | null;
    }[]>`
      select p.id, p.display_name, p.ranked_lp, p.ranked_wins, p.ranked_placement_matches,
        case when p.ranked_placement_matches >= ${RANKED_PLACEMENT_MATCHES} then (
          select count(*)::int + 1
          from public.players ahead
          where ahead.ranked_placement_matches >= ${RANKED_PLACEMENT_MATCHES}
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
      rankKey: current.ranked_placement_matches < RANKED_PLACEMENT_MATCHES
        ? "novice"
        : getRankedDivision(current.ranked_lp).key,
      wins: current.ranked_wins,
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
                  ranked_placement_points = ${placementPointsAfter},
                  ranked_wins = ranked_wins + ${placement === 1 ? 1 : 0}
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
