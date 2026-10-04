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
import { type DeployKey, DeployKeysService, type KeyKind } from './deploy-keys.service.js';

export type DeployKeyRequest = FastifyRequest & { deployKey?: DeployKey };

abstract class GameKeyGuard implements CanActivate {
  protected abstract readonly kind: KeyKind;

  constructor(private readonly keys: DeployKeysService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<DeployKeyRequest>();
    const token = bearer(req.headers.authorization);
    const key = token ? await this.keys.verify(token, this.kind) : null;
    if (!key) {
      throw new UnauthorizedException(`A valid ${this.kind} key is required`);
    }
    if (key.gameId !== (req.params as { id?: string }).id) {
      throw new ForbiddenException('This deploy key belongs to another game');
    }
    req.deployKey = key;
    return true;
  }
}

/** Requires a valid deploy key (publishing) for the game in the `:id` route parameter. */
@Injectable()
export class DeployKeyGuard extends GameKeyGuard {
  protected readonly kind = 'deploy';

  constructor(@Inject(DeployKeysService) keys: DeployKeysService) {
    super(keys);
  }
}

/** Requires a valid server key (verified scores) for the game in the `:id` route parameter. */
@Injectable()
export class ServerKeyGuard extends GameKeyGuard {
  protected readonly kind = 'server';

  constructor(@Inject(DeployKeysService) keys: DeployKeysService) {
    super(keys);
  }
}
