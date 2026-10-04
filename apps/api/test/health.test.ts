import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/bootstrap.js';
import { parseEnv } from '../src/config/env.js';

describe('GET /healthz', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createApp(parseEnv({ NODE_ENV: 'test' }));
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});

describe('parseEnv', () => {
  it('applies defaults', () => {
    expect(parseEnv({})).toMatchObject({ PORT: 3001, HOST: '0.0.0.0', NODE_ENV: 'development' });
  });

  it('lists invalid variables', () => {
    expect(() => parseEnv({ PORT: 'abc' })).toThrow(/PORT/);
  });
});
