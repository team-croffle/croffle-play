import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { bearer } from '../common/secret.js';
import { type User, UsersService } from '../users/users.service.js';
import { JwtVerifier } from './jwt-verifier.js';

export type UserRequest = FastifyRequest & { user?: User };

/** Requires a player access token (`Authorization: Bearer`); the account is created on first use. */
@Injectable()
export class UserGuard implements CanActivate {
  constructor(
    @Inject(JwtVerifier) private readonly verifier: JwtVerifier,
    @Inject(UsersService) private readonly users: UsersService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<UserRequest>();
    const token = bearer(req.headers.authorization);
    const sub = token ? await this.verifier.subject(token) : null;
    if (!sub) {
      throw new UnauthorizedException('Sign-in required');
    }
    req.user = await this.users.ensure(sub);
    return true;
  }
}

/** The account set by `UserGuard`. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): User => {
  const user = ctx.switchToHttp().getRequest<UserRequest>().user;
  if (!user) {
    throw new UnauthorizedException('Sign-in required');
  }
  return user;
});
