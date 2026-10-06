import { UPLOAD_LIMITS } from '@croffledev/play-protocol';
import * as v from 'valibot';

const port = v.pipe(
  v.optional(v.string(), '3001'),
  v.transform(Number),
  v.integer(),
  v.minValue(1),
  v.maxValue(65535),
);

const bytes = (fallback: number) =>
  v.pipe(v.optional(v.string(), String(fallback)), v.transform(Number), v.integer(), v.minValue(1));

const bool = (fallback: 'true' | 'false') =>
  v.pipe(
    v.optional(v.picklist(['true', 'false']), fallback),
    v.transform((x) => x === 'true'),
  );

export const envSchema = v.object({
  NODE_ENV: v.optional(v.picklist(['development', 'test', 'production']), 'development'),
  HOST: v.optional(v.string(), '0.0.0.0'),
  PORT: port,
  DATABASE_URL: v.pipe(v.string(), v.url()),
  DB_POOL_SIZE: v.pipe(
    v.optional(v.string(), '10'),
    v.transform(Number),
    v.integer(),
    v.minValue(1),
  ),
  DB_MIGRATE: bool('true'),
  /** Insert the dummy catalog on boot (development only). */
  DB_SEED: bool('false'),
  /** With DB_SEED: register this adapter manifest as SDK v1 (e.g. from `pnpm dev:games`). */
  SEED_ADAPTER_MANIFEST_URL: v.optional(v.pipe(v.string(), v.url())),
  /**
   * Origin of every game, `{id}` replaced, e.g. `https://{id}.play.croffle-play.link`. Games are hosted
   * by their teams; the portal frames `<origin>/<entry>` and reads `<origin>/game.json`.
   */
  GAME_ORIGIN_TEMPLATE: v.pipe(
    v.optional(v.string(), 'http://{id}.localhost:4100'),
    v.includes('{id}'),
    v.check((t) => !t.slice(t.indexOf('//') + 2).includes('/'), 'must be an origin (no path)'),
  ),
  /** How long registering or refreshing a game waits for its `game.json`. */
  GAME_MANIFEST_TIMEOUT_MS: v.pipe(
    v.optional(v.string(), '5000'),
    v.transform(Number),
    v.integer(),
    v.minValue(100),
  ),
  /** Object storage (S3 API) for platform-owned files. Disabled until these are set. */
  S3_ENDPOINT: v.optional(v.pipe(v.string(), v.url())),
  S3_REGION: v.optional(v.string(), 'us-east-1'),
  S3_ACCESS_KEY_ID: v.optional(v.string()),
  S3_SECRET_ACCESS_KEY: v.optional(v.string()),
  /** One bucket for platform-owned files, by prefix: `adapters/`, `avatars/`. */
  S3_BUCKET: v.optional(v.string(), 'croffle-play'),
  /** OIDC issuer of player access tokens (Logto: https://auth.…/oidc). Sign-in is off without it. */
  OIDC_ISSUER: v.optional(v.pipe(v.string(), v.url())),
  /** API resource indicator; the `aud` of access tokens. */
  OIDC_AUDIENCE: v.optional(v.string()),
  /** IdP subjects promoted to admin when they sign in (comma-separated; never demotes). */
  ADMIN_SUBS: v.pipe(
    v.optional(v.string(), ''),
    v.transform((s) =>
      s
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  ),
  /** JWKS location when not `<issuer>/jwks` (e.g. an internal URL). */
  OIDC_JWKS_URL: v.optional(v.pipe(v.string(), v.url())),
  /**
   * ES256 private key (PKCS8 PEM; `\n` escapes allowed) signing game tokens. Required in
   * production; development generates a throwaway key.
   */
  JWT_SIGNING_KEY: v.optional(v.string()),
  JWT_KEY_ID: v.optional(v.string(), 'game-1'),
  /** This API's public origin: the `iss` of game tokens (e.g. https://api.croffle-play.link). */
  PUBLIC_API_ORIGIN: v.optional(v.pipe(v.string(), v.url()), 'http://localhost:3001'),
  /** Lifetime of game tokens (`aud: game:<id>`), 60–900 s. */
  GAME_TOKEN_TTL_SECONDS: v.pipe(
    v.optional(v.string(), '600'),
    v.transform(Number),
    v.integer(),
    v.minValue(60),
    v.maxValue(900),
  ),
  /** Linked from refused registrations and warnings about old SDK majors. */
  SDK_MIGRATION_GUIDE_URL: v.optional(
    v.pipe(v.string(), v.url()),
    'https://github.com/team-croffle/croffle-play/blob/master/docs/sdk-lifecycle.md',
  ),
  /**
   * Fine-grained GitHub token (Issues: write on the team's game repositories) for deprecation
   * notices. Without it notices are only logged.
   */
  GITHUB_NOTIFY_TOKEN: v.optional(v.string()),
  GITHUB_API_URL: v.optional(v.pipe(v.string(), v.url()), 'https://api.github.com'),
  /** Per-player / per-key request limits on write routes (`false` only for tests). */
  RATE_LIMITS: bool('true'),
  /** Platform hosting: limits on an uploaded game build (defaults from `UPLOAD_LIMITS`). */
  UPLOAD_MAX_ZIP_BYTES: bytes(UPLOAD_LIMITS.maxZipBytes),
  UPLOAD_MAX_TOTAL_BYTES: bytes(UPLOAD_LIMITS.maxTotalBytes),
  UPLOAD_MAX_FILES: bytes(UPLOAD_LIMITS.maxFiles),
  UPLOAD_MAX_FILE_BYTES: bytes(UPLOAD_LIMITS.maxFileBytes),
  /** How often the SDK lifecycle sync runs (seconds); 0 disables it. */
  SDK_LIFECYCLE_INTERVAL_SECONDS: v.pipe(
    v.optional(v.string(), '3600'),
    v.transform(Number),
    v.integer(),
    v.minValue(0),
  ),
});

export type Env = v.InferOutput<typeof envSchema>;

/** Parses `process.env`-like input. Throws one error listing every invalid variable. */
export function parseEnv(input: Record<string, string | undefined>): Env {
  const result = v.safeParse(envSchema, input);
  if (!result.success) {
    const lines = result.issues.map((issue) => {
      const key = issue.path?.map((p) => String(p.key)).join('.') ?? '(root)';
      return `  ${key}: ${issue.message}`;
    });
    throw new Error(`Invalid environment:\n${lines.join('\n')}`);
  }
  const env = result.output;
  if (env.NODE_ENV === 'production') {
    const problems = [
      !env.GAME_ORIGIN_TEMPLATE.startsWith('https://') && 'GAME_ORIGIN_TEMPLATE: must be https://',
      !env.PUBLIC_API_ORIGIN.startsWith('https://') && 'PUBLIC_API_ORIGIN: must be https://',
      !env.JWT_SIGNING_KEY && 'JWT_SIGNING_KEY: required in production',
    ].filter(Boolean);
    if (problems.length > 0) {
      throw new Error(`Invalid environment:\n${problems.map((p) => `  ${p}`).join('\n')}`);
    }
  }
  return env;
}
