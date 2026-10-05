/** Changes the nickname (the dashboard). */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ nickname?: unknown }>(event);
  if (typeof body?.nickname !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request' });
  }
  const me = await apiAsUser<{ id: string; nickname: string; avatar: string | null }>(
    event,
    '/v1/me',
    { method: 'PUT', body: { nickname: body.nickname } },
  );
  return { user: await rememberUser(event, me) };
});
