/** Admin pages: signed-in players with the admin role. */
export default defineNuxtRouteMiddleware(async (to) => {
  const { signedIn, admin } = await $fetch('/api/admin/session', {
    headers: useRequestHeaders(['cookie']),
  });
  if (!signedIn) {
    return navigateTo(loginHref(to.fullPath), { external: true });
  }
  if (!admin) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden', fatal: true });
  }
});
