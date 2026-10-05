export interface CspConfig {
  frameSrc: string;
  connectSrc: string;
}

/** `pnpm dev:games`: fixture games on `<id>.localhost:4100`, adapters on `localhost:4100`. */
const DEV_GAMES = 'http://localhost:4100 http://*.localhost:4100';

/**
 * Content-Security-Policy of portal pages. Games run only in frames from their own origins;
 * adapters are fetched from this origin (/adapters/…) and imported from blob: URLs after their SRI
 * check. `'unsafe-inline'` scripts: Nuxt's SSR payload is inline (no nonce support yet).
 */
export function buildCsp(c: CspConfig, dev = false): string {
  const frameSrc = c.frameSrc || (dev ? DEV_GAMES : "'none'");
  const extraConnect = `${c.connectSrc} ${dev ? DEV_GAMES : ''}`.trim();
  const directives: Record<string, string> = {
    'default-src': "'self'",
    'script-src': `'self' 'unsafe-inline' blob:${dev ? " 'unsafe-eval'" : ''}`,
    'style-src': "'self' 'unsafe-inline'",
    // Game thumbnails come from the game origins.
    'img-src': `'self' data: blob: ${frameSrc === "'none'" ? '' : frameSrc}`,
    'font-src': "'self' data:",
    'connect-src': `'self' ${extraConnect}${dev ? ' ws: wss:' : ''}`,
    'frame-src': frameSrc,
    'worker-src': "'self' blob:",
    'object-src': "'none'",
    'base-uri': "'self'",
    'form-action': "'self'",
    'frame-ancestors': "'none'",
  };
  return Object.entries(directives)
    .map(([k, v]) => `${k} ${v.trim()}`)
    .join('; ');
}

export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // Features games never get through the portal. Fullscreen/gamepad/autoplay stay delegable.
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
} as const;
