<script setup lang="ts">
  const route = useRoute();
  const { data } = await useMe();

  async function signOut() {
    const { redirectTo } = await $fetch<{ redirectTo: string }>('/api/auth/logout', {
      method: 'POST',
    });
    window.location.href = redirectTo;
  }
</script>

<template>
  <div class="account">
    <template v-if="data.user">
      <NuxtLink v-if="data.user.role === 'admin'" to="/admin">관리</NuxtLink>
      <span class="account__name">{{ data.user.nickname }}</span>
      <button type="button" class="button button--ghost" @click="signOut">로그아웃</button>
    </template>
    <a v-else :href="loginHref(route.fullPath)" class="button">로그인</a>
  </div>
</template>
