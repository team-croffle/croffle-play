import { lstat, readdir, readFile } from 'node:fs/promises';
import { join, posix, relative, sep } from 'node:path';

import { UPLOAD_LIMITS, type UploadLimits } from '@croffledev/play-protocol';
import { zipSync } from 'fflate';

import type { Findings } from './sdk-status.js';
import { type ValidateOptions, validateBuild, type ValidationResult } from './validate.js';

export interface PackOptions extends ValidateOptions {
  /** The platform's limits; the defaults are the platform defaults. */
  limits?: Partial<UploadLimits>;
}

export interface PackResult extends ValidationResult {
  /** The zip, when the build passed. */
  zip: Uint8Array | null;
  fileCount: number;
  /** Bytes before compression. */
  size: number;
}

/**
 * Validates a build (`validateBuild`) and zips it for platform hosting, refusing what the
 * platform would refuse: symbolic links, and more files or bytes than the limits allow. Files
 * are stored at their paths relative to `dir`, `game.json` at the root.
 */
export async function packBuild(dir: string, opts: PackOptions = {}): Promise<PackResult> {
  const limits: UploadLimits = { ...UPLOAD_LIMITS, ...opts.limits };
  const validation = await validateBuild(dir, opts);
  const out: Findings = { errors: [...validation.errors], warnings: [...validation.warnings] };
  const files: Record<string, Uint8Array> = {};
  let size = 0;
  let count = 0;
  for (const path of await walk(dir)) {
    if (path.length > limits.maxPathLength) {
      out.errors.push(`'${path.slice(0, 40)}…' is longer than ${limits.maxPathLength} characters`);
      continue;
    }
    const full = join(dir, path);
    const stat = await lstat(full);
    if (stat.isSymbolicLink()) {
      out.errors.push(`'${path}' is a symbolic link; the platform refuses links`);
      continue;
    }
    if (stat.size > limits.maxFileBytes) {
      out.errors.push(`'${path}' is ${stat.size} bytes; the limit is ${limits.maxFileBytes}`);
      continue;
    }
    count += 1;
    size += stat.size;
    files[path] = new Uint8Array(await readFile(full));
  }
  if (count > limits.maxFiles) {
    out.errors.push(`${count} files; the limit is ${limits.maxFiles}`);
  }
  if (size > limits.maxTotalBytes) {
    out.errors.push(`${size} bytes in total; the limit is ${limits.maxTotalBytes}`);
  }
  const ok = out.errors.length === 0;
  const zip = ok ? zipSync(files, { level: 6 }) : null;
  if (zip && zip.byteLength > limits.maxZipBytes) {
    out.errors.push(`the zip is ${zip.byteLength} bytes; the limit is ${limits.maxZipBytes}`);
  }
  return {
    ok: out.errors.length === 0,
    ...out,
    manifest: validation.manifest,
    zip: out.errors.length === 0 ? zip : null,
    fileCount: count,
    size,
  };
}

/** Every file under `dir`, as `/`-separated paths relative to it, sorted. */
async function walk(dir: string, sub = ''): Promise<string[]> {
  const entries = await readdir(join(dir, sub), { withFileTypes: true });
  const paths: string[] = [];
  for (const e of entries) {
    const rel = relative(dir, join(dir, sub, e.name))
      .split(sep)
      .join(posix.sep);
    if (e.isDirectory()) {
      paths.push(...(await walk(dir, join(sub, e.name))));
    } else {
      paths.push(rel);
    }
  }
  return paths.toSorted();
}
