import type { Storage, StoredFile, StoredObject } from '../../src/storage/storage.js';

/** In-memory storage. */
export class FakeStorage implements Storage {
  readonly objects = new Map<string, StoredFile & { cacheControl?: string }>();

  async put(key: string, file: StoredFile & { cacheControl?: string }): Promise<void> {
    this.objects.set(key, file);
  }

  async get(key: string): Promise<StoredFile | null> {
    return this.objects.get(key) ?? null;
  }

  async list(prefix: string): Promise<StoredObject[]> {
    return [...this.objects]
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, file]) => ({ key, size: file.body.byteLength }));
  }

  async delete(keys: string[]): Promise<void> {
    for (const key of keys) {
      this.objects.delete(key);
    }
  }
}
