<script setup lang="ts">
  import type { MyGame } from '~~/shared/types/dev';

  const route = useRoute();
  const { data: me } = await useMe();
  if (!me.value.user) {
    await navigateTo(loginHref(route.fullPath), { external: true });
  }
  const { data, refresh } = await useFetch<{ items: MyGame[] }>('/api/me/games', {
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
        <a :href="g.url" target="_blank" rel="noopener">{{ g.url }}</a>
        · {{ g.listed ? '공개' : '비공개' }}
        <template v-if="g.sdk"> · SDK v{{ g.sdk.major }} ({{ g.sdk.status }})</template>
      </p>
      <ul v-if="g.warnings.length" class="dev-game__warnings">
        <li v-for="w in g.warnings" :key="w">{{ w }}</li>
      </ul>
      <details class="dev-game__deploys">
        <summary>
          업로드 호스팅
          <span class="muted">
            · {{ g.hosting === 'platform' ? '플랫폼이 서비스 중' : '팀이 직접 호스팅' }}
          </span>
        </summary>
        <DeployPanel :base="`/api/me/games/${g.id}`" :hosting="g.hosting" @changed="refresh()" />
      </details>
      <details class="dev-game__deploys">
        <summary>배포 키 <span class="muted">· CI · play-cli deploy</span></summary>
        <p class="muted">
          <code>CROFFLE_DEPLOY_KEY</code>로 넘기면 <code>play-cli deploy</code>가 로그인 없이 이
          게임에 빌드를 올립니다. 키는 발급할 때 한 번만 보입니다.
        </p>
        <GameKeysPanel
          :base="`/api/me/games/${g.id}/deploy-keys`"
          issue-label="배포 키 발급"
          placeholder="라벨 (예: github-actions)"
        />
      </details>
    </article>
  </section>
</template>
