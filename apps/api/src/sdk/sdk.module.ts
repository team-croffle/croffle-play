import { Module } from '@nestjs/common';

import { AdapterBootstrapService } from './adapter-bootstrap.service.js';
import { AdapterInstallService } from './adapter-install.service.js';
import { AdapterSyncService } from './adapter-sync.service.js';
import { AdaptersController } from './adapters.controller.js';
import { SdkLifecycleService } from './lifecycle.service.js';
import { NpmRegistry } from './npm-registry.js';
import { SdkAdminController } from './sdk-admin.controller.js';
import { SdkAdminService } from './sdk-admin.service.js';
import { SdkController } from './sdk.controller.js';
import { SdkService } from './sdk.service.js';

@Module({
  controllers: [SdkController, SdkAdminController, AdaptersController],
  providers: [
    SdkService,
    SdkLifecycleService,
    AdapterBootstrapService,
    SdkAdminService,
    NpmRegistry,
    AdapterInstallService,
    AdapterSyncService,
  ],
  exports: [
    SdkService,
    SdkLifecycleService,
    AdapterBootstrapService,
    AdapterInstallService,
    AdapterSyncService,
  ],
})
export class SdkModule {}
