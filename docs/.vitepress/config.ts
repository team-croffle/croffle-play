import { posix } from 'node:path';

import { defineConfig } from 'vitepress';

const repo = 'https://github.com/team-croffle/croffle-play';

/**
 * Rewrites a relative link for the site, or returns null to keep it. Links that leave the site —
 * files outside `docs/` (`../apps/...`) or anything that is not a page (example code, folders) —
 * point at the repository on GitHub instead.
 */
function siteLink(href: string, page: string): string | null {
  if (/^[a-z][a-z0-9+.-]*:|^#|^\//i.test(href)) {
    return null;
  }
  const [path = '', hash] = href.split('#', 2);
  const target = posix.normalize(posix.join('docs', posix.dirname(page), path));
  const isPage = path.endsWith('.md') && target.startsWith('docs/');
  if (isPage) {
    // A folder README is the folder's page (see `rewrites`).
    return path.endsWith('README.md')
      ? `${path.slice(0, -'README.md'.length)}${hash ? `#${hash}` : ''}`
      : null;
  }
  const kind = /\.[a-z0-9]+$/i.test(path) ? 'blob' : 'tree';
  return `${repo}/${kind}/master/${target}${hash === undefined ? '' : `#${hash}`}`;
}

export default defineConfig({
  lang: 'ko-KR',
  title: 'Croffle Play',
  description: '팀 크로플 웹 게임 플랫폼 — 게임 개발자·관리자·운영자 문서',
  // GitHub Pages project site by default; `DOCS_BASE=/` once a custom domain is set.
  base: process.env.DOCS_BASE ?? '/croffle-play/',
  cleanUrls: true,
  lastUpdated: true,
  srcExclude: ['**/node_modules/**'],
  // Folder READMEs read as the folder's page.
  rewrites: { 'examples/game-server/README.md': 'examples/game-server/index.md' },
  markdown: {
    config(md) {
      md.core.ruler.after('inline', 'site-links', (state) => {
        const page = (state.env as { relativePath?: string }).relativePath ?? '';
        for (const block of state.tokens) {
          for (const token of block.children ?? []) {
            const href = token.type === 'link_open' ? token.attrGet('href') : null;
            const url = href === null ? null : siteLink(href, page);
            if (url !== null) {
              token.attrSet('href', url);
            }
          }
        }
      });
    },
  },
  themeConfig: {
    nav: [
      { text: '개발자 가이드', link: '/guide/developer' },
      { text: '관리자 가이드', link: '/guide/admin' },
      { text: 'SDK', link: '/reference/sdk' },
      { text: 'env', link: '/reference/env' },
    ],
    sidebar: [
      {
        text: '가이드',
        items: [
          { text: '게임 개발자 가이드', link: '/guide/developer' },
          { text: '관리자 가이드', link: '/guide/admin' },
        ],
      },
      {
        text: '레퍼런스',
        items: [
          { text: 'SDK', link: '/reference/sdk' },
          { text: '앱 환경 변수', link: '/reference/env' },
        ],
      },
      {
        text: '게임',
        items: [
          { text: '호스팅과 등록', link: '/game-hosting' },
          { text: '멀티플레이', link: '/multiplayer' },
          { text: '게임 자체 서버', link: '/game-servers' },
          { text: '서버 예제', link: '/examples/game-server/' },
          { text: 'SDK 수명주기', link: '/sdk-lifecycle' },
        ],
      },
      {
        text: '플랫폼',
        items: [
          { text: '설계', link: '/ARCHITECTURE' },
          { text: '보안 모델', link: '/security' },
          { text: '로드맵', link: '/ROADMAP' },
        ],
      },
    ],
    socialLinks: [{ icon: 'github', link: repo }],
    editLink: { pattern: `${repo}/edit/master/docs/:path`, text: 'GitHub에서 고치기' },
    outline: { label: '이 페이지', level: [2, 3] },
    docFooter: { prev: '이전', next: '다음' },
    lastUpdated: { text: '마지막 수정' },
    search: { provider: 'local' },
  },
});
