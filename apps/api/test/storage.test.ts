import { describe, expect, it } from 'vitest';

import { FakeStorage } from './support/fake-storage.js';

const text = (s: string) => ({ body: new TextEncoder().encode(s), contentType: 'text/plain' });

describe('Storage list and delete', () => {
  it('lists objects under a prefix with their sizes', async () => {
    const storage = new FakeStorage();
    await storage.put('games/a/d1/index.html', text('<h1>a</h1>'));
    await storage.put('games/a/d1/game.json', text('{}'));
    await storage.put('games/b/d2/index.html', text('b'));

    const listed = await storage.list('games/a/');
    expect(listed.map((o) => o.key).toSorted()).toEqual([
      'games/a/d1/game.json',
      'games/a/d1/index.html',
    ]);
    expect(listed.find((o) => o.key === 'games/a/d1/game.json')?.size).toBe(2);
    expect(await storage.list('games/zzz/')).toEqual([]);
  });

  it('deletes the given keys and ignores missing ones', async () => {
    const storage = new FakeStorage();
    await storage.put('games/a/d1/index.html', text('a'));
    await storage.put('games/a/d2/index.html', text('a2'));

    await storage.delete(['games/a/d1/index.html', 'games/a/nope']);
    expect(await storage.get('games/a/d1/index.html')).toBeNull();
    expect(await storage.get('games/a/d2/index.html')).not.toBeNull();
  });
});
