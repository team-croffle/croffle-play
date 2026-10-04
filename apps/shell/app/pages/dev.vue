<script setup lang="ts">
  import type { MyGame } from '~~/shared/types/dev';

  const route = useRoute();
  const { data: me } = await useMe();
  if (!me.value.user) {
    await navigateTo(loginHref(route.fullPath), { external: true });
  }
  const { data } = await useFetch<{ items: MyGame[] }>('/api/me/games', {
    headers: useRequestHeaders(['cookie']),
    default: () => ({ items: [] }),
  });
  useHead({ title: '내 게임 · Croffle Play' });
</script>

<template>
  <section v-if="me.user" class="admin">
    <h1 class="page-title">내 게임</h1>
    <p class="muted">
      계정 id <code>{{ me.user.id }}</code> — 게임 멤버로 추가해 달라고 관리자에게 알려 주세요.
    </p>
    <p v-if="data.items.length === 0" class="muted">아직 멤버로 등록된 게임이 없습니다.</p>
    <article v-for="g in data.items" :key="g.id" class="dev-game">
      <h2>
        <NuxtLink :to="`/game/${g.id}`">{{ g.name }}</NuxtLink>
        <span class="muted"> · {{ g.role }}</span>
      </h2>
      <p class="muted">
        stable {{ g.stableVersion ?? '—' }} · preview {{ g.previewVersion ?? '—' }}
        <template v-if="g.latest">
          · 최근 {{ g.latest.version }} ({{ g.latest.status }}, SDK v{{ g.latest.sdkMajor }})
        </template>
      </p>
      <ul v-if="g.warnings.length" class="dev-game__warnings">
        <li v-for="w in g.warnings" :key="w">{{ w }}</li>
      </ul>
    </article>
  </section>
</template>
