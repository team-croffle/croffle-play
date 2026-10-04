<script setup lang="ts">
  import type { PlayInfo } from '~~/shared/types/play';

  definePageMeta({ middleware: 'admin' });

  const route = useRoute();
  const id = String(route.params.id);
  const version = String(route.params.version);
  const { call, error, busy } = useAdmin();
  const { data: info } = await useFetch<PlayInfo>(
    `/api/admin/games/${id}/versions/${version}/play`,
  );

  useHead({ title: () => `${id}@${version} 미리보기 · 관리` });

  async function decide(action: 'approve' | 'reject') {
    if (await call('POST', `games/${id}/versions/${version}/${action}`)) {
      await navigateTo(`/admin/games/${id}`);
    }
  }
</script>

<template>
  <section class="admin">
    <div class="row">
      <NuxtLink :to="`/admin/games/${id}`">← {{ id }}</NuxtLink>
      <span class="muted">v{{ version }} 미리보기</span>
    </div>
    <p v-if="error" class="error">{{ error }}</p>
    <ClientOnly v-if="info">
      <GamePlayer :info="info" />
    </ClientOnly>
    <p v-else class="muted">재생할 수 없는 버전입니다.</p>
    <div class="row">
      <button type="button" class="button" :disabled="busy" @click="decide('approve')">
        승인 (stable로)
      </button>
      <button type="button" class="button button--ghost" :disabled="busy" @click="decide('reject')">
        반려
      </button>
    </div>
  </section>
</template>
