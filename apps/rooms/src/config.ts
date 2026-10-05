import * as v from 'valibot';

const port = v.pipe(
  v.optional(v.string(), '3002'),
  v.transform(Number),
  v.integer(),
  v.minValue(1),
);

export const configSchema = v.object({
  NODE_ENV: v.optional(v.picklist(['development', 'test', 'production']), 'development'),
  HOST: v.optional(v.string(), '0.0.0.0'),
  PORT: port,
  /** Platform JWKS (game tokens). */
  JWKS_URL: v.optional(v.pipe(v.string(), v.url()), 'http://localhost:3001/.well-known/jwks.json'),
  /** Expected `iss` of game tokens (the API's PUBLIC_API_ORIGIN). */
  TOKEN_ISSUER: v.optional(v.string(), 'http://localhost:3001'),
  /** Origin a game frame has, `{id}` replaced: https://{id}.play.croffle-play.link */
  ALLOWED_ORIGIN_TEMPLATE: v.pipe(
    v.optional(v.string(), 'http://{id}.localhost:4100'),
    v.includes('{id}'),
  ),
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
  if (
    r.output.NODE_ENV === 'production' &&
    !r.output.ALLOWED_ORIGIN_TEMPLATE.startsWith('https://')
  ) {
    throw new Error(
      'Invalid environment:\n  ALLOWED_ORIGIN_TEMPLATE: must be https:// in production',
    );
  }
  return r.output;
}

export function allowedOrigin(template: string, gameId: string): string {
  return template.replaceAll('{id}', gameId);
}
