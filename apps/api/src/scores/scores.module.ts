import { Module } from '@nestjs/common';

import { DeployKeysModule } from '../deploy-keys/deploy-keys.module.js';
import { GamesModule } from '../games/games.module.js';
import { ScoresController } from './scores.controller.js';
import { ScoresService } from './scores.service.js';

@Module({
  imports: [GamesModule, DeployKeysModule],
  controllers: [ScoresController],
  providers: [ScoresService],
})
export class ScoresModule {}
