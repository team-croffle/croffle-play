<script setup lang="ts">
  const route = useRoute();
  const id = computed(() => String(route.params.id));
  const { data: game, error } = await useFetch(() => `/api/games/${id.value}`);

  if (error.value) {
    throw createError({
      statusCode: error.value.statusCode ?? 500,
      statusMessage: error.value.statusMessage,
      fatal: true,
    });
  }

  useHead({ title: () => `${game.value?.name ?? ''} · Croffle Play` });
</script>

<template>
  <div v-if="game">
    <article class="game-detail">
      <div class="game-detail__thumb" aria-hidden="true">{{ game.name.charAt(0) }}</div>
      <div>
        <h1 class="page-title">{{ game.name }}</h1>
        <p>{{ game.description }}</p>
        <p class="muted">v{{ game.version }}</p>
        <NuxtLink :to="`/game/${game.id}/play`" class="button">플레이</NuxtLink>
      </div>
    </article>
    <LeaderboardTable :game-id="game.id" />
  </div>
</template>
