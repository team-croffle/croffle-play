/** Where games find the shared rooms server (they connect to it directly). */
export default defineEventHandler(() => {
  const url = useRuntimeConfig().roomsUrl;
  if (!url) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }
  return { url };
});
