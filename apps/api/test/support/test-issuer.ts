import { createLocalJWKSet, exportJWK, generateKeyPair, type JWTVerifyGetKey, SignJWT } from 'jose';

export const ISSUER = 'https://idp.test/oidc';
export const AUDIENCE = 'https://api.test';

type SigningKey = Parameters<SignJWT['sign']>[0];

const keys = await generateKeyPair('ES256');
const jwk = { ...(await exportJWK(keys.publicKey)), kid: 'test-key', alg: 'ES256' };

/** JWKS the test API trusts. */
export const testJwks: JWTVerifyGetKey = createLocalJWKSet({ keys: [jwk] });

/** A player access token as the IdP would issue it; override claims to make bad ones. */
export async function accessToken(
  sub: string,
  claims: { iss?: string; aud?: string; expiresIn?: string; key?: SigningKey } = {},
): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
    .setSubject(sub)
    .setIssuer(claims.iss ?? ISSUER)
    .setAudience(claims.aud ?? AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(claims.expiresIn ?? '5m')
    .sign(claims.key ?? keys.privateKey);
}

export async function bearerFor(sub: string): Promise<{ authorization: string }> {
  return { authorization: `Bearer ${await accessToken(sub)}` };
}
