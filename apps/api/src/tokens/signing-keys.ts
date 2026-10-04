import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { exportJWK, generateKeyPair, importPKCS8, type JWK, SignJWT } from 'jose';

import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';

type PrivateKey = Parameters<SignJWT['sign']>[0];

/** The platform's own signing key (game tokens), published as a JWKS for game servers. */
@Injectable()
export class SigningKeys implements OnModuleInit {
  private readonly logger = new Logger(SigningKeys.name);
  private privateKey!: PrivateKey;
  private publicJwk!: JWK;

  constructor(@Inject(ENV) private readonly env: Env) {}

  async onModuleInit(): Promise<void> {
    if (this.env.JWT_SIGNING_KEY) {
      const pem = this.env.JWT_SIGNING_KEY.replaceAll('\\n', '\n');
      this.privateKey = await importPKCS8(pem, 'ES256', { extractable: true });
    } else {
      this.logger.warn('JWT_SIGNING_KEY is not set: using a throwaway key (development only)');
      this.privateKey = (await generateKeyPair('ES256', { extractable: true })).privateKey;
    }
    const { d: _private, ...pub } = await exportJWK(this.privateKey);
    this.publicJwk = { ...pub, kid: this.env.JWT_KEY_ID, alg: 'ES256', use: 'sig' };
  }

  jwks(): { keys: JWK[] } {
    return { keys: [this.publicJwk] };
  }

  sign(
    claims: Record<string, unknown>,
    opts: { subject: string; audience: string; ttlSeconds: number },
  ) {
    return new SignJWT(claims)
      .setProtectedHeader({ alg: 'ES256', kid: this.env.JWT_KEY_ID, typ: 'JWT' })
      .setIssuer(this.env.PUBLIC_API_ORIGIN)
      .setSubject(opts.subject)
      .setAudience(opts.audience)
      .setIssuedAt()
      .setJti(crypto.randomUUID())
      .setExpirationTime(`${opts.ttlSeconds}s`)
      .sign(this.privateKey);
  }
}
