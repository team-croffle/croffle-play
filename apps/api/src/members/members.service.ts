import { gameUrl } from '@croffledev/play-protocol';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, ilike, or } from 'drizzle-orm';

import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { DB, type Db } from '../db/db.js';
import { gameMembers, games, sdkVersions, users } from '../db/schema.js';
import { effectiveStatus, type SdkStatus } from '../sdk/lifecycle.js';

export type MemberRole = (typeof gameMembers.$inferSelect)['role'];

export interface MyGame {
  id: string;
  name: string;
  role: MemberRole;
  listed: boolean;
  hosting: 'team' | 'platform';
  /** Where the game is served (by the team or by the platform). */
  url: string;
  manifestFetchedAt: string | null;
  sdk: { major: number; status: SdkStatus; deprecatedAt: string | null } | null;
  /** Things the team should act on. */
  warnings: string[];
}

@Injectable()
export class MembersService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async list(gameId: string) {
    return this.db
      .select({ user: { id: users.id, nickname: users.nickname }, role: gameMembers.role })
      .from(gameMembers)
      .innerJoin(users, eq(users.id, gameMembers.userId))
      .where(eq(gameMembers.gameId, gameId))
      .orderBy(asc(users.nickname));
  }

  async set(gameId: string, userId: string, role: MemberRole): Promise<void> {
    const [user] = await this.db.select({ id: users.id }).from(users).where(eq(users.id, userId));
    const [game] = await this.db.select({ id: games.id }).from(games).where(eq(games.id, gameId));
    if (!user || !game) {
      throw new NotFoundException(user ? `Game '${gameId}' not found` : 'User not found');
    }
    await this.db
      .insert(gameMembers)
      .values({ gameId, userId, role })
      .onConflictDoUpdate({ target: [gameMembers.gameId, gameMembers.userId], set: { role } });
  }

  async remove(gameId: string, userId: string): Promise<void> {
    await this.db
      .delete(gameMembers)
      .where(and(eq(gameMembers.gameId, gameId), eq(gameMembers.userId, userId)));
  }

  /** Accounts by nickname (contains) or exact id, for adding members. */
  async searchUsers(q: string) {
    const isId = /^[0-9a-f-]{36}$/.test(q);
    return this.db
      .select({ id: users.id, nickname: users.nickname, role: users.role })
      .from(users)
      .where(
        isId
          ? or(eq(users.id, q), ilike(users.nickname, `%${escapeLike(q)}%`))
          : ilike(users.nickname, `%${escapeLike(q)}%`),
      )
      .orderBy(asc(users.nickname))
      .limit(20);
  }

  async myGames(userId: string): Promise<MyGame[]> {
    const rows = await this.db
      .select({ game: games, role: gameMembers.role, sdk: sdkVersions })
      .from(gameMembers)
      .innerJoin(games, eq(games.id, gameMembers.gameId))
      .leftJoin(sdkVersions, eq(sdkVersions.major, games.sdkMajor))
      .where(eq(gameMembers.userId, userId))
      .orderBy(asc(games.name));
    return rows.map((r) => {
      const sdk = r.sdk
        ? {
            major: r.sdk.major,
            status: effectiveStatus(r.sdk),
            deprecatedAt: r.sdk.deprecatedAt?.toISOString() ?? null,
          }
        : null;
      return {
        id: r.game.id,
        name: r.game.name,
        role: r.role,
        listed: r.game.listed,
        hosting: r.game.hosting,
        url: gameUrl(this.env.GAME_ORIGIN_TEMPLATE, r.game.id, r.game.manifest?.entry ?? ''),
        manifestFetchedAt: r.game.manifestFetchedAt?.toISOString() ?? null,
        sdk,
        warnings: warningsFor(r.game, sdk),
      };
    });
  }
}

function warningsFor(game: typeof games.$inferSelect, sdk: MyGame['sdk']): string[] {
  const w: string[] = [];
  if (sdk?.status === 'deprecated') {
    w.push(
      `SDK v${sdk.major} is deprecated: the game no longer runs. Upgrade with \`npx @croffledev/play-sdk migrate\``,
    );
  } else if (sdk?.status === 'old') {
    const until = sdk.deprecatedAt ? ` (deprecated from ${sdk.deprecatedAt.slice(0, 10)})` : '';
    w.push(
      `SDK v${sdk.major} is old${until}: updates are refused until you upgrade with \`npx @croffledev/play-sdk migrate\``,
    );
  }
  if (game.manifestError) {
    w.push(`game.json could not be read: ${game.manifestError}`);
  } else if (!game.manifest) {
    w.push('game.json has not been read yet: ask an admin to refresh the game once it is online');
  }
  return w;
}

function escapeLike(s: string): string {
  // Postgres LIKE escapes with a single backslash.
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}
