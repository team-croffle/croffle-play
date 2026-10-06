import { isValidGameId } from '@croffledev/play-protocol';

/**
 * The game a request is for, from its `Host` header and the origin template
 * (`https://{id}.play.example` → `tetris` for `tetris.play.example`). Null when the host is not
 * one game's: the wrong domain, a reserved or malformed label, or an extra label. The id is the
 * only thing that decides which files are served, so nothing else from the request is trusted.
 */
export function gameIdFromHost(template: string, host: string | undefined): string | null {
  if (!host) {
    return null;
  }
  const expected = new URL(template.replaceAll('{id}', 'x')).host;
  const [exHost, exPort] = expected.split(':');
  const [reqHost, reqPort] = host.toLowerCase().split(':');
  if ((exPort ?? '') !== (reqPort ?? '') && !(exPort === undefined && isDefaultPort(reqPort))) {
    return null;
  }
  const suffix = (exHost ?? '').slice(1); // ".play.example"
  if (!reqHost || !reqHost.endsWith(suffix) || reqHost.length <= suffix.length) {
    return null;
  }
  const id = reqHost.slice(0, reqHost.length - suffix.length);
  return isValidGameId(id) ? id : null;
}

function isDefaultPort(port: string | undefined): boolean {
  return port === undefined || port === '80' || port === '443';
}

/**
 * The file a request path names inside a build, or null when it would leave it. `/` and
 * directories resolve to `entry` / `index.html`; encoded separators and dot segments are refused.
 */
export function filePath(pathname: string, entry: string): string | null {
  // Separators and dots must arrive literally: `%2f`, `%5c`, `%2e` and `%00` are refused as such.
  if (/%(2f|5c|2e|00)/i.test(pathname)) {
    return null;
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes('\0') || decoded.includes('\\')) {
    return null;
  }
  const segments = decoded.split('/').filter((s) => s !== '');
  if (segments.some((s) => s === '.' || s === '..')) {
    return null;
  }
  if (segments.length === 0) {
    return entry;
  }
  const path = segments.join('/');
  return decoded.endsWith('/') ? `${path}/index.html` : path;
}
