import { Controller, Get, Inject, Param, Query } from '@nestjs/common';

import { type GameSummary, GamesService } from './games.service.js';
import { type PlayInfo, PlayService } from './play.service.js';

@Controller('games')
export class GamesController {
  constructor(
    @Inject(GamesService) private readonly games: GamesService,
    @Inject(PlayService) private readonly play: PlayService,
  ) {}

  @Get()
  async list(): Promise<{ items: GameSummary[] }> {
    return { items: await this.games.list() };
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<GameSummary> {
    return this.games.get(id);
  }

  @Get(':id/play')
  playInfo(@Param('id') id: string, @Query('version') version?: string): Promise<PlayInfo> {
    return this.play.info(id, version || undefined);
  }
}
