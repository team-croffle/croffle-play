import { Module } from '@nestjs/common';

import { GamesModule } from '../games/games.module.js';
import { AdminGamesController } from './admin-games.controller.js';
import { AdminGamesService } from './admin-games.service.js';

@Module({
  imports: [GamesModule],
  controllers: [AdminGamesController],
  providers: [AdminGamesService],
})
export class AdminModule {}
