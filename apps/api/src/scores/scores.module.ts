import { Module } from '@nestjs/common';

import { GamesModule } from '../games/games.module.js';
import { ServerKeysModule } from '../server-keys/server-keys.module.js';
import { ScoresController } from './scores.controller.js';
import { ScoresService } from './scores.service.js';

@Module({
  imports: [GamesModule, ServerKeysModule],
  controllers: [ScoresController],
  providers: [ScoresService],
})
export class ScoresModule {}
