/** Whether the signed-in player may use the admin pages (the API enforces it again). */
export default defineEventHandler(async (event) => {
  const user = (await useShellSession(event)).data.auth?.user;
  return { signedIn: Boolean(user), admin: user?.role === 'admin' };
});
