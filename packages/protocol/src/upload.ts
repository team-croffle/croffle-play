/**
 * Limits on a game build uploaded as a zip for platform hosting. The API enforces them (its
 * operator may raise them with env) and `play-cli pack` checks a build against them first.
 */
export const UPLOAD_LIMITS = {
  /** The zip file itself. */
  maxZipBytes: 100 * 1024 * 1024,
  /** Every file, extracted. */
  maxTotalBytes: 300 * 1024 * 1024,
  maxFiles: 2000,
  maxFileBytes: 50 * 1024 * 1024,
  /** Path of a file inside the zip (`a/b/c.js`). */
  maxPathLength: 255,
} as const;

export type UploadLimits = { -readonly [K in keyof typeof UPLOAD_LIMITS]: number };
