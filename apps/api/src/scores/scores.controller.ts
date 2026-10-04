import { requests } from '@croffledev/play-protocol';
import { Body, Controller, HttpCode, Inject, Logger, Param, Post } from '@nestjs/common';

import { ValibotPipe } from '../common/valibot.pipe.js';
import { GamesService } from '../games/games.service.js';

/**
 * Score intake. For now it validates and logs only; persistence and the player identity arrive
 * with accounts.
 */
@Controller('games/:id/scores')
export class ScoresController {
  private readonly logger = new Logger(ScoresController.name);

  constructor(@Inject(GamesService) private readonly games: GamesService) {}

  @Post()
  @HttpCode(202)
  async submit(
    @Param('id') id: string,
    @Body(new ValibotPipe(requests.submitScore.request)) body: { score: number },
  ): Promise<{ accepted: boolean }> {
    await this.games.get(id);
    this.logger.log(`score ${body.score} for ${id}`);
    return { accepted: true };
  }
}
