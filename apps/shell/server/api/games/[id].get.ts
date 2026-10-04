export default defineEventHandler((event) => {
  const id = gameIdParam(event);
  return proxied(() => usePlatformApi().getGame(id));
});
