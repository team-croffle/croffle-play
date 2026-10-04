import * as client from 'openid-client';

/** Ends the shell session; the client then visits the IdP's end-session URL if there is one. */
export default defineEventHandler(async (event) => {
  await (await useShellSession(event)).clear();
  const { siteUrl, oidc } = useRuntimeConfig();
  if (!oidc.issuer) {
    return { redirectTo: '/' };
  }
  try {
    const config = await oidcConfig();
    const url = client.buildEndSessionUrl(config, {
      post_logout_redirect_uri: new URL('/', siteUrl).href,
      client_id: oidc.clientId,
    });
    return { redirectTo: url.href };
  } catch {
    return { redirectTo: '/' };
  }
});
