import { createHash } from 'node:crypto';

import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
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
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Pick<Env, 'ADMIN_SUBS'>,
  ) {}

  /** The account for an IdP subject, created on first sight (admins from ADMIN_SUBS promoted). */
  async ensure(sub: string): Promise<User> {
    const promote = this.env.ADMIN_SUBS.includes(sub);
    const [row] = await this.db
      .insert(users)
      .values({
        sub,
        nickname: defaultNickname(sub),
        lastSeenAt: new Date(),
        ...(promote ? { role: 'admin' as const } : {}),
      })
      .onConflictDoUpdate({
        target: users.sub,
        set: { lastSeenAt: new Date(), ...(promote ? { role: 'admin' as const } : {}) },
      })
      .returning();
    return row as User;
  }

  /** Sign-in sync: the IdP picture never replaces an uploaded avatar. */
  async updateProfile(
    id: string,
    profile: { nickname: string; avatar?: string | null | undefined },
  ): Promise<User> {
    const [current] = await this.db.select().from(users).where(eq(users.id, id));
    const keepAvatar = current?.avatarUploaded || profile.avatar === undefined;
    const set = keepAvatar
      ? { nickname: profile.nickname }
      : { nickname: profile.nickname, avatar: profile.avatar ?? null };
    const [row] = await this.db.update(users).set(set).where(eq(users.id, id)).returning();
    if (!row) {
      throw new NotFoundException('User not found');
    }
    return row;
  }

  async setAvatar(id: string, avatar: string | null): Promise<User> {
    const [row] = await this.db
      .update(users)
      .set({ avatar, avatarUploaded: avatar !== null })
      .where(eq(users.id, id))
      .returning();
    if (!row) {
      throw new NotFoundException('User not found');
    }
    return row;
  }

  async exists(id: string): Promise<boolean> {
    const [row] = await this.db.select({ id: users.id }).from(users).where(eq(users.id, id));
    return Boolean(row);
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
