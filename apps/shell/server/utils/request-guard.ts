/**
 * Whether a request to the portal may go ahead. Games run on sibling hosts of the same site
 * (`<id>.play.<domain>` next to `www.<domain>`), so SameSite cookies do not stop them: every
 * state-changing `/api` request must come from this site's own pages (Origin host = request host).
 */
export function isAllowedRequest(req: {
  method: string;
  path: string;
  origin: string | undefined;
  host: string;
}): boolean {
  if (!req.path.startsWith('/api/') || req.method === 'GET' || req.method === 'HEAD') {
    return true;
  }
  if (!req.origin) {
    return false;
  }
  try {
    return new URL(req.origin).host === req.host;
  } catch {
    return false;
  }
}
