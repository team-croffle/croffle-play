export default defineEventHandler(async (event) => {
  await (await useShellSession(event)).clear();
  setResponseStatus(event, 204);
  return null;
});
