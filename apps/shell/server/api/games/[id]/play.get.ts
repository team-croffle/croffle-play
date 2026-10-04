export default defineEventHandler((event) => {
  const version = getQuery(event).version;
  return proxied(() =>
    usePlatformApi().getPlayInfo(
      getRouterParam(event, 'id') ?? '',
      typeof version === 'string' && version ? version : undefined,
    ),
  );
});
