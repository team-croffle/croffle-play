import {
  type DynamicModule,
  Global,
  Inject,
  Module,
  type OnApplicationShutdown,
} from '@nestjs/common';

import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { type Connection, connect } from './connect.js';
import { DB, type Db } from './db.js';

const CONNECTION = Symbol('CONNECTION');

@Global()
@Module({})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(CONNECTION) private readonly conn: Connection | null) {}

  /** Connects with `DATABASE_URL`; migrates unless `DB_MIGRATE=false`. */
  static forRoot(): DynamicModule {
    return {
      module: DbModule,
      providers: [
        { provide: CONNECTION, inject: [ENV], useFactory: (env: Env) => connect(env) },
        { provide: DB, inject: [CONNECTION], useFactory: (conn: Connection) => conn.db },
      ],
      exports: [DB],
    };
  }

  /** Uses an existing database (tests). The caller owns its lifecycle. */
  static forDb(db: Db): DynamicModule {
    return {
      module: DbModule,
      providers: [
        { provide: CONNECTION, useValue: null },
        { provide: DB, useValue: db },
      ],
      exports: [DB],
    };
  }

  async onApplicationShutdown(): Promise<void> {
    await this.conn?.close();
  }
}
