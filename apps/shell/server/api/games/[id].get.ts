export default defineEventHandler((event) =>
  proxied(() => usePlatformApi().getGame(getRouterParam(event, 'id') ?? '')),
);
