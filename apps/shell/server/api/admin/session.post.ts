import * as v from 'valibot';

const bodySchema = v.object({ token: v.pipe(v.string(), v.minLength(1), v.maxLength(512)) });

/** Admin sign-in: the token is checked against the API, then kept in the sealed session. */
export default defineEventHandler(async (event) => {
  const { token } = await readValidatedBody(event, (b) => v.parse(bodySchema, b));
  try {
    await $fetch('/v1/admin/games', {
      baseURL: useRuntimeConfig().apiBase,
      headers: { authorization: `Bearer ${token}` },
    });
  } catch (err) {
    rethrowApiError(err);
  }
  const session = await useShellSession(event);
  await session.update({ adminToken: token });
  setResponseStatus(event, 204);
  return null;
});
