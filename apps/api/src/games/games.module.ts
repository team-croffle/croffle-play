import { Module } from '@nestjs/common';

import { SdkModule } from '../sdk/sdk.module.js';
import { GamesController } from './games.controller.js';
import { GamesService } from './games.service.js';
import { PlayService } from './play.service.js';

@Module({
  imports: [SdkModule],
  controllers: [GamesController],
  providers: [GamesService, PlayService],
  exports: [GamesService, PlayService],
})
export class GamesModule {}
