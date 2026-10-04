export default defineEventHandler(async () => {
  try {
    return await usePlatformApi().listGames();
  } catch (err) {
    rethrowApiError(err);
  }
});
