/** The game server its game.json declares (for the adapter's getServerInfo); 404 when none. */
export default defineEventHandler((event) => {
  const id = gameIdParam(event);
  return proxied(() => usePlatformApi().getServer(id));
});
