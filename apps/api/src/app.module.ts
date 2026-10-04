import { type DynamicModule, Module } from '@nestjs/common';

import { AdminModule } from './admin/admin.module.js';
import { ConfigModule } from './config/config.module.js';
import type { Env } from './config/env.js';
import type { Db } from './db/db.js';
import { DbModule } from './db/db.module.js';
import { DeployKeysModule } from './deploy-keys/deploy-keys.module.js';
import { GamesModule } from './games/games.module.js';
import { HealthController } from './health/health.controller.js';
import { PublishModule } from './publish/publish.module.js';
import { ScoresModule } from './scores/scores.module.js';
import { SdkModule } from './sdk/sdk.module.js';
import type { Storage } from './storage/storage.js';
import { StorageModule } from './storage/storage.module.js';

export interface AppOptions {
  /** Validated env; parsed from `process.env` when omitted. */
  env?: Env;
  /** Pre-built database (tests); otherwise connects with `DATABASE_URL`. */
  db?: Db;
  /** Object storage (tests); otherwise S3 from env. */
  storage?: Storage;
}

@Module({})
export class AppModule {
  static forRoot(options: AppOptions = {}): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot(options.env),
        options.db ? DbModule.forDb(options.db) : DbModule.forRoot(),
        StorageModule.forRoot(options.storage),
        GamesModule,
        DeployKeysModule,
        PublishModule,
        AdminModule,
        SdkModule,
        ScoresModule,
      ],
      controllers: [HealthController],
    };
  }
}
