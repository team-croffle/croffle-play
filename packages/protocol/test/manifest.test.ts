import { describe, expect, it } from 'vitest';

import { isRelativePath, isValidGameId, parseManifest, sdkRangeMajor } from '../src/index.js';

const valid = {
  id: 'block-drop',
  name: 'Block Drop',
  version: '1.2.0',
  thumbnail: 'thumb.png',
  sdk: '^1.0.0',
};

describe('game ids', () => {
  it.each(['a', 'tetris', 'block-drop', '2048', 'a'.repeat(32)])('accepts %s', (id) => {
    expect(isValidGameId(id)).toBe(true);
  });

  it.each(['', 'Tetris', '-x', 'x-', 'a_b', 'a.b', 'a'.repeat(33), 'api', 'www', 'srv', 'admin'])(
    'rejects %s',
    (id) => {
      expect(isValidGameId(id)).toBe(false);
    },
  );
});

describe('paths', () => {
  it.each(['index.html', 'assets/a.js', 'a/b/c.png'])('relative: %s', (p) => {
    expect(isRelativePath(p)).toBe(true);
  });

  it.each(['/index.html', '../x', 'a/../b', './a', 'a//b', 'https://x', 'a\\b', 'data:x'])(
    'not relative: %s',
    (p) => {
      expect(isRelativePath(p)).toBe(false);
    },
  );
});

describe('sdkRangeMajor', () => {
  it.each([
    ['^1.2.0', 1],
    ['~2.0.1', 2],
    ['3.0.0', 3],
    ['1.x', 1],
    ['4', 4],
    ['^1.0.0-beta.1', 1],
    ['>=1.0.0', null],
    ['^1.0.0 || ^2.0.0', null],
    ['*', null],
    ['latest', null],
  ])('%s → %s', (range, major) => {
    expect(sdkRangeMajor(range)).toBe(major);
  });
});

describe('parseManifest', () => {
  it('fills defaults', () => {
    expect(parseManifest(valid)).toEqual({
      ok: true,
      manifest: { ...valid, entry: 'index.html', needsServer: false, orientation: 'any' },
    });
  });

  it('reports every problem with its path', () => {
    const r = parseManifest({ ...valid, id: 'API', version: '1.2', entry: '../x', sdk: '*' });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.issues.map((i) => i.path).toSorted()).toEqual([
      'entry',
      'id',
      'sdk',
      'version',
    ]);
  });

  it('accepts a server protocol', () => {
    expect(parseManifest({ ...valid, needsServer: true, server: { protocol: '2.1.0' } }).ok).toBe(
      true,
    );
  });
});
