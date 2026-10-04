import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

import { AppModule } from './app.module.js';
import type { Env } from './config/env.js';

/** Builds the application without listening. Shared by `main.ts` and tests. */
export async function createApp(env?: Env): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.forRoot(env),
    new FastifyAdapter({ trustProxy: true }),
    env?.NODE_ENV === 'test' ? { logger: false } : { bufferLogs: true },
  );
  app.enableShutdownHooks();
  return app;
}
