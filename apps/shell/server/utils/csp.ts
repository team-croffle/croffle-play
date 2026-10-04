export interface CspConfig {
  frameSrc: string;
  connectSrc: string;
}

/**
 * Content-Security-Policy of shell pages. Games run only in frames from the game domain; adapters
 * are fetched from the adapter host and imported from blob: URLs after their SRI check.
 * `'unsafe-inline'` scripts: Nuxt's SSR payload is inline (no nonce support yet).
 */
export function buildCsp(c: CspConfig, dev = false): string {
  const directives: Record<string, string> = {
    'default-src': "'self'",
    'script-src': `'self' 'unsafe-inline' blob:${dev ? " 'unsafe-eval'" : ''}`,
    'style-src': "'self' 'unsafe-inline'",
    'img-src': `'self' data: blob: ${c.frameSrc}`,
    'font-src': "'self' data:",
    'connect-src': `'self' ${c.connectSrc}${dev ? ' ws: wss:' : ''}`,
    'frame-src': c.frameSrc,
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
  // Features games never get through the shell. Fullscreen/gamepad/autoplay stay delegable.
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
} as const;
