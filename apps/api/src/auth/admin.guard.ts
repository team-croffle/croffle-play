import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { bearer, safeEqual } from '../common/secret.js';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';

/**
 * Temporary admin check: `Authorization: Bearer <ADMIN_TOKEN>`. Without ADMIN_TOKEN every admin
 * request is refused. Replaced by account roles once sign-in exists.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@Inject(ENV) private readonly env: Env) {}

  canActivate(ctx: ExecutionContext): boolean {
    const token = bearer(ctx.switchToHttp().getRequest<FastifyRequest>().headers.authorization);
    if (!this.env.ADMIN_TOKEN || !token || !safeEqual(token, this.env.ADMIN_TOKEN)) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
