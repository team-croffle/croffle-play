import { defaultClientConditions, defaultServerConditions } from 'vite';

// Workspace packages (`@croffledev/play-*`) resolve to their TypeScript source, so the shell never
// waits for a package build (see AGENTS.md → Planned layout).
const source = '@croffledev/source';
const customConditions = { compilerOptions: { customConditions: [source] } };

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  devtools: { enabled: false },
  css: ['~/assets/main.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'ko' },
      title: 'Croffle Play',
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    },
  },
  runtimeConfig: {
    // Server-only. Internal API base URL (NUXT_API_BASE). The browser never calls it directly.
    apiBase: 'http://localhost:3001',
    // Server-only. Seals the session cookie (NUXT_SESSION_PASSWORD, ≥ 32 chars).
    sessionPassword: '',
    // Session lifetime in seconds (NUXT_SESSION_MAX_AGE); sign-in is needed again after it.
    sessionMaxAge: 43_200,
    // Public URL of this shell (NUXT_SITE_URL); OIDC redirect URIs are built from it.
    siteUrl: 'http://localhost:3000',
    oidc: {
      // NUXT_OIDC_ISSUER (Logto: https://auth.play.croffledev.kr/oidc). Sign-in is off when empty.
      issuer: '',
      clientId: '',
      clientSecret: '',
      // API resource indicator; access tokens are issued for it (NUXT_OIDC_AUDIENCE).
      audience: '',
    },
    // Shared rooms server games connect to (NUXT_ROOMS_URL), e.g. wss://rooms.play.croffledev.kr
    roomsUrl: 'ws://localhost:3002',
    csp: {
      // Where game versions are framed from (NUXT_CSP_FRAME_SRC), e.g. https://*.croffle-play.link
      frameSrc: 'http://localhost:4100 http://*.localhost:4100',
      // Where host adapters are fetched from (NUXT_CSP_CONNECT_SRC), e.g. https://static.play.croffledev.kr
      connectSrc: 'http://localhost:4100',
    },
  },
  vite: {
    resolve: { conditions: [source, ...defaultClientConditions] },
    ssr: { resolve: { conditions: [source, ...defaultServerConditions] } },
  },
  nitro: {
    exportConditions: [source],
    typescript: { tsConfig: customConditions },
  },
  typescript: {
    strict: true,
    tsConfig: customConditions,
    sharedTsConfig: customConditions,
    nodeTsConfig: customConditions,
  },
});
