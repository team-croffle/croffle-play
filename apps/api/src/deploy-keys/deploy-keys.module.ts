import { Module } from '@nestjs/common';

import { DeployKeyGuard, ServerKeyGuard } from './deploy-key.guard.js';
import { DeployKeysController } from './deploy-keys.controller.js';
import { DeployKeysService } from './deploy-keys.service.js';

@Module({
  controllers: [DeployKeysController],
  providers: [DeployKeysService, DeployKeyGuard, ServerKeyGuard],
  exports: [DeployKeysService, DeployKeyGuard, ServerKeyGuard],
})
export class DeployKeysModule {}
