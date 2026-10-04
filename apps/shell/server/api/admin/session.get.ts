export default defineEventHandler(async (event) => {
  const session = await useShellSession(event);
  return { admin: Boolean(session.data.adminToken) };
});
