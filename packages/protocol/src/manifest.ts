/**
 * `game.json` — what a game tells the platform about itself (design invariant 9). The game serves it
 * at `<game origin>/game.json`; the portal reads it when the game is registered or refreshed, and
 * `play-cli validate` / `check` use this same schema.
 */
import * as v from 'valibot';

/**
 * Names never used as game ids: a game lives at `<id>.<games host>` (e.g. `<id>.play.croffle-play.link`),
 * and these would read like platform hosts.
 */
export const RESERVED_GAME_IDS = [
  'www',
  'api',
  'admin',
  'cdn',
  'play',
  'rooms',
  'auth',
  'static',
] as const;

/** DNS label: lowercase letters, digits, inner hyphens; 1–32 chars. */
export const GAME_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;

export const gameIdSchema = v.pipe(
  v.string(),
  v.regex(GAME_ID_PATTERN, 'Game id must be 1–32 lowercase letters, digits, or inner hyphens'),
  v.check(
    (id) => !(RESERVED_GAME_IDS as readonly string[]).includes(id),
    'Game id is reserved by the platform',
  ),
);

export function isValidGameId(id: string): boolean {
  return v.is(gameIdSchema, id);
}

/** `X.Y.Z` with an optional pre-release (`1.2.0-rc.1`). */
export const semverSchema = v.pipe(
  v.string(),
  v.regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/),
  v.maxLength(64),
);

/** Path inside the game site: relative, no `..`, no scheme, no backslashes. */
export const relativePathSchema = v.pipe(
  v.string(),
  v.minLength(1),
  v.maxLength(255),
  v.check(isRelativePath, 'Must be a relative path inside the bundle'),
);

export function isRelativePath(p: string): boolean {
  return (
    !p.startsWith('/') &&
    !p.includes('\\') &&
    !/^[a-z][a-z0-9+.-]*:/i.test(p) &&
    !p.split('/').some((seg) => seg === '..' || seg === '.' || seg === '')
  );
}

/**
 * Major of an SDK range that targets exactly one major (`^1.2.0`, `~1.2.0`, `1.2.0`, `1.x`, `1`),
 * or null. A game is built against one SDK, so open or multi-major ranges are invalid.
 */
export function sdkRangeMajor(range: string): number | null {
  const m = /^(?:[\^~]?(\d+)\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?|(\d+)(?:\.(?:x|\*))?)$/.exec(
    range.trim(),
  );
  const major = m?.[1] ?? m?.[2];
  return major === undefined ? null : Number(major);
}

/** Recommended catalog thumbnail (the portal shows `<game origin>/<thumbnail>`; play-cli warns). */
export const THUMBNAIL = {
  maxBytes: 512 * 1024,
  minWidth: 256,
  minHeight: 144,
  extensions: ['png', 'jpg', 'jpeg', 'webp'],
} as const;

/**
 * Address of a game's own server (hosted by the team, anywhere): https or wss, or plain http/ws on
 * localhost for development. It verifies players with the platform's game tokens (JWKS).
 */
export const serverUrlSchema = v.pipe(
  v.string(),
  v.url(),
  v.maxLength(255),
  v.check(
    (u) =>
      /^(https|wss):\/\//.test(u) || /^(http|ws):\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(u),
    'server.url must be https:// or wss:// (http/ws only on localhost)',
  ),
);

const manifestObject = v.object({
  id: gameIdSchema,
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(60)),
  /** The game's own version, for information only (the platform does not track versions). */
  version: v.optional(semverSchema),
  /** Entry document, relative to the game origin. */
  entry: v.optional(relativePathSchema, 'index.html'),
  thumbnail: v.optional(relativePathSchema),
  sdk: v.pipe(
    v.string(),
    v.check((r) => sdkRangeMajor(r) !== null, 'sdk must target one major, e.g. "^1.2.0"'),
  ),
  orientation: v.optional(v.picklist(['landscape', 'portrait', 'any']), 'any'),
  /** The game's own server, if it has one (`sdk.getServerInfo()` returns it). */
  server: v.optional(
    v.object({
      url: serverUrlSchema,
      /** Version of the client↔server protocol this build speaks. */
      protocol: semverSchema,
    }),
  ),
});

export const gameManifestSchema = manifestObject;

export type GameManifest = v.InferOutput<typeof gameManifestSchema>;
export type GameManifestInput = v.InferInput<typeof gameManifestSchema>;

export interface ManifestIssue {
  path: string;
  message: string;
}

export function parseManifest(
  input: unknown,
): { ok: true; manifest: GameManifest } | { ok: false; issues: ManifestIssue[] } {
  const r = v.safeParse(gameManifestSchema, input);
  if (r.success) {
    return { ok: true, manifest: r.output };
  }
  return {
    ok: false,
    issues: r.issues.map((i) => ({
      path: i.path?.map((p) => String(p.key)).join('.') ?? '',
      message: i.message,
    })),
  };
}
