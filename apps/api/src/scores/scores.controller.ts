import { requests } from '@croffledev/play-protocol';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
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
import { GamesService } from '../games/games.service.js';
import type { User } from '../users/users.service.js';
import { type LeaderboardEntry, ScoresService } from './scores.service.js';

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
  ): Promise<{ accepted: boolean; best: number }> {
    await this.games.get(id);
    return { accepted: true, ...(await this.scores.submit(id, user.id, body.score)) };
  }

  @Get('leaderboard')
  async leaderboard(
    @Param('id', GameIdPipe) id: string,
    @Query('limit', new ValibotPipe(limitSchema)) limit: number,
  ): Promise<{ items: LeaderboardEntry[] }> {
    await this.games.get(id);
    return { items: await this.scores.leaderboard(id, limit) };
  }
}
