import { type DynamicModule, Global, Module } from '@nestjs/common';

import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { storageFromEnv } from './s3-storage.js';
import { STORAGE, type Storage } from './storage.js';

@Global()
@Module({})
export class StorageModule {
  /** S3 from env, or `storage` when given (tests). */
  static forRoot(storage?: Storage): DynamicModule {
    return {
      module: StorageModule,
      providers: [
        storage
          ? { provide: STORAGE, useValue: storage }
          : { provide: STORAGE, inject: [ENV], useFactory: (env: Env) => storageFromEnv(env) },
      ],
      exports: [STORAGE],
    };
  }
}
