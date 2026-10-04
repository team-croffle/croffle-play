import { Module } from '@nestjs/common';

import {
  GameServerPublicController,
  GameServersAdminController,
} from './game-servers.controller.js';
import { GameServersService } from './game-servers.service.js';

@Module({
  controllers: [GameServerPublicController, GameServersAdminController],
  providers: [GameServersService],
  exports: [GameServersService],
})
export class GameServersModule {}
