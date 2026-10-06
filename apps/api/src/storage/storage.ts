/**
 * Object storage through the S3 API only (design invariant 8): platform-owned files (host
 * adapters, avatars) and the uploaded builds of platform-hosted games (`games/<id>/…`).
 */
export interface StoredFile {
  body: Uint8Array;
  contentType: string;
}

export interface StoredObject {
  key: string;
  size: number;
}

export interface Storage {
  put(key: string, file: StoredFile & { cacheControl?: string }): Promise<void>;
  /** Null when the object does not exist. */
  get(key: string): Promise<StoredFile | null>;
  /** Every object under `prefix` (all pages). */
  list(prefix: string): Promise<StoredObject[]>;
  /** Deletes the keys that exist; missing keys are not an error. */
  delete(keys: string[]): Promise<void>;
}

/** Injection token for `Storage`. */
export const STORAGE = Symbol('STORAGE');

/** For content-addressed or versioned objects that never change. */
export const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';
