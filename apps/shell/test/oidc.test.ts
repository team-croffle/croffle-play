import { describe, expect, it } from 'vitest';

import { safeReturnTo } from '../server/utils/oidc';

describe('safeReturnTo', () => {
  it.each(['/', '/game/tetris', '/game/tetris/play?version=1.0.0'])('keeps %s', (p) => {
    expect(safeReturnTo(p)).toBe(p);
  });

  it.each([
    '//evil.test',
    '/\\evil.test',
    'https://evil.test',
    'javascript:alert(1)',
    '',
    undefined,
    ['/x'],
  ])('replaces %s with /', (p) => {
    expect(safeReturnTo(p)).toBe('/');
  });
});
