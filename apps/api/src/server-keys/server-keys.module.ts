import { Module } from '@nestjs/common';

import { ServerKeyGuard } from './server-key.guard.js';
import { ServerKeysController } from './server-keys.controller.js';
import { ServerKeysService } from './server-keys.service.js';

@Module({
  controllers: [ServerKeysController],
  providers: [ServerKeysService, ServerKeyGuard],
  exports: [ServerKeysService, ServerKeyGuard],
})
export class ServerKeysModule {}
