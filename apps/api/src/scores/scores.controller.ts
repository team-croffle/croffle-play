import { requests } from '@croffledev/play-protocol';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import * as v from 'valibot';

import { CurrentUser, UserGuard } from '../auth/user.guard.js';
import { GameIdPipe } from '../common/game-id.pipe.js';
import { Limit, SubjectThrottlerGuard } from '../common/rate-limit.js';
import { ValibotPipe } from '../common/valibot.pipe.js';
import { ServerKeyGuard } from '../deploy-keys/deploy-key.guard.js';
import { GamesService } from '../games/games.service.js';
import { type User, UsersService } from '../users/users.service.js';
import { type LeaderboardEntry, type ScorePolicy, ScoresService } from './scores.service.js';

const verifiedSchema = v.object({
  /** Public account id, from the player's game token (`sub`). */
  userId: v.pipe(v.string(), v.uuid()),
  score: v.pipe(v.number(), v.finite()),
});

const limitSchema = v.pipe(
  v.optional(v.string(), '10'),
  v.transform(Number),
  v.integer(),
  v.minValue(1),
  v.maxValue(100),
);

@Controller('games/:id')
export class ScoresController {
  constructor(
    @Inject(GamesService) private readonly games: GamesService,
    @Inject(ScoresService) private readonly scores: ScoresService,
    @Inject(UsersService) private readonly users: UsersService,
  ) {}

  /** Client-reported score (Tier 1): recorded as the signed-in player's. */
  @Post('scores')
  @HttpCode(201)
  @UseGuards(UserGuard, SubjectThrottlerGuard)
  @Limit.score()
  async submit(
    @Param('id', GameIdPipe) id: string,
    @CurrentUser() user: User,
    @Body(new ValibotPipe(requests.submitScore.request)) body: { score: number },
  ): Promise<{ accepted: boolean; best: number | null }> {
    await this.games.get(id);
    return this.scores.submit(id, user.id, body.score, false);
  }

  /** Verified score from the game's own server (server key `csk_…`), for a given player. */
  @Post('scores/verified')
  @HttpCode(201)
  @UseGuards(ServerKeyGuard, SubjectThrottlerGuard)
  @Limit.serverScore()
  async submitVerified(
    @Param('id', GameIdPipe) id: string,
    @Body(new ValibotPipe(verifiedSchema)) body: v.InferOutput<typeof verifiedSchema>,
  ): Promise<{ accepted: boolean; best: number | null }> {
    if (!(await this.users.exists(body.userId))) {
      throw new NotFoundException('Unknown player');
    }
    return this.scores.submit(id, body.userId, body.score, true);
  }

  @Get('leaderboard')
  async leaderboard(
    @Param('id', GameIdPipe) id: string,
    @Query('limit', new ValibotPipe(limitSchema)) limit: number,
  ): Promise<{ policy: ScorePolicy; items: LeaderboardEntry[] }> {
    await this.games.get(id);
    return this.scores.leaderboard(id, limit);
  }
}
