import * as client from 'openid-client';

/** Starts sign-in: authorization code + PKCE, with state and nonce kept in the sealed session. */
export default defineEventHandler(async (event) => {
  const config = await oidcConfig();
  const verifier = client.randomPKCECodeVerifier();
  const state = client.randomState();
  const nonce = client.randomNonce();
  const session = await useShellSession(event);
  await session.update({
    oidc: { verifier, state, nonce, returnTo: safeReturnTo(getQuery(event).return) },
  });
  const url = client.buildAuthorizationUrl(config, {
    redirect_uri: redirectUri(),
    scope: 'openid profile offline_access',
    code_challenge: await client.calculatePKCECodeChallenge(verifier),
    code_challenge_method: 'S256',
    state,
    nonce,
    resource: useRuntimeConfig().oidc.audience,
    // Refresh tokens (offline_access) require explicit consent at Logto and other IdPs.
    prompt: 'consent',
  });
  return sendRedirect(event, url.href);
});
