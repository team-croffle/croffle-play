import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, asc, desc, eq, max } from 'drizzle-orm';

import { DB, type Db } from '../db/db.js';
import { games, scores, users } from '../db/schema.js';
import type { PublicUser } from '../users/users.service.js';

export type ScorePolicy = (typeof games.$inferSelect)['scorePolicy'];

export interface LeaderboardEntry {
  rank: number;
  user: PublicUser;
  score: number;
  at: string;
  /** Submitted by the game's server rather than reported by the browser. */
  verified: boolean;
}

/**
 * Higher is better. Each player appears once, with their best score (earliest on ties).
 *
 * Trust: under the `client` policy every score counts but is unverified (anyone can send any number
 * from a browser). Under `server`, only scores from the game's server (server key) count.
 */
@Injectable()
export class ScoresService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async submit(
    gameId: string,
    userId: string,
    score: number,
    verified: boolean,
  ): Promise<{ accepted: boolean; best: number | null }> {
    const game = await this.policy(gameId);
    if (
      (game.scoreMin !== null && score < game.scoreMin) ||
      (game.scoreMax !== null && score > game.scoreMax)
    ) {
      throw new UnprocessableEntityException(`Score ${score} is outside this game's range`);
    }
    // A server-scored game ignores what browsers report; the game is told so.
    if (game.scorePolicy === 'server' && !verified) {
      return { accepted: false, best: await this.best(gameId, userId, true) };
    }
    await this.db.insert(scores).values({ gameId, userId, score, verified });
    return { accepted: true, best: await this.best(gameId, userId, game.scorePolicy === 'server') };
  }

  async leaderboard(
    gameId: string,
    limit: number,
  ): Promise<{ policy: ScorePolicy; items: LeaderboardEntry[] }> {
    const { scorePolicy } = await this.policy(gameId);
    const where =
      scorePolicy === 'server'
        ? and(eq(scores.gameId, gameId), eq(scores.verified, true))
        : eq(scores.gameId, gameId);
    const best = this.db
      .selectDistinctOn([scores.userId], {
        userId: scores.userId,
        score: scores.score,
        at: scores.createdAt,
        verified: scores.verified,
      })
      .from(scores)
      .where(where)
      .orderBy(scores.userId, desc(scores.score), asc(scores.createdAt))
      .as('best');
    const rows = await this.db
      .select({
        score: best.score,
        at: best.at,
        verified: best.verified,
        id: users.id,
        nickname: users.nickname,
        avatar: users.avatar,
      })
      .from(best)
      .innerJoin(users, eq(users.id, best.userId))
      .orderBy(desc(best.score), asc(best.at))
      .limit(limit);
    return {
      policy: scorePolicy,
      items: rows.map((r, i) => ({
        rank: i + 1,
        user: { id: r.id, nickname: r.nickname, avatar: r.avatar },
        score: r.score,
        at: r.at.toISOString(),
        verified: r.verified,
      })),
    };
  }

  private async policy(gameId: string) {
    const [game] = await this.db
      .select({
        scorePolicy: games.scorePolicy,
        scoreMin: games.scoreMin,
        scoreMax: games.scoreMax,
      })
      .from(games)
      .where(eq(games.id, gameId));
    if (!game) {
      throw new NotFoundException(`Game '${gameId}' not found`);
    }
    return game;
  }

  private async best(
    gameId: string,
    userId: string,
    verifiedOnly: boolean,
  ): Promise<number | null> {
    const [row] = await this.db
      .select({ best: max(scores.score) })
      .from(scores)
      .where(
        and(
          eq(scores.gameId, gameId),
          eq(scores.userId, userId),
          ...(verifiedOnly ? [eq(scores.verified, true)] : []),
        ),
      );
    return row?.best ?? null;
  }
}
