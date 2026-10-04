import { describe, expect, it } from 'vitest';

import { helloSchema, parseHello, parseWelcome, sdkMajor, welcomeSchema } from '../src/index.js';

// The handshake is frozen (design invariant 5). These tests pin its exact shape: if one fails,
// the change is wrong, not the test.
describe('frozen handshake', () => {
  it('hello has exactly type, sdk, game', () => {
    expect(Object.keys(helloSchema.entries).toSorted()).toEqual(['game', 'sdk', 'type']);
    expect(parseHello({ type: '__hello', sdk: '1.0.0', game: 'tetris' })).toEqual({
      type: '__hello',
      sdk: '1.0.0',
      game: 'tetris',
    });
  });

  it('welcome has exactly type, capabilities', () => {
    expect(Object.keys(welcomeSchema.entries).toSorted()).toEqual(['capabilities', 'type']);
    expect(parseWelcome({ type: '__welcome', capabilities: ['score'] })).toEqual({
      type: '__welcome',
      capabilities: ['score'],
    });
  });

  it('ignores unknown extra fields instead of failing', () => {
    expect(parseHello({ type: '__hello', sdk: '9.0.0', game: 'x', extra: 1 })).not.toBeNull();
  });

  it('rejects malformed messages', () => {
    expect(parseHello({ type: '__hello', sdk: 1, game: 'x' })).toBeNull();
    expect(parseHello('__hello')).toBeNull();
    expect(parseWelcome({ type: '__welcome' })).toBeNull();
  });
});

describe('sdkMajor', () => {
  it.each([
    ['1.0.0', 1],
    ['12.3.4', 12],
    ['2.0.0-beta.1', 2],
    ['1.2', null],
    ['v1.0.0', null],
  ])('%s → %s', (input, major) => {
    expect(sdkMajor(input)).toBe(major);
  });
});
