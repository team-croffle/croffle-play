/** Small LRU by total bytes, for files of the deploys being served right now. */
export class ByteCache<T extends { body: Uint8Array }> {
  private readonly entries = new Map<string, T>();
  private bytes = 0;

  constructor(private readonly maxBytes: number) {}

  get(key: string): T | undefined {
    const hit = this.entries.get(key);
    if (hit) {
      // Re-insert: Map keeps insertion order, so the newest-used entry is last.
      this.entries.delete(key);
      this.entries.set(key, hit);
    }
    return hit;
  }

  set(key: string, value: T): void {
    if (value.body.byteLength > this.maxBytes) {
      return;
    }
    const old = this.entries.get(key);
    if (old) {
      this.bytes -= old.body.byteLength;
      this.entries.delete(key);
    }
    this.entries.set(key, value);
    this.bytes += value.body.byteLength;
    for (const [k, v] of this.entries) {
      if (this.bytes <= this.maxBytes) {
        break;
      }
      this.entries.delete(k);
      this.bytes -= v.body.byteLength;
    }
  }

  get size(): number {
    return this.entries.size;
  }
}

/** A value remembered for `ttlMs`, refreshed by `load` afterwards. */
export class Ttl<T> {
  private readonly entries = new Map<string, { value: T; until: number }>();

  constructor(private readonly ttlMs: number) {}

  async get(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.entries.get(key);
    if (hit && hit.until > Date.now()) {
      return hit.value;
    }
    const value = await load();
    this.entries.set(key, { value, until: Date.now() + this.ttlMs });
    return value;
  }
}
