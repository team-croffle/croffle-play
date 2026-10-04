import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

import { type AppOptions, AppModule } from './app.module.js';

/** Builds the application without listening. Shared by `main.ts` and tests. */
export async function createApp(options: AppOptions = {}): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.forRoot(options),
    new FastifyAdapter({ trustProxy: true }),
    options.env?.NODE_ENV === 'test' ? { logger: false } : { bufferLogs: true },
  );
  // Everything is versioned under /v1 except probes.
  app.setGlobalPrefix('v1', { exclude: ['healthz'] });
  app.enableShutdownHooks();
  return app;
}
