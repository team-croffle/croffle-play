export default defineEventHandler((event) => {
  const id = gameIdParam(event);
  const version = getQuery(event).version;
  return proxied(() =>
    usePlatformApi().getPlayInfo(id, typeof version === 'string' && version ? version : undefined),
  );
});
