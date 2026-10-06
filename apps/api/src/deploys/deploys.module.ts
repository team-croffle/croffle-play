import { Module } from '@nestjs/common';

import { GameMemberGuard } from '../members/game-member.guard.js';
import { SdkModule } from '../sdk/sdk.module.js';
import { DeployService } from './deploy.service.js';
import { AdminDeploysController, MyDeploysController } from './deploys.controller.js';

@Module({
  imports: [SdkModule],
  controllers: [AdminDeploysController, MyDeploysController],
  providers: [DeployService, GameMemberGuard],
  exports: [DeployService],
})
export class DeploysModule {}
