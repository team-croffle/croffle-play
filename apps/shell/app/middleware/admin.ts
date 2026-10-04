/** Admin pages: signed-in admins only. */
export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/admin/login') {
    return;
  }
  const { admin } = await $fetch('/api/admin/session', { headers: useRequestHeaders(['cookie']) });
  if (!admin) {
    return navigateTo('/admin/login');
  }
});
