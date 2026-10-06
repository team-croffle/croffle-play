<script setup lang="ts">
  import type { ServerKeyView } from '~~/shared/types/admin';

  /**
   * Issue, rotate and revoke a game's keys. `base` is the shell route of the key collection for
   * the caller's role, e.g. `/api/admin/games/<id>/server-keys` or
   * `/api/me/games/<id>/deploy-keys`.
   */
  const props = defineProps<{ base: string; issueLabel: string; placeholder: string }>();
  const { data: keys, refresh } = await useFetch<{ items: ServerKeyView[] }>(props.base, {
    headers: useRequestHeaders(['cookie']),
    default: () => ({ items: [] }),
  });
  const newKey = ref<string | null>(null);
  const label = ref('');
  const busy = ref(false);
  const error = ref<string | null>(null);

  async function act(run: () => Promise<unknown>) {
    busy.value = true;
    error.value = null;
    try {
      const res = (await run()) as { key?: string } | null;
      if (res?.key) {
        newKey.value = res.key;
      }
      await refresh();
    } catch (err) {
      const e = err as { statusCode?: number; data?: { data?: { message?: unknown } } };
      if (e.statusCode === 401) {
        await navigateTo(loginHref(useRoute().fullPath), { external: true });
        return;
      }
      const message = e.data?.data?.message;
      error.value = typeof message === 'string' ? message : `요청 실패 (${e.statusCode ?? '?'})`;
    } finally {
      busy.value = false;
    }
  }

  const issue = () =>
    act(() => $fetch(props.base, { method: 'POST', body: { label: label.value } })).then(() => {
      label.value = '';
    });
  const rotate = (keyId: string) =>
    act(() => $fetch(`${props.base}/${keyId}/rotate`, { method: 'POST' }));
  const revoke = (keyId: string) =>
    act(() => $fetch(`${props.base}/${keyId}`, { method: 'DELETE' }));
</script>

<template>
  <div class="stack">
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="newKey" class="notice">
      새 키 (지금만 표시됩니다): <code>{{ newKey }}</code>
    </p>
    <table v-if="keys.items.length" class="table">
      <tbody>
        <tr v-for="k in keys.items" :key="k.id">
          <td>
            <code>{{ k.prefix }}…</code>
          </td>
          <td>{{ k.label }}</td>
          <td>마지막 사용 {{ k.lastUsedAt?.slice(0, 10) ?? '—' }}</td>
          <td class="actions">
            <span v-if="k.revokedAt" class="muted">폐기됨</span>
            <span v-else-if="k.expiresAt" class="muted"
              >{{ k.expiresAt.slice(0, 16).replace('T', ' ') }} 만료</span
            >
            <button
              v-if="!k.revokedAt && !k.expiresAt"
              type="button"
              class="button button--ghost"
              :disabled="busy"
              @click="rotate(k.id)"
            >
              회전
            </button>
            <button
              v-if="!k.revokedAt"
              type="button"
              class="button button--ghost"
              :disabled="busy"
              @click="revoke(k.id)"
            >
              폐기
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <form class="row" @submit.prevent="issue">
      <input v-model="label" class="input" :placeholder="placeholder" />
      <button class="button" type="submit" :disabled="busy">{{ issueLabel }}</button>
    </form>
  </div>
</template>
