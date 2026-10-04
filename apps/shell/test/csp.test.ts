import { describe, expect, it } from 'vitest';

import { buildCsp } from '../server/utils/csp';

const prod = {
  frameSrc: 'https://*.croffle-play.link',
  connectSrc: 'https://static.play.croffledev.kr',
};

function directives(csp: string) {
  return Object.fromEntries(csp.split('; ').map((d) => [d.split(' ')[0], d.split(' ').slice(1)]));
}

describe('buildCsp', () => {
  it('frames only the game domain and fetches adapters only from their host', () => {
    const d = directives(buildCsp(prod));
    expect(d['frame-src']).toEqual(['https://*.croffle-play.link']);
    expect(d['connect-src']).toEqual(["'self'", 'https://static.play.croffledev.kr']);
    expect(d['frame-ancestors']).toEqual(["'none'"]);
    expect(d['object-src']).toEqual(["'none'"]);
  });

  it('allows blob: scripts (verified adapters) but no eval in production', () => {
    const d = directives(buildCsp(prod));
    expect(d['script-src']).toContain('blob:');
    expect(d['script-src']).not.toContain("'unsafe-eval'");
    expect(directives(buildCsp(prod, true))['script-src']).toContain("'unsafe-eval'");
  });
});
