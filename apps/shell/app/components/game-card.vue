<script setup lang="ts">
  import type { GameSummary } from '~~/shared/types/game';

  defineProps<{ game: GameSummary }>();
</script>

<template>
  <NuxtLink :to="`/game/${game.id}`" class="game-card">
    <div class="game-card__thumb" aria-hidden="true">{{ game.name.charAt(0) }}</div>
    <div class="game-card__body">
      <h2 class="game-card__title">{{ game.name }}</h2>
      <p class="game-card__desc">{{ game.description }}</p>
    </div>
  </NuxtLink>
</template>
