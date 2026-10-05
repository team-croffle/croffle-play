import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { type GameManifest, imageInfo, parseManifest, THUMBNAIL } from '@croffledev/play-protocol';

import { checkSdkStatus, type Findings } from './sdk-status.js';

export interface ValidateOptions {
  /** Platform API base URL; when set, the SDK major is checked against its lifecycle. */
  api?: string;
  fetch?: typeof fetch;
}

export interface ValidationResult extends Findings {
  ok: boolean;
  manifest: GameManifest | null;
}

/**
 * Checks a built game site (`dist/`) before it is deployed: `game.json` (what the portal reads at
 * `<game origin>/game.json`), its entry and thumbnail files, and — with `api` — the SDK major.
 */
export async function validateBuild(
  dir: string,
  opts: ValidateOptions = {},
): Promise<ValidationResult> {
  const out: Findings = { errors: [], warnings: [] };
  let manifest: GameManifest | null = null;
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(join(dir, 'game.json'), 'utf8'));
  } catch (err) {
    out.errors.push(
      (err as { code?: string }).code === 'ENOENT'
        ? `game.json is missing in '${dir}'`
        : 'game.json is not valid JSON',
    );
  }
  if (raw !== undefined) {
    const parsed = parseManifest(raw);
    if (parsed.ok) {
      manifest = parsed.manifest;
    } else {
      out.errors.push(...parsed.issues.map((i) => `game.json ${i.path || '(root)'}: ${i.message}`));
    }
  }
  if (manifest) {
    if (!(await exists(join(dir, manifest.entry)))) {
      out.errors.push(`game.json entry '${manifest.entry}' is not in '${dir}'`);
    }
    if (manifest.thumbnail) {
      await checkThumbnail(join(dir, manifest.thumbnail), manifest.thumbnail, out);
    } else {
      out.warnings.push('game.json has no thumbnail; the catalog shows a placeholder');
    }
    if (opts.api) {
      await checkSdkStatus(opts.api, manifest.sdk, opts.fetch ?? fetch, out);
    }
  }
  return { ok: out.errors.length === 0, ...out, manifest };
}

async function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false,
  );
}

/** The thumbnail must exist; its size and format are recommendations. */
async function checkThumbnail(path: string, name: string, out: Findings): Promise<void> {
  const bytes = await readFile(path).catch(() => null);
  if (!bytes) {
    out.errors.push(`game.json thumbnail '${name}' is not in the build`);
    return;
  }
  const info = imageInfo(bytes);
  if (!info) {
    out.warnings.push(`thumbnail ${name} is not a PNG, JPEG, or WebP image`);
  } else if (info.width < THUMBNAIL.minWidth || info.height < THUMBNAIL.minHeight) {
    out.warnings.push(
      `thumbnail ${name} is ${info.width}×${info.height}; ${THUMBNAIL.minWidth}×${THUMBNAIL.minHeight} or larger looks best`,
    );
  }
  if (bytes.length > THUMBNAIL.maxBytes) {
    out.warnings.push(`thumbnail ${name} is over ${THUMBNAIL.maxBytes / 1024} KB`);
  }
}
