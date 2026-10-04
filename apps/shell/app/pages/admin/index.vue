<script setup lang="ts">
  import type { AdminGame } from '~~/shared/types/admin';

  definePageMeta({ middleware: 'admin' });
  useHead({ title: '관리 · Croffle Play' });

  const { call, error, busy } = useAdmin();
  const { data } = await useFetch<{ items: AdminGame[] }>('/api/admin/games');
  const form = reactive({ id: '', name: '', description: '' });

  async function create() {
    const game = await call<AdminGame>('POST', 'games', { ...form });
    if (game) {
      await navigateTo(`/admin/games/${game.id}`);
    }
  }
</script>

<template>
  <section class="admin">
    <h1 class="page-title">게임 관리</h1>
    <table class="table">
      <thead>
        <tr>
          <th>id</th>
          <th>이름</th>
          <th>stable</th>
          <th>preview</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="g in data?.items ?? []" :key="g.id">
          <td>
            <NuxtLink :to="`/admin/games/${g.id}`">{{ g.id }}</NuxtLink>
          </td>
          <td>{{ g.name }}</td>
          <td>{{ g.stableVersion ?? '—' }}</td>
          <td>{{ g.previewVersion ?? '—' }}</td>
        </tr>
      </tbody>
    </table>

    <h2>새 게임</h2>
    <form class="stack narrow" @submit.prevent="create">
      <input v-model="form.id" class="input" placeholder="id (예: block-drop)" required />
      <input v-model="form.name" class="input" placeholder="이름" required />
      <textarea v-model="form.description" class="input" placeholder="설명" rows="3" />
      <p v-if="error" class="error">{{ error }}</p>
      <button class="button" type="submit" :disabled="busy">등록</button>
    </form>
  </section>
</template>
