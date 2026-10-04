<script setup lang="ts">
  const token = ref('');
  const failed = ref(false);

  async function signIn() {
    failed.value = false;
    try {
      await $fetch('/api/admin/session', { method: 'POST', body: { token: token.value } });
      await navigateTo('/admin');
    } catch {
      failed.value = true;
    }
  }

  useHead({ title: '관리자 로그인 · Croffle Play' });
</script>

<template>
  <section class="admin narrow">
    <h1 class="page-title">관리자</h1>
    <form class="stack" @submit.prevent="signIn">
      <label class="stack">
        관리자 토큰
        <input v-model="token" type="password" autocomplete="off" required class="input" />
      </label>
      <p v-if="failed" class="error">토큰이 올바르지 않습니다.</p>
      <button class="button" type="submit">로그인</button>
    </form>
  </section>
</template>
