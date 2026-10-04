/**
 * The handshake — the ONLY frozen part of the protocol (AGENTS.md, design invariant 5).
 *
 * Every SDK major, past and future, opens with exactly these two messages. Never add, rename, or
 * remove a field here: a game built years ago must still be able to say hello. Everything after the
 * handshake is versioned by SDK major (see `./v1`).
 */
import * as v from 'valibot';

/** Game → shell. `sdk` is the SDK version the game was built with, `game` its id. */
export interface Hello {
  type: '__hello';
  sdk: string;
  game: string;
}

/** Shell → game. Features available to this game, for `sdk.has(name)`. */
export interface Welcome {
  type: '__welcome';
  capabilities: string[];
}

export const helloSchema = v.object({
  type: v.literal('__hello'),
  sdk: v.pipe(v.string(), v.maxLength(64)),
  game: v.pipe(v.string(), v.maxLength(64)),
});

export const welcomeSchema = v.object({
  type: v.literal('__welcome'),
  capabilities: v.array(v.pipe(v.string(), v.maxLength(64))),
});

export function parseHello(input: unknown): Hello | null {
  const r = v.safeParse(helloSchema, input);
  return r.success ? r.output : null;
}

export function parseWelcome(input: unknown): Welcome | null {
  const r = v.safeParse(welcomeSchema, input);
  return r.success ? r.output : null;
}

/** Major of a semver version (`'2.3.1'` → 2), or null when it is not `X.Y.Z…`. */
export function sdkMajor(version: string): number | null {
  const m = /^(\d+)\.\d+\.\d+(?:[-+].*)?$/.exec(version);
  return m ? Number(m[1]) : null;
}
