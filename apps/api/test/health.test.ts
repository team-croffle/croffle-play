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

  it('checks the game URL template', () => {
    expect(() => parseEnv({ ...base, GAME_URL_TEMPLATE: 'https://x.test/' })).toThrow(/GAME_URL/);
    expect(() =>
      parseEnv({ ...base, NODE_ENV: 'production', GAME_URL_TEMPLATE: 'http://{id}.t/{version}/' }),
    ).toThrow(/GAME_URL_TEMPLATE: must be https/);
    expect(() =>
      parseEnv({ ...base, NODE_ENV: 'production', GAME_URL_TEMPLATE: 'https://{id}.t/{version}/' }),
    ).toThrow(/JWT_SIGNING_KEY/);
  });

  it('lists invalid variables', () => {
    expect(() => parseEnv({ ...base, PORT: 'abc' })).toThrow(/PORT/);
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });
});
