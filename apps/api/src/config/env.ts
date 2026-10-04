import * as v from 'valibot';

const port = v.pipe(
  v.optional(v.string(), '3001'),
  v.transform(Number),
  v.integer(),
  v.minValue(1),
  v.maxValue(65535),
);

export const envSchema = v.object({
  NODE_ENV: v.optional(v.picklist(['development', 'test', 'production']), 'development'),
  HOST: v.optional(v.string(), '0.0.0.0'),
  PORT: port,
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
  return result.output;
}
