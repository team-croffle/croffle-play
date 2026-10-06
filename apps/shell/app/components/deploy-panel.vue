<script setup lang="ts">
  import type { DeployView, GameHosting } from '~~/shared/types/deploy';

  /**
   * Upload a game build (zip), see the uploads, roll back. `base` is the shell route prefix for
   * the caller's role: `/api/admin/games/<id>` or `/api/me/games/<id>`.
   */
  const props = defineProps<{ base: string; hosting: GameHosting }>();
  const emit = defineEmits<{ changed: [] }>();

  const { data, refresh } = await useFetch<{ items: DeployView[] }>(`${props.base}/deploys`, {
    headers: useRequestHeaders(['cookie']),
    default: () => ({ items: [] }),
  });
  const file = ref<File | null>(null);
  const busy = ref(false);
  const error = ref<string | null>(null);
  const done = ref<string | null>(null);

  function pick(e: Event) {
    file.value = (e.target as HTMLInputElement).files?.[0] ?? null;
    done.value = null;
  }

  async function act(run: () => Promise<unknown>, success: string) {
    busy.value = true;
    error.value = null;
    done.value = null;
    try {
      await run();
      done.value = success;
      await refresh();
      emit('changed');
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

  function upload() {
    const f = file.value;
    if (!f) {
      return;
    }
    return act(
      () =>
        $fetch(`${props.base}/deploys`, {
          method: 'POST',
          body: f,
          headers: { 'content-type': 'application/zip' },
        }),
      `${f.name} 업로드 완료 — 지금 이 빌드가 서비스됩니다.`,
    ).then(() => {
      file.value = null;
    });
  }

  const activate = (d: DeployView) =>
    act(
      () => $fetch(`${props.base}/deploys/${d.id}/activate`, { method: 'POST' }),
      `${when(d.createdAt)} 빌드로 되돌렸습니다.`,
    );

  const when = (iso: string) => iso.slice(0, 16).replace('T', ' ');
  const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
</script>

<template>
  <div class="stack">
    <p v-if="error" class="error">{{ error }}</p>
    <p v-else-if="done" class="notice">{{ done }}</p>
    <form class="row" @submit.prevent="upload">
      <input class="input" type="file" accept=".zip,application/zip" @change="pick" />
      <button class="button" type="submit" :disabled="busy || !file">
        {{ busy ? '올리는 중…' : 'zip 업로드' }}
      </button>
    </form>
    <p class="muted">
      빌드 결과 폴더를 zip으로 묶어 올립니다. 루트(또는 폴더 하나 안)에 <code>game.json</code>이
      있어야 하고, 올리면 바로 그 빌드가 서비스됩니다.
      <template v-if="hosting === 'team'">
        지금은 팀이 직접 호스팅하는 게임입니다 — 업로드하면 플랫폼 호스팅으로 바뀝니다.
      </template>
    </p>
    <table v-if="data.items.length" class="table">
      <tbody>
        <tr v-for="d in data.items" :key="d.id">
          <td>
            <strong v-if="d.active">서비스 중</strong>
            <span v-else class="muted">보관</span>
          </td>
          <td>{{ when(d.createdAt) }}</td>
          <td>{{ d.version ?? '—' }}</td>
          <td class="muted">{{ d.fileCount }}개 · {{ mb(d.size) }}</td>
          <td class="actions">
            <button
              v-if="!d.active"
              type="button"
              class="button button--ghost"
              :disabled="busy"
              @click="activate(d)"
            >
              이 빌드로 되돌리기
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else class="muted">아직 올린 빌드가 없습니다.</p>
  </div>
</template>
