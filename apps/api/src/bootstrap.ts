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
  // Everything is versioned under /v1 except probes and well-known documents.
  app.setGlobalPrefix('v1', { exclude: ['healthz', '.well-known/jwks.json'] });
  app.enableShutdownHooks();
  // A JSON API: nothing to render, frame, or sniff. No CORS — browsers reach it only through the
  // shell server (BFF), so cross-origin calls from pages are refused by default.
  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onSend', async (req, reply) => {
      reply.header('x-content-type-options', 'nosniff');
      reply.header('referrer-policy', 'no-referrer');
      reply.header('content-security-policy', "default-src 'none'; frame-ancestors 'none'");
      if (req.headers.authorization && !reply.hasHeader('cache-control')) {
        reply.header('cache-control', 'no-store');
      }
    });
  return app;
}
