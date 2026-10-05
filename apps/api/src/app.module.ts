import { type DynamicModule, Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import type { JWTVerifyGetKey } from 'jose';

import { AdminModule } from './admin/admin.module.js';
import type { ManifestFetcher } from './admin/manifest-fetcher.js';
import { ConfigModule } from './config/config.module.js';
import type { Env } from './config/env.js';
import type { Db } from './db/db.js';
import { DbModule } from './db/db.module.js';
import { GameServersModule } from './game-servers/game-servers.module.js';
import { GamesModule } from './games/games.module.js';
import { HealthController } from './health/health.controller.js';
import { MembersModule } from './members/members.module.js';
import type { Notifier } from './notify/notifier.js';
import { NotifyModule } from './notify/notify.module.js';
import { SavesModule } from './saves/saves.module.js';
import { ScoresModule } from './scores/scores.module.js';
import { SdkModule } from './sdk/sdk.module.js';
import { ServerKeysModule } from './server-keys/server-keys.module.js';
import type { Storage } from './storage/storage.js';
import { StorageModule } from './storage/storage.module.js';
import { TokensModule } from './tokens/tokens.module.js';
import { UsersModule } from './users/users.module.js';

export interface AppOptions {
  /** Validated env; parsed from `process.env` when omitted. */
  env?: Env;
  /** Pre-built database (tests); otherwise connects with `DATABASE_URL`. */
  db?: Db;
  /** Object storage (tests); otherwise S3 from env. */
  storage?: Storage;
  /** Access-token keys (tests); otherwise the IdP JWKS from env. */
  jwks?: JWTVerifyGetKey;
  /** Deprecation notices (tests); otherwise GitHub issues or logs, from env. */
  notifier?: Notifier;
  /** Reads games' `game.json` (tests); otherwise fetches it from the game origin. */
  fetchManifest?: ManifestFetcher;
}

@Module({})
export class AppModule {
  static forRoot(options: AppOptions = {}): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot(options.env),
        // Limits are set per route (common/rate-limit.ts); this is only the fallback window.
        ThrottlerModule.forRoot({ throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }] }),
        options.db ? DbModule.forDb(options.db) : DbModule.forRoot(),
        StorageModule.forRoot(options.storage),
        UsersModule.forRoot(options.jwks),
        GamesModule,
        ServerKeysModule,
        AdminModule.forRoot(options.fetchManifest),
        SdkModule,
        ScoresModule,
        SavesModule,
        TokensModule,
        GameServersModule,
        MembersModule,
        NotifyModule.forRoot(options.notifier),
      ],
      controllers: [HealthController],
    };
  }
}
