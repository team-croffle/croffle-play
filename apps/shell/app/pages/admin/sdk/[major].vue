<script setup lang="ts">
  import type { SdkDetail } from '~~/shared/types/sdk-admin';

  definePageMeta({ middleware: 'admin' });

  const major = Number(useRoute().params.major);
  const { data, refresh } = await useFetch<SdkDetail>(`/api/admin/sdk/${major}`);
  useHead({ title: () => `SDK v${major} · 관리` });

  const when = (iso: string) => iso.slice(0, 16).replace('T', ' ');
  const describe = (e: SdkDetail['events'][number]) => {
    const to = e.to as Record<string, string | null>;
    if (e.kind === 'adapter_activated') {
      return `어댑터 ${to.version ?? to.adapterUrl} 활성 (${to.source ?? '?'})`;
    }
    if (e.kind === 'status_changed') {
      return `상태 → ${to.status}`;
    }
    return `일정: old ${to.oldAt?.slice(0, 10) ?? '—'}, deprecated ${to.deprecatedAt?.slice(0, 10) ?? '—'}`;
  };
</script>

<template>
  <section v-if="data" class="admin">
    <NuxtLink to="/admin/sdk">← SDK</NuxtLink>
    <h1 class="page-title">
      SDK v{{ data.major }} <span class="muted">· {{ data.status }}</span>
    </h1>

    <h2>어댑터</h2>
    <SdkAdapterPanel :detail="data" @changed="refresh()" />

    <h2>수명주기</h2>
    <SdkLifecycleForm :detail="data" @changed="refresh()" />

    <h2>변경 기록</h2>
    <p v-if="data.events.length === 0" class="muted">기록이 없습니다.</p>
    <table v-else class="table">
      <tbody>
        <tr v-for="e in data.events" :key="e.id">
          <td>{{ when(e.at) }}</td>
          <td>{{ describe(e) }}</td>
          <td class="muted">{{ e.actor ? `계정 ${e.actor.slice(0, 8)}…` : 'api (자동)' }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
