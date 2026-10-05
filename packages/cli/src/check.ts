import { type GameManifest, parseManifest } from '@croffledev/play-protocol';

import { checkSdkStatus, type Findings } from './sdk-status.js';

export interface CheckOptions {
  /** Portal origin that must be allowed to frame the game, e.g. https://www.croffle-play.link. */
  portal?: string;
  /** Platform API base URL; when set, the SDK major is checked against its lifecycle. */
  api?: string;
  /** Allow plain http (local development). */
  insecure?: boolean;
  fetch?: typeof fetch;
}

export interface CheckResult extends Findings {
  ok: boolean;
  manifest: GameManifest | null;
}

/**
 * Checks a deployed game the way the portal will use it: served over https, framable by the
 * portal, and serving a `game.json` whose id matches the game's host name.
 */
export async function checkGame(entryUrl: string, opts: CheckOptions = {}): Promise<CheckResult> {
  const out: Findings = { errors: [], warnings: [] };
  const fetcher = opts.fetch ?? fetch;
  let url: URL;
  try {
    url = new URL(entryUrl);
  } catch {
    return { ok: false, errors: [`'${entryUrl}' is not a URL`], warnings: [], manifest: null };
  }
  if (url.protocol !== 'https:' && !opts.insecure) {
    out.errors.push(`${url.origin} is not https (use --insecure for local development)`);
  }

  const page = await fetcher(url, { redirect: 'manual' }).catch((err: unknown) => {
    out.errors.push(`${url.href} is unreachable: ${(err as Error).message}`);
    return null;
  });
  if (page && page.status !== 200) {
    out.errors.push(`${url.href} answered ${page.status} (the portal frames this URL)`);
  }
  if (page) {
    checkFraming(page.headers, opts.portal, out);
  }

  const manifest = await readManifest(new URL('/game.json', url), fetcher, out);
  if (manifest) {
    const label = url.hostname.split('.')[0];
    if (manifest.id !== label) {
      out.errors.push(
        `game.json id '${manifest.id}' does not match the host '${url.hostname}' (expected '${label}')`,
      );
    }
    if (opts.api) {
      await checkSdkStatus(opts.api, manifest.sdk, fetcher, out);
    }
  }
  return { ok: out.errors.length === 0, ...out, manifest };
}

async function readManifest(
  url: URL,
  fetcher: typeof fetch,
  out: Findings,
): Promise<GameManifest | null> {
  const res = await fetcher(url, { redirect: 'manual' }).catch(() => null);
  if (!res || res.status !== 200) {
    out.errors.push(`${url.href} is missing (${res ? res.status : 'unreachable'})`);
    return null;
  }
  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    out.errors.push(`${url.href} is not JSON`);
    return null;
  }
  const parsed = parseManifest(raw);
  if (!parsed.ok) {
    out.errors.push(...parsed.issues.map((i) => `game.json ${i.path || '(root)'}: ${i.message}`));
    return null;
  }
  return parsed.manifest;
}

/**
 * The portal shows the game in an iframe, so the game must allow it: CSP `frame-ancestors` (which
 * wins over X-Frame-Options when both are present) or no framing restriction at all.
 */
export function checkFraming(headers: Headers, portal: string | undefined, out: Findings): void {
  const ancestors = frameAncestors(headers.get('content-security-policy'));
  if (ancestors) {
    if (!portal) {
      out.warnings.push('pass --portal <origin> to check frame-ancestors against the portal');
    } else if (!ancestors.some((source) => allows(source, new URL(portal)))) {
      out.errors.push(
        `frame-ancestors '${ancestors.join(' ')}' does not allow the portal ${portal}`,
      );
    }
    return;
  }
  const xfo = headers.get('x-frame-options')?.trim().toUpperCase();
  if (xfo === 'DENY' || xfo === 'SAMEORIGIN') {
    out.errors.push(`X-Frame-Options ${xfo} stops the portal from showing the game`);
    return;
  }
  out.warnings.push(
    "no CSP frame-ancestors: any site can frame the game; send 'frame-ancestors <portal origin>'",
  );
}

/** Sources of the first `frame-ancestors` directive across all CSP headers, or null. */
export function frameAncestors(csp: string | null): string[] | null {
  for (const policy of (csp ?? '').split(',')) {
    for (const directive of policy.split(';')) {
      const [name, ...sources] = directive.trim().split(/\s+/);
      if (name?.toLowerCase() === 'frame-ancestors') {
        return sources;
      }
    }
  }
  return null;
}

function allows(source: string, portal: URL): boolean {
  if (source === '*' || source.toLowerCase() === portal.protocol) {
    return true;
  }
  const m = /^(https?:)\/\/(\*\.)?([^/:]+)(?::(\d+|\*))?\/?$/i.exec(source);
  if (!m) {
    return false;
  }
  const [, scheme, wildcard, host = '', port] = m;
  if (scheme?.toLowerCase() !== portal.protocol) {
    return false;
  }
  const hostOk = wildcard
    ? portal.hostname.endsWith(`.${host.toLowerCase()}`)
    : portal.hostname === host.toLowerCase();
  return hostOk && (port === '*' || (port ?? '') === portal.port);
}
