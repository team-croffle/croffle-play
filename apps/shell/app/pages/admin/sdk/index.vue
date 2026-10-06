<script setup lang="ts">
  import type { AdminSdkInfo } from '~~/shared/types/sdk-admin';

  definePageMeta({ middleware: 'admin' });
  useHead({ title: 'SDK · 관리 · Croffle Play' });

  const { data } = await useFetch<{ items: AdminSdkInfo[]; warnings: string[] }>('/api/admin/sdk', {
    default: () => ({ items: [], warnings: [] }),
  });
  const when = (iso: string | null) => (iso ? iso.slice(0, 10) : '—');
  const version = (url: string | null) => url?.match(/\/v\d+\/([^/]+)\/index\.js$/)?.[1] ?? url;
</script>

<template>
  <section class="admin">
    <NuxtLink to="/admin">← 게임 관리</NuxtLink>
    <h1 class="page-title">SDK · 어댑터</h1>
    <p v-for="w in data.warnings" :key="w" class="notice">{{ w }}</p>
    <table class="table">
      <thead>
        <tr>
          <th>메이저</th>
          <th>상태</th>
          <th>old 예정</th>
          <th>deprecated 예정</th>
          <th>활성 어댑터</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="s in data.items" :key="s.major">
          <td>
            <NuxtLink :to="`/admin/sdk/${s.major}`">v{{ s.major }}</NuxtLink>
          </td>
          <td>{{ s.status }}</td>
          <td>{{ when(s.oldAt) }}</td>
          <td>{{ when(s.deprecatedAt) }}</td>
          <td>
            <code v-if="s.adapterUrl">{{ version(s.adapterUrl) }}</code>
            <span v-else class="muted">없음</span>
          </td>
        </tr>
      </tbody>
    </table>
    <p class="muted">
      메이저는 어댑터가 처음 등록될 때 <code>current</code>로 생긴다. 상태는 앞으로만 움직이고
      (<code>current → lts → old → deprecated</code>), deprecated는 되돌릴 수 없다.
    </p>
  </section>
</template>
