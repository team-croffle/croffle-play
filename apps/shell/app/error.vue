<script setup lang="ts">
  import type { NuxtError } from '#app';

  const props = defineProps<{ error: NuxtError }>();
  const notFound = computed(() => props.error.statusCode === 404);
  useHead({ title: notFound.value ? 'Not found · Croffle Play' : 'Error · Croffle Play' });
</script>

<template>
  <div class="layout">
    <main class="content error-page">
      <h1>{{ notFound ? '페이지를 찾을 수 없습니다' : '문제가 발생했습니다' }}</h1>
      <p class="muted">{{ error.statusCode }}</p>
      <button type="button" class="button" @click="clearError({ redirect: '/' })">홈으로</button>
    </main>
  </div>
</template>
