import * as client from 'openid-client';

/** Completes sign-in, syncs the profile to the API, and keeps the tokens in the session. */
export default defineEventHandler(async (event) => {
  const session = await useShellSession(event);
  const pending = session.data.oidc;
  await session.update({ oidc: undefined });
  if (!pending) {
    return sendRedirect(event, '/?login=expired');
  }
  const current = new URL(redirectUri());
  current.search = getRequestURL(event).search;
  let tokens: Awaited<ReturnType<typeof client.authorizationCodeGrant>>;
  try {
    tokens = await client.authorizationCodeGrant(
      await oidcConfig(),
      current,
      {
        pkceCodeVerifier: pending.verifier,
        expectedState: pending.state,
        expectedNonce: pending.nonce,
      },
      { resource: useRuntimeConfig().oidc.audience },
    );
  } catch {
    return sendRedirect(event, '/?login=failed');
  }
  const claims = tokens.claims();
  const name = [claims?.name, claims?.nickname, claims?.username].find(
    (v): v is string => typeof v === 'string' && v.trim().length > 0,
  );
  const picture =
    typeof claims?.picture === 'string' && claims.picture.startsWith('https://')
      ? claims.picture
      : null;
  const me = name
    ? await apiAsUser<SessionUser>(event, '/v1/me', {
        method: 'PUT',
        token: tokens.access_token,
        body: { nickname: name.trim().slice(0, 24), avatar: picture },
      })
    : await apiAsUser<SessionUser>(event, '/v1/me', { token: tokens.access_token });
  await session.update({
    auth: {
      accessToken: tokens.access_token,
      ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
      expiresAt: Date.now() + (tokens.expiresIn() ?? 300) * 1000,
      user: { id: me.id, nickname: me.nickname, avatar: me.avatar, role: me.role },
    },
  });
  return sendRedirect(event, pending.returnTo);
});
