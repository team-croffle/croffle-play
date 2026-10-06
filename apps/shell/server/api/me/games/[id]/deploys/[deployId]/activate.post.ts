/** Serves an earlier upload again (rollback), as a member of the game. */
export default defineEventHandler(async (event) => {
  const deployId = getRouterParam(event, 'deployId') ?? '';
  if (!/^[0-9a-f-]{36}$/.test(deployId)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }
  const token = await accessToken(event);
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }
  try {
    const res: unknown = await $fetch(
      `/v1/me/games/${gameIdParam(event)}/deploys/${deployId}/activate`,
      {
        baseURL: useRuntimeConfig().apiBase,
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      },
    );
    return res;
  } catch (err) {
    return rethrowWithDetail(err);
  }
});
