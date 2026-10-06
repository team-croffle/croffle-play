import * as v from 'valibot';

const port = v.pipe(
  v.optional(v.string(), '3003'),
  v.transform(Number),
  v.integer(),
  v.minValue(1),
);

const positive = (fallback: number) =>
  v.pipe(v.optional(v.string(), String(fallback)), v.transform(Number), v.integer(), v.minValue(1));

export const configSchema = v.object({
  NODE_ENV: v.optional(v.picklist(['development', 'test', 'production']), 'development'),
  HOST: v.optional(v.string(), '0.0.0.0'),
  PORT: port,
  /** Origin of every game, `{id}` replaced — the same template the api and the portal use. */
  GAME_ORIGIN_TEMPLATE: v.pipe(
    v.optional(v.string(), 'http://{id}.localhost:3003'),
    v.includes('{id}'),
    v.check((t) => !t.slice(t.indexOf('//') + 2).includes('/'), 'must be an origin (no path)'),
  ),
  /** The portal, the only origin allowed to frame a game (`frame-ancestors`). */
  PORTAL_ORIGIN: v.optional(v.pipe(v.string(), v.url()), 'http://localhost:3000'),
  /** Object storage (S3 API), the api's bucket. */
  S3_ENDPOINT: v.pipe(v.string(), v.url()),
  S3_REGION: v.optional(v.string(), 'us-east-1'),
  S3_ACCESS_KEY_ID: v.string(),
  S3_SECRET_ACCESS_KEY: v.string(),
  S3_BUCKET: v.optional(v.string(), 'croffle-play'),
  /** How long the active-deploy pointer of a game is remembered (seconds). */
  POINTER_TTL_SECONDS: positive(10),
  /** In-memory file cache, total bytes. */
  CACHE_MAX_BYTES: positive(64 * 1024 * 1024),
  /** `max-age` of files other than the entry document and `game.json` (seconds). */
  FILE_MAX_AGE_SECONDS: positive(300),
});

export type Config = v.InferOutput<typeof configSchema>;

export function parseConfig(input: Record<string, string | undefined>): Config {
  const r = v.safeParse(configSchema, input);
  if (!r.success) {
    const lines = r.issues.map(
      (i) => `  ${i.path?.map((p) => String(p.key)).join('.')}: ${i.message}`,
    );
    throw new Error(`Invalid environment:\n${lines.join('\n')}`);
  }
  if (r.output.NODE_ENV === 'production') {
    const problems = [
      !r.output.GAME_ORIGIN_TEMPLATE.startsWith('https://') &&
        'GAME_ORIGIN_TEMPLATE: must be https://',
      !r.output.PORTAL_ORIGIN.startsWith('https://') && 'PORTAL_ORIGIN: must be https://',
    ].filter(Boolean);
    if (problems.length > 0) {
      throw new Error(`Invalid environment:\n${problems.map((p) => `  ${p}`).join('\n')}`);
    }
  }
  return r.output;
}
