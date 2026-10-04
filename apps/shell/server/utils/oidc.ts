import type { H3Event } from 'h3';
import * as client from 'openid-client';

let discovered: Promise<client.Configuration> | undefined;

/** Discovered IdP configuration (cached; retried after a failure). 503 when sign-in is off. */
export function oidcConfig(): Promise<client.Configuration> {
  const { issuer, clientId, clientSecret } = useRuntimeConfig().oidc;
  if (!issuer || !clientId) {
    throw createError({ statusCode: 503, statusMessage: 'Sign-in is not configured' });
  }
  discovered ??= client
    .discovery(
      new URL(issuer),
      clientId,
      clientSecret || undefined,
      undefined,
      // Plain http only for a local development provider.
      issuer.startsWith('http://localhost')
        ? { execute: [client.allowInsecureRequests] }
        : undefined,
    )
    .catch((err: unknown) => {
      discovered = undefined;
      throw err;
    });
  return discovered;
}

export function redirectUri(): string {
  return new URL('/auth/callback', useRuntimeConfig().siteUrl).href;
}

/** Only same-site paths: `/x` but not `//evil.test` or `/\\evil.test`. */
export function safeReturnTo(value: unknown): string {
  return typeof value === 'string' && /^\/(?![/\\])/.test(value) ? value : '/';
}

/**
 * The player's access token for the API, refreshed when it expires within a minute.
 * Null when signed out or when refreshing fails (the session is then cleared).
 */
export async function accessToken(event: H3Event): Promise<string | null> {
  const session = await useShellSession(event);
  const auth = session.data.auth;
  if (!auth) {
    return null;
  }
  if (auth.expiresAt - 60_000 > Date.now()) {
    return auth.accessToken;
  }
  if (!auth.refreshToken) {
    await session.update({ auth: undefined });
    return null;
  }
  try {
    const tokens = await client.refreshTokenGrant(await oidcConfig(), auth.refreshToken, {
      resource: useRuntimeConfig().oidc.audience,
    });
    await session.update({
      auth: {
        ...auth,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? auth.refreshToken,
        expiresAt: Date.now() + (tokens.expiresIn() ?? 300) * 1000,
      },
    });
    return tokens.access_token;
  } catch {
    await session.update({ auth: undefined });
    return null;
  }
}
