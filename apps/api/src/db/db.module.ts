import {
  type DynamicModule,
  Global,
  Inject,
  Module,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { DB, type Db, migrationsFolder } from './db.js';
import { schema } from './schema.js';

const SQL = Symbol('SQL');

@Global()
@Module({})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(SQL) private readonly sql: postgres.Sql | null) {}

  /** Connects with `DATABASE_URL` and applies migrations unless `DB_MIGRATE=false`. */
  static forRoot(): DynamicModule {
    return {
      module: DbModule,
      providers: [
        {
          provide: SQL,
          inject: [ENV],
          useFactory: (env: Env) => postgres(env.DATABASE_URL, { max: env.DB_POOL_SIZE }),
        },
        {
          provide: DB,
          inject: [SQL, ENV],
          useFactory: async (sql: postgres.Sql, env: Env) => {
            const db = drizzle(sql, { schema });
            if (env.DB_MIGRATE) {
              await migrate(db, { migrationsFolder });
            }
            return db;
          },
        },
      ],
      exports: [DB],
    };
  }

  /** Uses an existing database (tests). The caller owns its lifecycle. */
  static forDb(db: Db): DynamicModule {
    return {
      module: DbModule,
      providers: [
        { provide: SQL, useValue: null },
        { provide: DB, useValue: db },
      ],
      exports: [DB],
    };
  }

  async onApplicationShutdown(): Promise<void> {
    await this.sql?.end({ timeout: 5 });
  }
}
