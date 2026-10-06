import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { UserGuard, type UserRequest } from '../auth/user.guard.js';
import { DB, type Db } from '../db/db.js';
import { gameMembers } from '../db/schema.js';

/** Signed-in members of the game in the `:id` route parameter (any role), or admins. */
@Injectable()
export class GameMemberGuard implements CanActivate {
  constructor(
    @Inject(UserGuard) private readonly users: UserGuard,
    @Inject(DB) private readonly db: Db,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    await this.users.canActivate(ctx);
    const req = ctx.switchToHttp().getRequest<UserRequest>();
    const user = req.user;
    const gameId = (req.params as { id?: string }).id ?? '';
    if (user?.role === 'admin') {
      return true;
    }
    const [row] = await this.db
      .select({ gameId: gameMembers.gameId })
      .from(gameMembers)
      .where(and(eq(gameMembers.gameId, gameId), eq(gameMembers.userId, user?.id ?? '')))
      .limit(1);
    if (!row) {
      throw new ForbiddenException('Members of this game only');
    }
    return true;
  }
}
