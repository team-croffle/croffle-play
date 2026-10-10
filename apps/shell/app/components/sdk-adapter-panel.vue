<script setup lang="ts">
  import type { SdkDetail } from '~~/shared/types/sdk-admin';

  /**
   * A major's adapters: what npm offers (install), what is registered (switch, remove), and the
   * sync that keeps the newest compatible release active.
   */
  const props = defineProps<{ detail: SdkDetail }>();
  const emit = defineEmits<{ changed: [] }>();
  const { call, error, busy } = useAdmin();

  async function act(method: 'POST' | 'DELETE', path: string, body?: object) {
    const ok = await call(method, path, body);
    if (ok) {
      emit('changed');
    }
  }
  const install = (version: string) =>
    act('POST', `sdk/${props.detail.major}/adapters`, { version });
  const activate = (version: string) =>
    act('POST', `sdk/${props.detail.major}/adapter`, { version });
  const remove = (version: string) =>
    act('DELETE', `sdk/${props.detail.major}/adapters/${version}`);
  const syncNow = () => act('POST', 'sdk/sync');

  const when = (iso: string) => iso.slice(0, 16).replace('T', ' ');
  const notInstalled = computed(() => (props.detail.available ?? []).filter((a) => !a.installed));
</script>

<template>
  <div class="stack">
    <p v-if="error" class="error">{{ error }}</p>
    <p class="muted">
      <template v-if="detail.sync.intervalSeconds > 0">
        api가 {{ Math.round(detail.sync.intervalSeconds / 60) }}분마다 npm에서 가장 새
        <strong>호환</strong> 버전을 받아 활성화합니다(마지막:
        {{ detail.sync.lastRunAt ? when(detail.sync.lastRunAt) : '아직' }}). 여기서 바꾼 버전은 더
        새 호환 버전이 나오기 전까지 유지됩니다.
      </template>
      <template v-else>
        자동 동기화가 꺼져 있습니다(`ADAPTER_SYNC_INTERVAL_SECONDS=0`). 여기서 고른 버전이 그대로
        유지됩니다.
      </template>
      <button type="button" class="button button--ghost" :disabled="busy" @click="syncNow">
        지금 동기화
      </button>
    </p>

    <h3>npm에 있는 버전</h3>
    <p v-if="detail.availableError" class="notice">
      레지스트리를 읽지 못했습니다: {{ detail.availableError }}
    </p>
    <p v-else-if="notInstalled.length === 0" class="muted">설치할 새 버전이 없습니다.</p>
    <table v-else class="table">
      <tbody>
        <tr v-for="a in notInstalled" :key="a.version">
          <td>
            <code>{{ a.version }}</code>
          </td>
          <td class="muted">api {{ a.requiresApi ?? '제한 없음' }}</td>
          <td class="actions">
            <button
              v-if="a.compatible"
              type="button"
              class="button button--ghost"
              :disabled="busy"
              @click="install(a.version)"
            >
              설치하고 활성화
            </button>
            <span v-else class="muted">이 api 버전과 호환되지 않음</span>
          </td>
        </tr>
      </tbody>
    </table>

    <h3>등록된 버전</h3>
    <p v-if="detail.adapters.length === 0" class="muted">등록된 어댑터가 없습니다.</p>
    <table v-else class="table">
      <tbody>
        <tr v-for="a in detail.adapters" :key="a.version">
          <td>
            <strong v-if="a.active">활성</strong>
            <span v-else class="muted">보관</span>
          </td>
          <td>
            <code>{{ a.version }}</code>
          </td>
          <td class="muted">{{ a.source }} · {{ when(a.registeredAt) }}</td>
          <td class="muted">
            <code>{{ a.sri.slice(0, 24) }}…</code>
          </td>
          <td class="actions">
            <button
              v-if="!a.active && a.source !== 'dev'"
              type="button"
              class="button button--ghost"
              :disabled="busy"
              @click="activate(a.version)"
            >
              이 버전으로 전환
            </button>
            <button
              v-if="!a.active"
              type="button"
              class="button button--ghost"
              :disabled="busy"
              @click="remove(a.version)"
            >
              삭제
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
