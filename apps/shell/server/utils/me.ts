import type { H3Event } from 'h3';

/** Keeps the session's copy of the player in step after a profile change. */
export async function rememberUser(
  event: H3Event,
  me: { id: string; nickname: string; avatar: string | null; role?: 'user' | 'admin' },
): Promise<SessionUser | null> {
  const session = await useShellSession(event);
  const auth = session.data.auth;
  if (!auth) {
    return null;
  }
  const user = { ...auth.user, nickname: me.nickname, avatar: me.avatar };
  await session.update({ auth: { ...auth, user } });
  return user;
}

/** Sends a raw avatar image to the API as the signed-in player. */
export async function putAvatar(event: H3Event, body: Buffer, type: string) {
  const token = await accessToken(event);
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }
  return proxied(() =>
    $fetch<{ id: string; nickname: string; avatar: string | null }>('/v1/me/avatar', {
      baseURL: useRuntimeConfig().apiBase,
      method: 'PUT',
      headers: { authorization: `Bearer ${token}`, 'content-type': type },
      body,
    }),
  );
}
