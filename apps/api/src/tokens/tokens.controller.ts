import { Controller, Get, Header, Inject, Param, Post, UseGuards } from '@nestjs/common';

import { CurrentUser, UserGuard } from '../auth/user.guard.js';
import { GameIdPipe } from '../common/game-id.pipe.js';
import { Limit, SubjectThrottlerGuard } from '../common/rate-limit.js';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { GamesService } from '../games/games.service.js';
import type { User } from '../users/users.service.js';
import { SigningKeys } from './signing-keys.js';

/** Public keys for game tokens; game servers and the rooms server verify against these. */
@Controller('.well-known')
export class JwksController {
  constructor(@Inject(SigningKeys) private readonly keys: SigningKeys) {}

  @Get('jwks.json')
  @Header('Cache-Control', 'public, max-age=300')
  jwks() {
    return this.keys.jwks();
  }
}

/**
 * Short-lived token scoped to one game (`aud: game:<id>`, design invariant 4). A leaked token works
 * for that game only, and only briefly.
 */
@Controller('games/:id/token')
@UseGuards(UserGuard)
export class TokensController {
  constructor(
    @Inject(SigningKeys) private readonly keys: SigningKeys,
    @Inject(GamesService) private readonly games: GamesService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Post()
  @UseGuards(SubjectThrottlerGuard)
  @Limit.token()
  async issue(
    @Param('id', GameIdPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<{ token: string; expiresAt: string }> {
    await this.games.get(id);
    const ttl = this.env.GAME_TOKEN_TTL_SECONDS;
    const token = await this.keys.sign(
      { nickname: user.nickname },
      { subject: user.id, audience: `game:${id}`, ttlSeconds: ttl },
    );
    return { token, expiresAt: new Date(Date.now() + ttl * 1000).toISOString() };
  }
}
