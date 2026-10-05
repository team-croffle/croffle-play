/**
 * Object storage for platform-owned files (host adapters, later avatars), through the S3 API only
 * (design invariant 8). Games are hosted by their teams and never stored here.
 */
export interface StoredFile {
  body: Uint8Array;
  contentType: string;
}

export interface Storage {
  put(key: string, file: StoredFile & { cacheControl?: string }): Promise<void>;
  /** Null when the object does not exist. */
  get(key: string): Promise<StoredFile | null>;
}

/** Injection token for `Storage`. */
export const STORAGE = Symbol('STORAGE');

/** For content-addressed or versioned objects that never change. */
export const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';
