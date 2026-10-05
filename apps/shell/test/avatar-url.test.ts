import { describe, expect, it } from 'vitest';

import { absoluteAvatar } from '../app/utils/avatar-url';

describe('absoluteAvatar', () => {
  it('makes portal avatar paths absolute for games on other origins', () => {
    expect(absoluteAvatar('/avatars/u/abc.png', 'https://www.croffle-play.link')).toBe(
      'https://www.croffle-play.link/avatars/u/abc.png',
    );
    expect(absoluteAvatar('https://idp.test/p.png', 'https://www.croffle-play.link')).toBe(
      'https://idp.test/p.png',
    );
    expect(absoluteAvatar(null, 'https://www.croffle-play.link')).toBeNull();
  });
});
