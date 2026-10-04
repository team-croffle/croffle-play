/**
 * `game.json` — the bundle contract (design invariant 9). Validated by `play-cli validate` in the
 * game's CI and again by the API on publish, with this same schema.
 */
import * as v from 'valibot';

/**
 * Subdomains the platform keeps for itself; never valid game ids. `srv` is taken by game servers
 * (`<id>.srv.<game domain>`).
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
  'preview',
  'srv',
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

/** `X.Y.Z` with an optional pre-release (`1.2.0-rc.1`). No build metadata: it is a URL path. */
export const semverSchema = v.pipe(
  v.string(),
  v.regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/),
  v.maxLength(64),
);

/** Path inside the bundle: relative, no `..`, no scheme, no backslashes. */
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
 * or null. A bundle is built against one SDK, so open or multi-major ranges are invalid.
 */
export function sdkRangeMajor(range: string): number | null {
  const m = /^(?:[\^~]?(\d+)\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?|(\d+)(?:\.(?:x|\*))?)$/.exec(
    range.trim(),
  );
  const major = m?.[1] ?? m?.[2];
  return major === undefined ? null : Number(major);
}

export const gameManifestSchema = v.object({
  id: gameIdSchema,
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(60)),
  version: semverSchema,
  entry: v.optional(relativePathSchema, 'index.html'),
  thumbnail: relativePathSchema,
  sdk: v.pipe(
    v.string(),
    v.check((r) => sdkRangeMajor(r) !== null, 'sdk must target one major, e.g. "^1.2.0"'),
  ),
  needsServer: v.optional(v.boolean(), false),
  orientation: v.optional(v.picklist(['landscape', 'portrait', 'any']), 'any'),
  server: v.optional(
    v.object({
      /** Version of the client↔server protocol this build speaks. */
      protocol: semverSchema,
    }),
  ),
});

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
