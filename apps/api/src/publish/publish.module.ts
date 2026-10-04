import { Module } from '@nestjs/common';

import { DeployKeysModule } from '../deploy-keys/deploy-keys.module.js';
import { SdkModule } from '../sdk/sdk.module.js';
import { PublishController } from './publish.controller.js';
import { PublishService } from './publish.service.js';

@Module({
  imports: [DeployKeysModule, SdkModule],
  controllers: [PublishController],
  providers: [PublishService],
})
export class PublishModule {}
