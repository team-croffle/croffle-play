import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, max } from 'drizzle-orm';

import { DB, type Db } from '../db/db.js';
import { scores, users } from '../db/schema.js';
import type { PublicUser } from '../users/users.service.js';

export interface LeaderboardEntry {
  rank: number;
  user: PublicUser;
  score: number;
  at: string;
}

/** Higher is better. Each player appears once, with their best score (earliest on ties). */
@Injectable()
export class ScoresService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async submit(gameId: string, userId: string, score: number): Promise<{ best: number }> {
    await this.db.insert(scores).values({ gameId, userId, score });
    const [row] = await this.db
      .select({ best: max(scores.score) })
      .from(scores)
      .where(and(eq(scores.gameId, gameId), eq(scores.userId, userId)));
    return { best: row?.best ?? score };
  }

  async leaderboard(gameId: string, limit: number): Promise<LeaderboardEntry[]> {
    const best = this.db
      .selectDistinctOn([scores.userId], {
        userId: scores.userId,
        score: scores.score,
        at: scores.createdAt,
      })
      .from(scores)
      .where(eq(scores.gameId, gameId))
      .orderBy(scores.userId, desc(scores.score), asc(scores.createdAt))
      .as('best');
    const rows = await this.db
      .select({
        score: best.score,
        at: best.at,
        id: users.id,
        nickname: users.nickname,
        avatar: users.avatar,
      })
      .from(best)
      .innerJoin(users, eq(users.id, best.userId))
      .orderBy(desc(best.score), asc(best.at))
      .limit(limit);
    return rows.map((r, i) => ({
      rank: i + 1,
      user: { id: r.id, nickname: r.nickname, avatar: r.avatar },
      score: r.score,
      at: r.at.toISOString(),
    }));
  }
}
