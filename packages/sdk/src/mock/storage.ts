/** Key-value storage for mock saves: localStorage when available, memory otherwise. */
export interface MockStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export function defaultStorage(): MockStorage {
  try {
    const ls = globalThis.localStorage;
    if (ls) {
      return { get: (k) => ls.getItem(k), set: (k, v) => ls.setItem(k, v) };
    }
  } catch {
    // Access can throw (blocked storage); fall through to memory.
  }
  return memoryStorage();
}

export function memoryStorage(): MockStorage {
  const map = new Map<string, string>();
  return { get: (k) => map.get(k) ?? null, set: (k, v) => void map.set(k, v) };
}
