import { readFile } from 'node:fs/promises';

import { contentEncodingFor, sha256Base64 } from './bundle.js';
import { type ValidateOptions, validateBundle, withSlash } from './validate.js';

export interface PublishOptions extends ValidateOptions {
  api: string;
  /** Deploy key for this game (`cpk_<game>_…`). */
  key: string;
  concurrency?: number;
  log?: (line: string) => void;
}

interface Upload {
  path: string;
  url: string;
  method: 'PUT';
  headers: Record<string, string>;
}

export class PublishError extends Error {
  override readonly name = 'PublishError';
}

/**
 * Validates, declares the version, uploads every file to its presigned URL, and completes.
 * Returns the preview URL. Safe to re-run after a failed upload: unfinished versions can be
 * declared again; finished ones are refused by the platform.
 */
export async function publishBundle(
  dir: string,
  opts: PublishOptions,
): Promise<{ version: string; previewUrl: string }> {
  const log = opts.log ?? (() => undefined);
  const fetcher = opts.fetch ?? fetch;
  const result = await validateBundle(dir, opts);
  for (const w of result.warnings) {
    log(`warning: ${w}`);
  }
  if (!result.ok || !result.manifest) {
    throw new PublishError(
      `Bundle is invalid:\n${result.errors.map((e) => `  - ${e}`).join('\n')}`,
    );
  }
  const { id, version } = result.manifest;
  const base = new URL(`v1/games/${encodeURIComponent(id)}/versions`, withSlash(opts.api));
  const auth = { authorization: `Bearer ${opts.key}` };

  const files = await Promise.all(
    result.files.map(async (f) => {
      const encoding = contentEncodingFor(f.path);
      return {
        path: f.path,
        size: f.size,
        sha256: await sha256Base64(f.absPath),
        ...(encoding ? { contentEncoding: encoding } : {}),
      };
    }),
  );
  const raw = JSON.parse(await readFile(`${dir}/game.json`, 'utf8')) as unknown;
  const declared = await call<{ uploads: Upload[]; warnings?: string[] }>(fetcher, base, {
    method: 'POST',
    headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({ manifest: raw, files }),
  });
  for (const w of declared.warnings ?? []) {
    log(`warning: ${w}`);
  }
  log(`declared ${id}@${version}: ${declared.uploads.length} files`);

  const byPath = new Map(result.files.map((f) => [f.path, f.absPath]));
  let done = 0;
  await pool(declared.uploads, opts.concurrency ?? 4, async (u) => {
    const body = await readFile(byPath.get(u.path) ?? '');
    await retry(3, async () => {
      const res = await fetcher(u.url, { method: u.method, headers: u.headers, body });
      if (!res.ok) {
        throw new PublishError(`Upload of ${u.path} failed: ${res.status} ${await res.text()}`);
      }
    });
    done++;
    log(`uploaded ${done}/${declared.uploads.length} ${u.path}`);
  });

  const completed = await call<{ version: string; previewUrl: string }>(
    fetcher,
    new URL(`${base.pathname}/${encodeURIComponent(version ?? '')}/complete`, base),
    { method: 'POST', headers: auth },
  );
  log(`complete: preview at ${completed.previewUrl} (waiting for approval)`);
  return completed;
}

async function call<T>(fetcher: typeof fetch, url: URL, init: RequestInit): Promise<T> {
  const res = await fetcher(url, init);
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try {
      const json = JSON.parse(text) as { message?: unknown; issues?: unknown; problems?: unknown };
      detail = JSON.stringify(json.issues ?? json.problems ?? json.message ?? json);
    } catch {
      // Not JSON; keep the text.
    }
    throw new PublishError(`${init.method} ${url.pathname} → ${res.status}: ${detail}`);
  }
  return JSON.parse(text) as T;
}

async function pool<T>(items: T[], size: number, work: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(size, queue.length) }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
        await work(item);
      }
    }),
  );
}

async function retry(times: number, fn: () => Promise<void>): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= times) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
}
