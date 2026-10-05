import { describe, expect, it } from 'vitest';

import { gameOrigin, gameUrl, manifestUrl } from '../src/index.js';

const template = 'https://{id}.play.croffle-play.link';

describe('game origin', () => {
  it('builds one origin per game from the template', () => {
    expect(gameOrigin(template, 'tetris')).toBe('https://tetris.play.croffle-play.link');
    expect(gameOrigin('http://{id}.localhost:4100/', 'duo')).toBe('http://duo.localhost:4100');
  });

  it('resolves paths inside the game site', () => {
    expect(gameUrl(template, 'tetris')).toBe('https://tetris.play.croffle-play.link/');
    expect(gameUrl(template, 'tetris', 'index.html')).toBe(
      'https://tetris.play.croffle-play.link/index.html',
    );
    expect(gameUrl(template, 'tetris', 'img/thumb.png')).toBe(
      'https://tetris.play.croffle-play.link/img/thumb.png',
    );
    expect(manifestUrl(template, 'tetris')).toBe('https://tetris.play.croffle-play.link/game.json');
  });
});
