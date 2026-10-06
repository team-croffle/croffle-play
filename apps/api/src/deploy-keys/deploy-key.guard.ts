import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { bearer } from '../common/secret.js';
import { type DeployKey, DeployKeysService } from './deploy-keys.service.js';

export type DeployKeyRequest = FastifyRequest & { deployKey?: DeployKey };

/** Requires a valid deploy key for the game in the `:id` route parameter. */
@Injectable()
export class DeployKeyGuard implements CanActivate {
  constructor(@Inject(DeployKeysService) private readonly keys: DeployKeysService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<DeployKeyRequest>();
    const token = bearer(req.headers.authorization);
    const key = token ? await this.keys.verify(token) : null;
    if (!key) {
      throw new UnauthorizedException('A valid deploy key is required');
    }
    if (key.gameId !== (req.params as { id?: string }).id) {
      throw new ForbiddenException('This deploy key belongs to another game');
    }
    req.deployKey = key;
    return true;
  }
}
