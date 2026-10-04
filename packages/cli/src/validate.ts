import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  type GameManifest,
  parseManifest,
  sdkRangeMajor,
  THUMBNAIL,
} from '@croffledev/play-protocol';

import { type BundleFile, formatBytes, listBundle } from './bundle.js';
import { findExternalUrls, kindOf } from './external-urls.js';
import { imageInfo } from './image-size.js';

export const DEFAULT_MAX_BYTES = 30 * 1024 * 1024;

export interface ValidateOptions {
  /** Platform API base URL; when set, the SDK major is checked against its lifecycle. */
  api?: string;
  maxBytes?: number;
  fetch?: typeof fetch;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  manifest: GameManifest | null;
  files: BundleFile[];
  totalBytes: number;
}

/** Checks a built bundle (`dist/`) against the bundle contract. */
export async function validateBundle(
  dir: string,
  opts: ValidateOptions = {},
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const files = await listBundle(dir).catch(() => {
    errors.push(`Cannot read bundle directory '${dir}'`);
    return [] as BundleFile[];
  });
  const paths = new Set(files.map((f) => f.path));
  const totalBytes = files.reduce((n, f) => n + f.size, 0);

  let manifest: GameManifest | null = null;
  if (files.length > 0 && !paths.has('game.json')) {
    errors.push('game.json is missing at the bundle root');
  } else if (files.length > 0) {
    let raw: unknown;
    try {
      raw = JSON.parse(await readFile(join(dir, 'game.json'), 'utf8'));
    } catch {
      errors.push('game.json is not valid JSON');
    }
    if (raw !== undefined) {
      const parsed = parseManifest(raw);
      if (parsed.ok) {
        manifest = parsed.manifest;
      } else {
        errors.push(...parsed.issues.map((i) => `game.json ${i.path || '(root)'}: ${i.message}`));
      }
    }
  }

  if (manifest) {
    for (const [field, path] of [
      ['entry', manifest.entry],
      ['thumbnail', manifest.thumbnail],
    ] as const) {
      if (!paths.has(path)) {
        errors.push(`game.json ${field} '${path}' is not in the bundle`);
      }
    }
    const thumb = files.find((f) => f.path === manifest?.thumbnail);
    if (thumb) {
      errors.push(...(await checkThumbnail(thumb)));
    }
    if (opts.api) {
      await checkSdk(opts.api, manifest.sdk, opts.fetch ?? fetch, errors, warnings);
    }
  }

  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  if (totalBytes > maxBytes) {
    errors.push(
      `Bundle is ${formatBytes(totalBytes)}; the limit is ${formatBytes(maxBytes)} (ask an admin to raise it)`,
    );
  }

  for (const f of files) {
    const kind = kindOf(f.path);
    if (!kind || f.size > 5 * 1024 * 1024) {
      continue;
    }
    for (const hit of findExternalUrls(kind, await readFile(f.absPath, 'utf8'))) {
      errors.push(`${f.path}: external resource '${hit}' (bundles must be self-contained)`);
    }
  }

  return { ok: errors.length === 0, errors, warnings, manifest, files, totalBytes };
}

async function checkThumbnail(f: BundleFile): Promise<string[]> {
  if (f.size > THUMBNAIL.maxBytes) {
    return [
      `thumbnail ${f.path} is ${formatBytes(f.size)}; the limit is ${formatBytes(THUMBNAIL.maxBytes)}`,
    ];
  }
  const info = imageInfo(await readFile(f.absPath));
  if (!info) {
    return [`thumbnail ${f.path} is not a PNG, JPEG, or WebP image`];
  }
  if (info.width < THUMBNAIL.minWidth || info.height < THUMBNAIL.minHeight) {
    return [
      `thumbnail ${f.path} is ${info.width}×${info.height}; at least ${THUMBNAIL.minWidth}×${THUMBNAIL.minHeight} is required`,
    ];
  }
  return [];
}

async function checkSdk(
  api: string,
  range: string,
  fetcher: typeof fetch,
  errors: string[],
  warnings: string[],
) {
  const major = sdkRangeMajor(range);
  const res = await fetcher(new URL(`v1/sdk/${major}`, withSlash(api))).catch(() => null);
  if (!res) {
    warnings.push(`Could not reach ${api} to check SDK v${major}`);
    return;
  }
  if (res.status === 404) {
    errors.push(`SDK v${major} is not supported by the platform`);
    return;
  }
  const info = (await res.json()) as { status: string; eolAt: string | null };
  if (info.status === 'deprecated' || info.status === 'eol') {
    errors.push(`SDK v${major} is ${info.status}; new versions must use a supported SDK major`);
  } else if (info.status === 'maintenance') {
    const when = info.eolAt ? ` (end of life ${info.eolAt.slice(0, 10)})` : '';
    warnings.push(`SDK v${major} is in maintenance${when}; plan an upgrade`);
  }
}

export function withSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}
