const TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

/** Uploads a profile picture (raw image body, ≤ 512 KB; the API checks the bytes). */
export default defineEventHandler(async (event) => {
  const type = getRequestHeader(event, 'content-type') ?? '';
  const body = await readRawBody(event, false);
  if (!TYPES.has(type) || !body || body.length > 512 * 1024) {
    throw createError({ statusCode: 422, statusMessage: 'Unprocessable Entity' });
  }
  return { user: await rememberUser(event, await putAvatar(event, body, type)) };
});
