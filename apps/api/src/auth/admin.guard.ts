import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';

import { UserGuard, type UserRequest } from './user.guard.js';

/** Signed-in players with the `admin` role (granted with `db:grant-admin`). */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@Inject(UserGuard) private readonly users: UserGuard) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    await this.users.canActivate(ctx);
    if (ctx.switchToHttp().getRequest<UserRequest>().user?.role !== 'admin') {
      throw new ForbiddenException('Admins only');
    }
    return true;
  }
}
