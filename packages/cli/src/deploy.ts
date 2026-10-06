import { readFile, stat } from 'node:fs/promises';

import { parseManifest } from '@croffledev/play-protocol';
import { unzipSync } from 'fflate';

import { packBuild } from './pack.js';
import type { Findings } from './sdk-status.js';

export interface DeployOptions {
  /** Platform API base URL (`CROFFLE_PLAY_API`). */
  api: string;
  /** The game's deploy key (`cdk_…`, from `CROFFLE_DEPLOY_KEY`). Never printed. */
  key: string;
  /** Game id; by default the `id` of the build's `game.json`. */
  game?: string;
  fetch?: typeof fetch;
}

export interface DeployedBuild {
  id: string;
  gameId: string;
  version: string | null;
  fileCount: number;
  size: number;
}

export interface DeployResult extends Findings {
  ok: boolean;
  deploy: DeployedBuild | null;
}

/**
 * Uploads a build to the platform (`POST /v1/games/:id/deploys`): a directory is validated and
 * zipped first (`packBuild`), a `.zip` is sent as is. The platform checks the zip again and makes
 * it the game's active deploy.
 */
export async function deployBuild(target: string, opts: DeployOptions): Promise<DeployResult> {
  const out: Findings = { errors: [], warnings: [] };
  let zip: Uint8Array;
  let gameId = opts.game;
  if ((await stat(target).catch(() => null))?.isFile()) {
    zip = new Uint8Array(await readFile(target));
    gameId ??= idInZip(zip);
    if (!gameId) {
      out.errors.push(`'${target}' has no readable game.json; pass --game <id>`);
    }
  } else {
    const packed = await packBuild(target);
    out.warnings.push(...packed.warnings);
    if (!packed.ok || !packed.zip) {
      return { ok: false, errors: packed.errors, warnings: out.warnings, deploy: null };
    }
    zip = packed.zip;
    gameId ??= packed.manifest?.id;
  }
  if (!gameId) {
    return { ok: false, ...out, deploy: null };
  }
  const url = new URL(`/v1/games/${encodeURIComponent(gameId)}/deploys`, opts.api).href;
  const res = await (opts.fetch ?? fetch)(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${opts.key}`, 'content-type': 'application/zip' },
    body: zip,
  }).catch((err: unknown) => {
    out.errors.push(`${url} is unreachable: ${(err as Error).message}`);
    return null;
  });
  if (!res) {
    return { ok: false, ...out, deploy: null };
  }
  const body = (await res.json().catch(() => ({}))) as {
    message?: unknown;
    issues?: { path?: string; message?: string }[];
  } & Partial<DeployedBuild>;
  if (!res.ok) {
    out.errors.push(explain(res.status, body));
    return { ok: false, ...out, deploy: null };
  }
  return {
    ok: true,
    ...out,
    deploy: {
      id: String(body.id),
      gameId: String(body.gameId ?? gameId),
      version: body.version ?? null,
      fileCount: Number(body.fileCount ?? 0),
      size: Number(body.size ?? 0),
    },
  };
}

function explain(status: number, body: { message?: unknown; issues?: { message?: string }[] }) {
  const detail =
    typeof body.message === 'string'
      ? body.message
      : (body.issues ?? []).map((i) => i.message).join('; ');
  switch (status) {
    case 401:
      return `the platform refused the deploy key (${detail || 'unknown, revoked, or expired'})`;
    case 403:
      return `the deploy key belongs to another game (${detail})`;
    case 404:
      return `the game is not registered on the platform (${detail})`;
    case 413:
      return 'the zip is larger than the platform allows';
    case 429:
      return 'too many uploads; try again in a minute';
    default:
      return `upload refused (${status}): ${detail || 'no details'}`;
  }
}

/** `id` of the `game.json` at the zip's root (or one folder down), if readable. */
function idInZip(zip: Uint8Array): string | undefined {
  try {
    const files = unzipSync(zip, { filter: (f) => /^(?:[^/]+\/)?game\.json$/.test(f.name) });
    const name = Object.keys(files).toSorted((a, b) => a.length - b.length)[0];
    const raw = name ? JSON.parse(new TextDecoder().decode(files[name])) : undefined;
    const parsed = raw === undefined ? null : parseManifest(raw);
    return parsed?.ok ? parsed.manifest.id : undefined;
  } catch {
    return undefined;
  }
}
