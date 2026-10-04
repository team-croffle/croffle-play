import { relativePathSchema } from '@croffledev/play-protocol';
import * as v from 'valibot';

/** Default bundle size limit (docs/ARCHITECTURE.md §5). Larger bundles need admin approval. */
export const DEFAULT_MAX_BUNDLE_BYTES = 30 * 1024 * 1024;
export const MAX_FILES = 2000;
/** Lifetime of presigned upload URLs. */
export const UPLOAD_URL_TTL_SECONDS = 15 * 60;

export const bundleFileSchema = v.object({
  path: relativePathSchema,
  size: v.pipe(v.number(), v.integer(), v.minValue(0)),
  sha256: v.pipe(v.string(), v.regex(/^[A-Za-z0-9+/]{43}=$/, 'sha256 must be base64 SHA-256')),
  contentType: v.optional(v.pipe(v.string(), v.maxLength(100))),
  contentEncoding: v.optional(v.picklist(['br', 'gzip'])),
});

export const createVersionSchema = v.object({
  manifest: v.unknown(),
  files: v.pipe(v.array(bundleFileSchema), v.minLength(1), v.maxLength(MAX_FILES)),
});

export type CreateVersionBody = v.InferOutput<typeof createVersionSchema>;
