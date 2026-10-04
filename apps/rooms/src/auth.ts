import { isValidGameId } from '@croffledev/play-protocol';
import { createRemoteJWKSet, type JWTVerifyGetKey, jwtVerify } from 'jose';

export interface Identity {
  userId: string;
  nickname: string;
  gameId: string;
}

export type VerifyToken = (token: string) => Promise<Identity | null>;

/**
 * Game tokens from the platform API: `aud: game:<id>`, signed with the platform key (JWKS).
 * The game id comes from the token, never from the client.
 */
export function tokenVerifier(keys: JWTVerifyGetKey, issuer: string): VerifyToken {
  return async (token) => {
    try {
      const { payload } = await jwtVerify(token, keys, { issuer, clockTolerance: 10 });
      const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
      const gameId = aud.length === 1 ? /^game:(.+)$/.exec(aud[0] ?? '')?.[1] : undefined;
      if (!gameId || !isValidGameId(gameId) || typeof payload.sub !== 'string') {
        return null;
      }
      const nickname = typeof payload.nickname === 'string' ? payload.nickname : 'player';
      return { userId: payload.sub, nickname, gameId };
    } catch {
      return null;
    }
  };
}

export function remoteVerifier(jwksUrl: string, issuer: string): VerifyToken {
  return tokenVerifier(createRemoteJWKSet(new URL(jwksUrl), { cacheMaxAge: 10 * 60_000 }), issuer);
}
