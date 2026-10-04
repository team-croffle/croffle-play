import { type DynamicModule, Global, Module } from '@nestjs/common';

import { type Env, parseEnv } from './env.js';

/** Injection token for the validated environment (`Env`). */
export const ENV = Symbol('ENV');

@Global()
@Module({})
export class ConfigModule {
  static forRoot(env?: Env): DynamicModule {
    return {
      module: ConfigModule,
      providers: [{ provide: ENV, useFactory: () => env ?? parseEnv(process.env) }],
      exports: [ENV],
    };
  }
}
