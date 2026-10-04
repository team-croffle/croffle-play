/** The signed-in player for the shell UI, or null. Tokens never leave the server. */
export default defineEventHandler(async (event) => {
  const auth = (await useShellSession(event)).data.auth;
  return { user: auth?.user ?? null };
});
