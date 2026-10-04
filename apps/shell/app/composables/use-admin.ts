type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

/** Calls the admin API through the shell; a lost session sends the admin back to sign-in. */
export function useAdmin() {
  const error = ref<string | null>(null);
  const busy = ref(false);

  async function call<T>(method: Method, path: string, body?: object): Promise<T | undefined> {
    busy.value = true;
    error.value = null;
    try {
      // A plain string (not a typed route literal) so every admin method type-checks.
      const url: string = `/api/admin/${path}`;
      const res: unknown = await $fetch(url, {
        method,
        ...(body ? { body } : {}),
      });
      // 204 responses come back empty; callers only need to know it worked.
      return (res ?? true) as T;
    } catch (err) {
      const e = err as { statusCode?: number; data?: { data?: { message?: unknown } } };
      if (e.statusCode === 401) {
        await navigateTo('/admin/login');
        return undefined;
      }
      const message = e.data?.data?.message;
      error.value = typeof message === 'string' ? message : `요청 실패 (${e.statusCode ?? '?'})`;
      return undefined;
    } finally {
      busy.value = false;
    }
  }

  return { call, error, busy };
}
