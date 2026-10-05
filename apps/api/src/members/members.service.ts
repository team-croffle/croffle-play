import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, ilike, or } from 'drizzle-orm';

import { DB, type Db } from '../db/db.js';
import { gameMembers, gameServers, gameVersions, games, sdkVersions, users } from '../db/schema.js';
import { effectiveStatus, type SdkStatus } from '../sdk/lifecycle.js';

export type MemberRole = (typeof gameMembers.$inferSelect)['role'];

export interface MyGame {
  id: string;
  name: string;
  role: MemberRole;
  stableVersion: string | null;
  previewVersion: string | null;
  latest: { version: string; status: string; sdkMajor: number; uploadedAt: string | null } | null;
  sdk: { major: number; status: SdkStatus; deprecatedAt: string | null } | null;
  /** Things the team should act on. */
  warnings: string[];
}

@Injectable()
export class MembersService {
  constructor(@Inject(DB) private readonly db: Db) {}

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
      .select({ game: games, role: gameMembers.role, server: gameServers.status })
      .from(gameMembers)
      .innerJoin(games, eq(games.id, gameMembers.gameId))
      .leftJoin(gameServers, eq(gameServers.gameId, games.id))
      .where(eq(gameMembers.userId, userId))
      .orderBy(asc(games.name));
    const out: MyGame[] = [];
    for (const r of rows) {
      const [latest] = await this.db
        .select({ v: gameVersions, sdk: sdkVersions })
        .from(gameVersions)
        .leftJoin(sdkVersions, eq(sdkVersions.major, gameVersions.sdkMajor))
        .where(eq(gameVersions.gameId, r.game.id))
        .orderBy(desc(gameVersions.createdAt))
        .limit(1);
      const sdk = latest?.sdk
        ? {
            major: latest.sdk.major,
            status: effectiveStatus(latest.sdk),
            deprecatedAt: latest.sdk.deprecatedAt?.toISOString() ?? null,
          }
        : null;
      out.push({
        id: r.game.id,
        name: r.game.name,
        role: r.role,
        stableVersion: r.game.stableVersion,
        previewVersion: r.game.previewVersion,
        latest: latest
          ? {
              version: latest.v.version,
              status: latest.v.status,
              sdkMajor: latest.v.sdkMajor,
              uploadedAt: latest.v.uploadedAt?.toISOString() ?? null,
            }
          : null,
        sdk,
        warnings: warningsFor(r.game, sdk, r.server),
      });
    }
    return out;
  }
}

function warningsFor(
  game: typeof games.$inferSelect,
  sdk: MyGame['sdk'],
  server: string | null,
): string[] {
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
  if (game.previewVersion && game.previewVersion !== game.stableVersion) {
    w.push(`Version ${game.previewVersion} is waiting for approval`);
  }
  if (server === 'requested') {
    w.push('The game server is waiting for approval');
  }
  return w;
}

function escapeLike(s: string): string {
  // Postgres LIKE escapes with a single backslash.
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}
