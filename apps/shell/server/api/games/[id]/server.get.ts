/** This game's approved server (for the adapter's getServerInfo); 404 when there is none. */
export default defineEventHandler((event) => {
  const id = gameIdParam(event);
  return proxied(() => usePlatformApi().getServer(id));
});
