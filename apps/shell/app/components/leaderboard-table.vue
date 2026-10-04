<script setup lang="ts">
  import type { Leaderboard } from '~~/shared/types/play';

  const props = defineProps<{ gameId: string }>();
  const { data } = await useFetch<Leaderboard>(() => `/api/games/${props.gameId}/leaderboard`, {
    query: { limit: 10 },
    default: (): Leaderboard => ({ policy: 'client', items: [] }),
  });
</script>

<template>
  <section class="leaderboard">
    <h2>리더보드</h2>
    <p v-if="data.policy === 'client' && data.items.length > 0" class="muted leaderboard__note">
      브라우저가 보고한 점수라 검증되지 않았습니다.
    </p>
    <p v-if="data.items.length === 0" class="muted">아직 기록이 없습니다.</p>
    <ol v-else class="leaderboard__list">
      <li v-for="e in data.items" :key="e.user.id">
        <span class="leaderboard__rank">{{ e.rank }}</span>
        <span class="leaderboard__name">{{ e.user.nickname }}</span>
        <span class="leaderboard__score">{{ e.score.toLocaleString() }}</span>
      </li>
    </ol>
  </section>
</template>
