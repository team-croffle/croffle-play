export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  try {
    return await usePlatformApi().getGame(id);
  } catch (err) {
    rethrowApiError(err);
  }
});
