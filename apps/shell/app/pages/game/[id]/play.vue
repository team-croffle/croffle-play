<script setup lang="ts">
  const route = useRoute();
  const id = computed(() => String(route.params.id));
  const version = computed(() =>
    typeof route.query.version === 'string' && route.query.version
      ? route.query.version
      : undefined,
  );
  const { data: info, error } = await useFetch(() => `/api/games/${id.value}/play`, {
    query: { version },
  });

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
      <NuxtLink :to="`/game/${info.id}`">← {{ info.name }}</NuxtLink>
      <span class="muted">v{{ info.version }}</span>
    </div>
    <ClientOnly>
      <GamePlayer :info="info" />
      <template #fallback>
        <div class="player"><div class="player__overlay">불러오는 중…</div></div>
      </template>
    </ClientOnly>
  </section>
</template>
