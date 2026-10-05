<script setup lang="ts">
  import type { PlayInfo } from '~~/shared/types/play';

  const route = useRoute();
  const id = computed(() => String(route.params.id));
  // Admins preview unlisted games from the admin page (`?preview=1`).
  const preview = computed(() => route.query.preview === '1');
  const { data: info, error } = await useFetch<PlayInfo>(() =>
    preview.value ? `/api/admin/games/${id.value}/play` : `/api/games/${id.value}/play`,
  );

  if (error.value) {
    throw createError({
      statusCode: error.value.statusCode ?? 500,
      statusMessage: error.value.statusMessage,
      fatal: true,
    });
  }

  useHead({ title: () => `${info.value?.name ?? ''} · Croffle Play` });
</script>

<template>
  <section v-if="info" class="play">
    <div class="play__bar">
      <NuxtLink :to="preview ? `/admin/games/${info.id}` : `/game/${info.id}`">
        ← {{ info.name }}
      </NuxtLink>
      <span v-if="preview" class="badge">미리보기</span>
    </div>
    <ClientOnly>
      <GamePlayer :info="info" />
      <template #fallback>
        <div class="player"><div class="player__overlay">불러오는 중…</div></div>
      </template>
    </ClientOnly>
  </section>
</template>
