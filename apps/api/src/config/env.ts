import * as v from 'valibot';

const port = v.pipe(
  v.optional(v.string(), '3001'),
  v.transform(Number),
  v.integer(),
  v.minValue(1),
  v.maxValue(65535),
);

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
   * Where a game version is served. `{id}` and `{version}` are replaced, e.g.
   * `https://{id}.croffle-play.link/{version}/`. Must end with `/`.
   */
  /** Object storage (S3 API). Publishing is disabled until these are set. */
  S3_ENDPOINT: v.optional(v.pipe(v.string(), v.url())),
  /** Endpoint in presigned upload URLs (reachable by CI runners). Defaults to S3_ENDPOINT. */
  S3_PUBLIC_ENDPOINT: v.optional(v.pipe(v.string(), v.url())),
  S3_REGION: v.optional(v.string(), 'us-east-1'),
  S3_ACCESS_KEY_ID: v.optional(v.string()),
  S3_SECRET_ACCESS_KEY: v.optional(v.string()),
  S3_BUCKET: v.optional(v.string(), 'games'),
  /** Temporary admin credential (Bearer) until accounts and roles exist. ≥ 32 chars. */
  ADMIN_TOKEN: v.optional(v.pipe(v.string(), v.minLength(32))),
  GAME_URL_TEMPLATE: v.pipe(
    v.optional(v.string(), 'http://localhost:4100/{id}/{version}/'),
    v.check((t) => t.includes('{id}') && t.includes('{version}'), 'needs {id} and {version}'),
    v.endsWith('/'),
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
  if (env.NODE_ENV === 'production' && !env.GAME_URL_TEMPLATE.startsWith('https://')) {
    throw new Error('Invalid environment:\n  GAME_URL_TEMPLATE: must be https:// in production');
  }
  return env;
}
