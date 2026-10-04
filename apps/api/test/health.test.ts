import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { parseEnv } from '../src/config/env.js';
import { createTestApp, type TestApp } from './support/test-app.js';

describe('GET /healthz', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.close();
  });

  it('returns ok when the database answers', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});

describe('parseEnv', () => {
  const base = { DATABASE_URL: 'postgres://u@h/db' };

  it('applies defaults', () => {
    expect(parseEnv(base)).toMatchObject({
      PORT: 3001,
      HOST: '0.0.0.0',
      NODE_ENV: 'development',
      DB_MIGRATE: true,
      DB_POOL_SIZE: 10,
    });
  });

  it('lists invalid variables', () => {
    expect(() => parseEnv({ ...base, PORT: 'abc' })).toThrow(/PORT/);
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });
});
