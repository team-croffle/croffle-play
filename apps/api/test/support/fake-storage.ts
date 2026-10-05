import type { Storage, StoredFile } from '../../src/storage/storage.js';

/** In-memory storage. */
export class FakeStorage implements Storage {
  readonly objects = new Map<string, StoredFile & { cacheControl?: string }>();

  async put(key: string, file: StoredFile & { cacheControl?: string }): Promise<void> {
    this.objects.set(key, file);
  }

  async get(key: string): Promise<StoredFile | null> {
    return this.objects.get(key) ?? null;
  }
}
