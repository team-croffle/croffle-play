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
import { type ServerKey, ServerKeysService } from './server-keys.service.js';

export type ServerKeyRequest = FastifyRequest & { serverKey?: ServerKey };

/** Requires a valid server key (verified scores) for the game in the `:id` route parameter. */
@Injectable()
export class ServerKeyGuard implements CanActivate {
  constructor(@Inject(ServerKeysService) private readonly keys: ServerKeysService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<ServerKeyRequest>();
    const token = bearer(req.headers.authorization);
    const key = token ? await this.keys.verify(token) : null;
    if (!key) {
      throw new UnauthorizedException('A valid server key is required');
    }
    if (key.gameId !== (req.params as { id?: string }).id) {
      throw new ForbiddenException('This server key belongs to another game');
    }
    req.serverKey = key;
    return true;
  }
}
