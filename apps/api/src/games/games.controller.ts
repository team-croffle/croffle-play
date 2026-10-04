import { Controller, Get, Inject, Param } from '@nestjs/common';

import { type GameSummary, GamesService } from './games.service.js';

@Controller('games')
export class GamesController {
  constructor(@Inject(GamesService) private readonly games: GamesService) {}

  @Get()
  async list(): Promise<{ items: GameSummary[] }> {
    return { items: await this.games.list() };
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<GameSummary> {
    return this.games.get(id);
  }
}
