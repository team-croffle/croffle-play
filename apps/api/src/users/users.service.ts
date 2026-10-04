import { createHash } from 'node:crypto';

import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { DB, type Db } from '../db/db.js';
import { users } from '../db/schema.js';

export type User = typeof users.$inferSelect;

/** What a player (and games, through the SDK) may see of an account. */
export interface PublicUser {
  id: string;
  nickname: string;
  avatar: string | null;
}

@Injectable()
export class UsersService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** The account for an IdP subject, created on first sight. */
  async ensure(sub: string): Promise<User> {
    const [row] = await this.db
      .insert(users)
      .values({ sub, nickname: defaultNickname(sub), lastSeenAt: new Date() })
      .onConflictDoUpdate({ target: users.sub, set: { lastSeenAt: new Date() } })
      .returning();
    return row as User;
  }

  async updateProfile(
    id: string,
    profile: { nickname: string; avatar: string | null },
  ): Promise<User> {
    const [row] = await this.db.update(users).set(profile).where(eq(users.id, id)).returning();
    if (!row) {
      throw new NotFoundException('User not found');
    }
    return row;
  }

  async grantAdmin(sub: string): Promise<User | null> {
    const [row] = await this.db
      .update(users)
      .set({ role: 'admin' })
      .where(eq(users.sub, sub))
      .returning();
    return row ?? null;
  }
}

export function toPublicUser(u: User): PublicUser {
  return { id: u.id, nickname: u.nickname, avatar: u.avatar };
}

function defaultNickname(sub: string): string {
  return `player-${createHash('sha256').update(sub).digest('hex').slice(0, 6)}`;
}
