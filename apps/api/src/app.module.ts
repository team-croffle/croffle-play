import { type DynamicModule, Module } from '@nestjs/common';

import { ConfigModule } from './config/config.module.js';
import type { Env } from './config/env.js';
import type { Db } from './db/db.js';
import { DbModule } from './db/db.module.js';
import { GamesModule } from './games/games.module.js';
import { HealthController } from './health/health.controller.js';

export interface AppOptions {
  /** Validated env; parsed from `process.env` when omitted. */
  env?: Env;
  /** Pre-built database (tests); otherwise connects with `DATABASE_URL`. */
  db?: Db;
}

@Module({})
export class AppModule {
  static forRoot(options: AppOptions = {}): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot(options.env),
        options.db ? DbModule.forDb(options.db) : DbModule.forRoot(),
        GamesModule,
      ],
      controllers: [HealthController],
    };
  }
}
