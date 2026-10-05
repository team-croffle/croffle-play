import { describe, expect, it } from 'vitest';

import { GAME_FRAME } from '../app/utils/game-frame';
import { isAllowedRequest } from '../server/utils/request-guard';
import { sessionCookie } from '../server/utils/session';

// The portal (www.) and games (<id>.play.) share a registered domain, so they are same-site.
const portal = 'www.croffle-play.link';
const game = 'https://tetris.play.croffle-play.link';

describe('state-changing requests', () => {
  it('come only from the portal pages, never from a game on the same site', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      expect(
        isAllowedRequest({ method, path: '/api/games/x/scores', origin: game, host: portal }),
      ).toBe(false);
      expect(isAllowedRequest({ method, path: '/api/me', origin: undefined, host: portal })).toBe(
        false,
      );
      expect(
        isAllowedRequest({
          method,
          path: '/api/games/x/scores',
          origin: `https://${portal}`,
          host: portal,
        }),
      ).toBe(true);
    }
    expect(
      isAllowedRequest({ method: 'POST', path: '/api/me', origin: 'null', host: portal }),
    ).toBe(false);
  });

  it('leave reads and pages alone', () => {
    expect(isAllowedRequest({ method: 'GET', path: '/api/me', origin: game, host: portal })).toBe(
      true,
    );
    expect(isAllowedRequest({ method: 'POST', path: '/auth/x', origin: game, host: portal })).toBe(
      true,
    );
  });
});

describe('session cookie', () => {
  it('is host-only (__Host-) over https, so game hosts never receive it', () => {
    expect(sessionCookie(`https://${portal}`)).toEqual({
      name: '__Host-cp_session',
      cookie: { httpOnly: true, secure: true, sameSite: 'lax', path: '/' },
    });
    expect(sessionCookie('http://localhost:3000').name).toBe('cp_session');
    expect(sessionCookie(`https://${portal}`).cookie).not.toHaveProperty('domain');
  });
});

describe('game iframe', () => {
  it('keeps the sandbox: no popups, forms, top navigation, or downloads', () => {
    const flags = GAME_FRAME.sandbox.split(' ');
    expect(flags).toEqual(['allow-scripts', 'allow-same-origin', 'allow-pointer-lock']);
    expect(GAME_FRAME.referrerpolicy).toBe('no-referrer');
  });
});
