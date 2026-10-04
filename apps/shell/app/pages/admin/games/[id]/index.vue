<script setup lang="ts">
  import type { AdminGame, AdminVersion, DeployKeyView } from '~~/shared/types/admin';

  definePageMeta({ middleware: 'admin' });

  const route = useRoute();
  const id = String(route.params.id);
  const { call, error, busy } = useAdmin();
  const { data: game, refresh: refreshGame } = await useFetch<
    AdminGame & { versions: AdminVersion[] }
  >(`/api/admin/games/${id}`);
  const { data: keys, refresh: refreshKeys } = await useFetch<{ items: DeployKeyView[] }>(
    `/api/admin/games/${id}/deploy-keys`,
  );
  const newKey = ref<string | null>(null);
  const keyLabel = ref('');

  useHead({ title: () => `${game.value?.name ?? id} · 관리` });

  async function act(path: string, body?: object) {
    if (await call('POST', path, body)) {
      await refreshGame();
    }
  }

  async function issueKey() {
    const res = await call<{ key: string }>('POST', `games/${id}/deploy-keys`, {
      label: keyLabel.value,
    });
    newKey.value = res?.key ?? null;
    keyLabel.value = '';
    await refreshKeys();
  }

  async function revokeKey(keyId: string) {
    await call('DELETE', `games/${id}/deploy-keys/${keyId}`);
    await refreshKeys();
  }
</script>

<template>
  <section v-if="game" class="admin">
    <NuxtLink to="/admin">← 게임 관리</NuxtLink>
    <h1 class="page-title">
      {{ game.name }} <span class="muted">({{ game.id }})</span>
    </h1>
    <p class="muted">
      stable {{ game.stableVersion ?? '—' }} · preview {{ game.previewVersion ?? '—' }}
    </p>
    <p v-if="error" class="error">{{ error }}</p>

    <h2>버전</h2>
    <table class="table">
      <thead>
        <tr>
          <th>버전</th>
          <th>상태</th>
          <th>SDK</th>
          <th>업로드</th>
          <th />
        </tr>
      </thead>
      <tbody>
        <tr v-for="v in game.versions" :key="v.version">
          <td>
            <NuxtLink
              v-if="v.status !== 'pending'"
              :to="`/admin/games/${game.id}/versions/${v.version}`"
            >
              {{ v.version }}
            </NuxtLink>
            <span v-else>{{ v.version }}</span>
            <span v-if="v.version === game.stableVersion" class="badge">stable</span>
          </td>
          <td>{{ v.status }}</td>
          <td>v{{ v.sdkMajor }}</td>
          <td>{{ v.uploadedAt?.slice(0, 16).replace('T', ' ') ?? '—' }}</td>
          <td class="actions">
            <button
              v-if="v.status === 'uploaded'"
              type="button"
              class="button"
              :disabled="busy"
              @click="act(`games/${game.id}/versions/${v.version}/approve`)"
            >
              승인
            </button>
            <button
              v-if="v.status === 'approved' && v.version !== game.stableVersion"
              type="button"
              class="button button--ghost"
              :disabled="busy"
              @click="act(`games/${game.id}/rollback`, { version: v.version })"
            >
              이 버전으로 롤백
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <h2>배포 키</h2>
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
            <button
              v-else
              type="button"
              class="button button--ghost"
              :disabled="busy"
              @click="revokeKey(k.id)"
            >
              폐기
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <form class="row" @submit.prevent="issueKey">
      <input v-model="keyLabel" class="input" placeholder="라벨 (예: github-actions)" />
      <button class="button" type="submit" :disabled="busy">키 발급</button>
    </form>
  </section>
</template>
