import { Controller, Get, Inject, Param } from '@nestjs/common';

import { GameIdPipe } from '../common/game-id.pipe.js';
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
  get(@Param('id', GameIdPipe) id: string): Promise<GameSummary> {
    return this.games.get(id);
  }

  /** The game's own server, as its game.json declares it (`sdk.getServerInfo()`). */
  @Get(':id/server')
  server(@Param('id', GameIdPipe) id: string): Promise<{ url: string; protocol: string }> {
    return this.games.server(id);
  }

  @Get(':id/play')
  playInfo(@Param('id', GameIdPipe) id: string): Promise<PlayInfo> {
    return this.play.info(id);
  }
}
