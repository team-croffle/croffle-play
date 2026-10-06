import { Module } from '@nestjs/common';

import { DeploysModule } from '../deploys/deploys.module.js';
import { GameMemberGuard } from '../members/game-member.guard.js';
import { DeployKeyGuard } from './deploy-key.guard.js';
import {
  AdminDeployKeysController,
  KeyDeploysController,
  MyDeployKeysController,
} from './deploy-keys.controller.js';
import { DeployKeysService } from './deploy-keys.service.js';

@Module({
  imports: [DeploysModule],
  controllers: [AdminDeployKeysController, MyDeployKeysController, KeyDeploysController],
  providers: [DeployKeysService, DeployKeyGuard, GameMemberGuard],
  exports: [DeployKeysService],
})
export class DeployKeysModule {}
