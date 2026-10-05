import { Module } from '@nestjs/common';

import { AdaptersController } from './adapters.controller.js';
import { SdkLifecycleService } from './lifecycle.service.js';
import { SdkAdminController } from './sdk-admin.controller.js';
import { SdkController } from './sdk.controller.js';
import { SdkService } from './sdk.service.js';

@Module({
  controllers: [SdkController, SdkAdminController, AdaptersController],
  providers: [SdkService, SdkLifecycleService],
  exports: [SdkService, SdkLifecycleService],
})
export class SdkModule {}
