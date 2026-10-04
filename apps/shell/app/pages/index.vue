<script setup lang="ts">
  const { data: games, error } = await useFetch('/api/games', { default: () => [] });
  useHead({ title: 'Croffle Play' });
</script>

<template>
  <section>
    <h1 class="page-title">게임</h1>
    <p v-if="error" class="muted">카탈로그를 불러오지 못했습니다.</p>
    <p v-else-if="games.length === 0" class="muted">아직 공개된 게임이 없습니다.</p>
    <div v-else class="game-grid">
      <GameCard v-for="game in games" :key="game.id" :game="game" />
    </div>
  </section>
</template>
