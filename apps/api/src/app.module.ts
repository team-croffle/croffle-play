import { type DynamicModule, Module } from '@nestjs/common';

import { ConfigModule } from './config/config.module.js';
import type { Env } from './config/env.js';
import { HealthController } from './health/health.controller.js';

@Module({})
export class AppModule {
  static forRoot(env?: Env): DynamicModule {
    return {
      module: AppModule,
      imports: [ConfigModule.forRoot(env)],
      controllers: [HealthController],
    };
  }
}
