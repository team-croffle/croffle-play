import { sdkRangeMajor } from '@croffledev/play-protocol';

export interface Findings {
  errors: string[];
  warnings: string[];
}

export function withSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

/** Asks the platform API whether the SDK major of `range` is still accepted (docs/sdk-lifecycle.md). */
export async function checkSdkStatus(
  api: string,
  range: string,
  fetcher: typeof fetch,
  out: Findings,
): Promise<void> {
  const major = sdkRangeMajor(range);
  const res = await fetcher(new URL(`v1/sdk/${major}`, withSlash(api))).catch(() => null);
  if (!res) {
    out.warnings.push(`Could not reach ${api} to check SDK v${major}`);
    return;
  }
  if (res.status === 404) {
    out.errors.push(`SDK v${major} is not supported by the platform`);
    return;
  }
  const info = (await res.json()) as { status: string; deprecatedAt: string | null };
  if (info.status === 'deprecated') {
    out.errors.push(`SDK v${major} is deprecated: games built with it no longer run`);
  } else if (info.status === 'old') {
    const when = info.deprecatedAt ? ` (deprecated from ${info.deprecatedAt.slice(0, 10)})` : '';
    out.errors.push(
      `SDK v${major} is old${when}: the platform refuses updates; upgrade with \`npx @croffledev/play-sdk migrate\``,
    );
  }
}
