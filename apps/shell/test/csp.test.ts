import { describe, expect, it } from 'vitest';

import { buildCsp } from '../server/utils/csp';

const prod = { frameSrc: 'https://*.play.croffle-play.link', connectSrc: '' };

function directives(csp: string) {
  return Object.fromEntries(csp.split('; ').map((d) => [d.split(' ')[0], d.split(' ').slice(1)]));
}

describe('buildCsp', () => {
  it('frames only the game origins and fetches adapters from this origin only', () => {
    const d = directives(buildCsp(prod));
    expect(d['frame-src']).toEqual(['https://*.play.croffle-play.link']);
    expect(d['connect-src']).toEqual(["'self'"]);
    expect(d['img-src']).toContain('https://*.play.croffle-play.link');
    expect(d['frame-ancestors']).toEqual(["'none'"]);
    expect(d['object-src']).toEqual(["'none'"]);
  });

  it('frames nothing when no game origin is configured in production', () => {
    expect(directives(buildCsp({ frameSrc: '', connectSrc: '' }))['frame-src']).toEqual(["'none'"]);
  });

  it('adds the development game server only in development', () => {
    const d = directives(buildCsp({ frameSrc: '', connectSrc: '' }, true));
    expect(d['frame-src']).toEqual(['http://localhost:4100', 'http://*.localhost:4100']);
    expect(d['connect-src']).toContain('http://localhost:4100');
  });

  it('allows blob: scripts (verified adapters) but no eval in production', () => {
    const d = directives(buildCsp(prod));
    expect(d['script-src']).toContain('blob:');
    expect(d['script-src']).not.toContain("'unsafe-eval'");
    expect(directives(buildCsp(prod, true))['script-src']).toContain("'unsafe-eval'");
  });
});
