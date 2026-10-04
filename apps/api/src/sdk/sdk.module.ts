import { Module } from '@nestjs/common';

import { SdkLifecycleService } from './lifecycle.service.js';
import { SdkAdminController } from './sdk-admin.controller.js';
import { SdkController } from './sdk.controller.js';
import { SdkService } from './sdk.service.js';

@Module({
  controllers: [SdkController, SdkAdminController],
  providers: [SdkService, SdkLifecycleService],
  exports: [SdkService, SdkLifecycleService],
})
export class SdkModule {}
