export default defineEventHandler((event) => {
  const id = gameIdParam(event);
  const limit = Math.min(Math.max(Number(getQuery(event).limit) || 10, 1), 100);
  return proxied(() => usePlatformApi().getLeaderboard(id, limit));
});
