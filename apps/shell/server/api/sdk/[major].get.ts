export default defineEventHandler((event) => {
  const major = Number(getRouterParam(event, 'major'));
  if (!Number.isInteger(major) || major < 1) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request' });
  }
  return proxied(() => usePlatformApi().getSdk(major));
});
