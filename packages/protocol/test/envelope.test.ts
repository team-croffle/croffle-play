import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import {
  capabilities,
  event,
  fail,
  isRequestType,
  ok,
  parseEnvelope,
  request,
  requests,
  requiredCapability,
} from '../src/index.js';

describe('envelope', () => {
  it('round-trips each kind', () => {
    for (const msg of [
      request('1', 'submitScore', { score: 10 }),
      ok('1', { accepted: true }),
      fail('1', { code: 'auth_required', message: 'sign in' }),
      event('pause'),
    ]) {
      expect(parseEnvelope(structuredClone(msg))).toEqual(msg);
    }
  });

  it('ignores foreign messages', () => {
    expect(parseEnvelope({ type: 'webpackOk' })).toBeNull();
    expect(parseEnvelope({ ns: 'croffle-play', v: 2, kind: 'req', id: '1', type: 'x' })).toBeNull();
    expect(parseEnvelope(null)).toBeNull();
  });

  it('rejects a failed response without an error', () => {
    expect(parseEnvelope({ ns: 'croffle-play', v: 1, kind: 'res', id: '1', ok: false })).toBeNull();
  });
});

describe('v1 messages', () => {
  it('validates payloads', () => {
    expect(v.is(requests.submitScore.request, { score: 3.5 })).toBe(true);
    expect(v.is(requests.submitScore.request, { score: Number.NaN })).toBe(false);
    expect(v.is(requests.save.request, { slot: 'main', data: '{}' })).toBe(true);
    expect(v.is(requests.save.request, { slot: 'Bad Slot', data: '' })).toBe(false);
    expect(v.is(requests.ready.request, undefined)).toBe(true);
  });

  it('maps every request to a known capability or none', () => {
    for (const type of Object.keys(requests)) {
      expect(isRequestType(type)).toBe(true);
      const cap = requiredCapability[type as keyof typeof requests];
      expect(cap === null || capabilities.includes(cap)).toBe(true);
    }
    expect(isRequestType('toString')).toBe(false);
  });
});
