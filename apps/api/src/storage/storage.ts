/** Object storage, through the S3 API only (design invariant 8). */
export interface PutTarget {
  key: string;
  contentType: string;
  contentLength: number;
  /** Base64 SHA-256; the storage refuses an upload whose body does not match. */
  sha256: string;
  contentEncoding?: string;
}

export interface PresignedUpload {
  url: string;
  method: 'PUT';
  /** Headers the uploader must send verbatim (they are part of the signature). */
  headers: Record<string, string>;
}

export interface StoredObject {
  size: number;
  /** Base64 SHA-256 recorded at upload, when available. */
  sha256: string | null;
}

export interface Storage {
  presignPut(target: PutTarget, expiresInSeconds: number): Promise<PresignedUpload>;
  head(key: string): Promise<StoredObject | null>;
}

/** Injection token for `Storage`. */
export const STORAGE = Symbol('STORAGE');

/** Game bundles are written once and served forever. */
export const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';
