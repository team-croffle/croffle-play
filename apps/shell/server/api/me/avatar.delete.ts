/** Removes the uploaded profile picture. */
export default defineEventHandler(async (event) => {
  const me = await apiAsUser<{ id: string; nickname: string; avatar: string | null }>(
    event,
    '/v1/me/avatar',
    { method: 'DELETE' },
  );
  return { user: await rememberUser(event, me) };
});
