import { type DynamicModule, Global, Module } from '@nestjs/common';
import type { JWTVerifyGetKey } from 'jose';

import { JWKS, JwtVerifier, jwksFromEnv } from '../auth/jwt-verifier.js';
import { UserGuard } from '../auth/user.guard.js';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { AvatarsController } from './avatars.controller.js';
import { MeController } from './me.controller.js';
import { UsersService } from './users.service.js';

/** Accounts and player authentication; global so any module can use `UserGuard`. */
@Global()
@Module({})
export class UsersModule {
  static forRoot(jwks?: JWTVerifyGetKey): DynamicModule {
    return {
      module: UsersModule,
      controllers: [MeController, AvatarsController],
      providers: [
        jwks
          ? { provide: JWKS, useValue: jwks }
          : { provide: JWKS, inject: [ENV], useFactory: (env: Env) => jwksFromEnv(env) },
        JwtVerifier,
        UsersService,
        UserGuard,
      ],
      exports: [JwtVerifier, UsersService, UserGuard],
    };
  }
}
