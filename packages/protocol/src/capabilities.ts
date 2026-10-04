import type { RequestType } from './v1/messages.js';

/**
 * Capability names announced in `__welcome`. A game checks `sdk.has(name)` instead of comparing
 * versions (design invariant 5). Names are never reused for a different meaning.
 */
export const capabilities = [
  'user',
  'score',
  'save',
  'fullscreen',
  'exit',
  'leaderboard',
  'token',
  'rooms',
] as const;

export type Capability = (typeof capabilities)[number];

/** Capability a request needs; `null` for requests every host must answer. */
export const requiredCapability: Record<RequestType, Capability | null> = {
  ready: null,
  getUser: 'user',
  submitScore: 'score',
  save: 'save',
  load: 'save',
  exit: 'exit',
  fullscreen: 'fullscreen',
  getLeaderboard: 'leaderboard',
  getToken: 'token',
  getRoomsUrl: 'rooms',
};
