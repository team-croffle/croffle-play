<script setup lang="ts">
  import type { ServerKeyView } from '~~/shared/types/admin';

  /** Issue, rotate and revoke a game's server keys (`csk_…`), as an admin. */
  const props = defineProps<{ gameId: string }>();
  const { call, error, busy } = useAdmin();
  const { data: keys, refresh } = await useFetch<{ items: ServerKeyView[] }>(
    `/api/admin/games/${props.gameId}/server-keys`,
  );
  const newKey = ref<string | null>(null);
  const label = ref('');

  async function issue() {
    const res = await call<{ key: string }>('POST', `games/${props.gameId}/server-keys`, {
      label: label.value,
    });
    newKey.value = res?.key ?? null;
    label.value = '';
    await refresh();
  }

  async function rotate(keyId: string) {
    const res = await call<{ key: string }>(
      'POST',
      `games/${props.gameId}/server-keys/${keyId}/rotate`,
    );
    newKey.value = res?.key ?? null;
    await refresh();
  }

  async function revoke(keyId: string) {
    await call('DELETE', `games/${props.gameId}/server-keys/${keyId}`);
    await refresh();
  }
</script>

<template>
  <div class="stack">
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="newKey" class="notice">
      새 키 (지금만 표시됩니다): <code>{{ newKey }}</code>
    </p>
    <table class="table">
      <tbody>
        <tr v-for="k in keys?.items ?? []" :key="k.id">
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
      <input v-model="label" class="input" placeholder="라벨 (예: game-server)" />
      <button class="button" type="submit" :disabled="busy">서버 키 발급</button>
    </form>
  </div>
</template>
