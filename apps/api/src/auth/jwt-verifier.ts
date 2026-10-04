import { Inject, Injectable } from '@nestjs/common';
import { createRemoteJWKSet, type JWTVerifyGetKey, jwtVerify } from 'jose';

import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';

/** Key source for access tokens; tests inject a local JWKS. */
export const JWKS = Symbol('JWKS');

export function jwksFromEnv(env: Env): JWTVerifyGetKey | null {
  if (!env.OIDC_ISSUER) {
    return null;
  }
  const url = env.OIDC_JWKS_URL ?? `${env.OIDC_ISSUER.replace(/\/$/, '')}/jwks`;
  return createRemoteJWKSet(new URL(url), { cooldownDuration: 30_000, cacheMaxAge: 10 * 60_000 });
}

/** Verifies player access tokens issued by the IdP for this API (`iss`, `aud`, signature, expiry). */
@Injectable()
export class JwtVerifier {
  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(JWKS) private readonly jwks: JWTVerifyGetKey | null,
  ) {}

  /** The token's subject, or null when the token is not acceptable. */
  async subject(token: string): Promise<string | null> {
    if (!this.jwks || !this.env.OIDC_ISSUER || !this.env.OIDC_AUDIENCE) {
      return null;
    }
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.env.OIDC_ISSUER,
        audience: this.env.OIDC_AUDIENCE,
        clockTolerance: 30,
      });
      return typeof payload.sub === 'string' && payload.sub ? payload.sub : null;
    } catch {
      return null;
    }
  }
}
