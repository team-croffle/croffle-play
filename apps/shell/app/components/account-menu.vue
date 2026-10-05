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
      <NuxtLink to="/dev">내 게임</NuxtLink>
      <NuxtLink v-if="data.user.role === 'admin'" to="/admin">관리</NuxtLink>
      <NuxtLink to="/me" class="account__name">
        <img v-if="data.user.avatar" :src="data.user.avatar" alt="" class="avatar" />
        {{ data.user.nickname }}
      </NuxtLink>
      <button type="button" class="button button--ghost" @click="signOut">로그아웃</button>
    </template>
    <a v-else :href="loginHref(route.fullPath)" class="button">로그인</a>
  </div>
</template>
