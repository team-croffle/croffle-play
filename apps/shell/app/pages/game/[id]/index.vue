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
  const notice = computed(() => (game.value ? sdkNotice(game.value.sdk) : null));
</script>

<template>
  <div v-if="game">
    <article class="game-detail">
      <div class="game-detail__thumb" aria-hidden="true">{{ game.name.charAt(0) }}</div>
      <div>
        <h1 class="page-title">{{ game.name }}</h1>
        <p>{{ game.description }}</p>
        <p class="muted">
          v{{ game.version }}
          <span v-if="game.serverProtocol"> · 전용 서버 프로토콜 v{{ game.serverProtocol }}</span>
        </p>
        <p v-if="notice" class="notice">{{ notice.text }}</p>
        <NuxtLink v-if="!notice || notice.playable" :to="`/game/${game.id}/play`" class="button">
          플레이
        </NuxtLink>
        <span v-else class="button" aria-disabled="true">플레이할 수 없음</span>
      </div>
    </article>
    <LeaderboardTable :game-id="game.id" />
  </div>
</template>
