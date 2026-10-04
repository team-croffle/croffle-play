// `pnpm dev:oidc` — a local OpenID Connect provider standing in for Logto during development
// (http://localhost:4300). Any login name works; `admin` is just a name here — roles live in the
// platform database (`pnpm --filter @croffledev/play-api db:grant-admin <sub>`).
//
// Matches what the shell expects from Logto: authorization code + PKCE, refresh tokens with
// `offline_access` + `prompt=consent`, and JWT access tokens for the API resource (`resource=`).
import { Provider } from 'oidc-provider';

const port = Number(process.env.DEV_OIDC_PORT ?? 4300);
const issuer = `http://localhost:${port}`;
const audience = process.env.OIDC_AUDIENCE ?? 'http://localhost:3001';
const shell = process.env.SHELL_ORIGIN ?? 'http://localhost:3000';

const provider = new Provider(issuer, {
  clients: [
    {
      client_id: 'croffle-play-shell',
      client_secret: 'dev-secret',
      redirect_uris: [`${shell}/auth/callback`],
      post_logout_redirect_uris: [`${shell}/`],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    },
  ],
  pkce: { required: () => true },
  scopes: ['openid', 'profile', 'offline_access'],
  claims: { openid: ['sub'], profile: ['name', 'picture', 'username'] },
  findAccount: (_ctx, sub) => ({
    accountId: sub,
    claims: () => ({ sub, name: sub, username: sub, picture: null }),
  }),
  features: {
    devInteractions: { enabled: true },
    rpInitiatedLogout: { enabled: true },
    resourceIndicators: {
      enabled: true,
      defaultResource: () => audience,
      useGrantedResource: () => true,
      getResourceServerInfo: (_ctx, resource) => {
        if (resource !== audience) {
          throw new Error(`unknown resource ${resource}`);
        }
        return { scope: '', audience, accessTokenFormat: 'jwt', accessTokenTTL: 15 * 60 };
      },
    },
  },
  // Auto-approve: no consent screen beyond the one `prompt=consent` forces.
  loadExistingGrant: async (ctx) => {
    const session = ctx.oidc.session;
    const client = ctx.oidc.client;
    if (!session?.accountId || !client) {
      return undefined;
    }
    const grant = new ctx.oidc.provider.Grant({
      clientId: client.clientId,
      accountId: session.accountId,
    });
    grant.addOIDCScope('openid profile offline_access');
    grant.addResourceScope(audience, '');
    await grant.save();
    return grant;
  },
  ttl: {
    AccessToken: 15 * 60,
    IdToken: 15 * 60,
    RefreshToken: 12 * 60 * 60,
    Session: 12 * 60 * 60,
    Grant: 12 * 60 * 60,
  },
});

provider.listen(port, () => {
  console.log(
    `dev OIDC provider on ${issuer} (client croffle-play-shell / dev-secret, audience ${audience})`,
  );
});
