<script setup lang="ts">
  import type { GameSummary } from '~~/shared/types/game';

  const props = defineProps<{ game: GameSummary }>();
  const notice = computed(() => sdkNotice(props.game.sdk));
</script>

<template>
  <NuxtLink :to="`/game/${game.id}`" class="game-card">
    <img
      v-if="game.thumbnailUrl"
      class="game-card__thumb"
      :src="game.thumbnailUrl"
      alt=""
      loading="lazy"
      referrerpolicy="no-referrer"
    />
    <div v-else class="game-card__thumb" aria-hidden="true">{{ game.name.charAt(0) }}</div>
    <div class="game-card__body">
      <h2 class="game-card__title">
        {{ game.name }}
        <span v-if="notice" class="badge badge--warn">{{ notice.badge }}</span>
      </h2>
      <p class="game-card__desc">{{ game.description }}</p>
    </div>
  </NuxtLink>
</template>
