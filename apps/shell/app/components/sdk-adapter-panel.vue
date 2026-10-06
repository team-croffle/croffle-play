<script setup lang="ts">
  import type { SdkDetail } from '~~/shared/types/sdk-admin';

  /** Registered adapter versions of a major, with a switch to serve another one. */
  const props = defineProps<{ detail: SdkDetail }>();
  const emit = defineEmits<{ changed: [] }>();
  const { call, error, busy } = useAdmin();

  async function activate(version: string) {
    const ok = await call('POST', `sdk/${props.detail.major}/adapter`, { version });
    if (ok) {
      emit('changed');
    }
  }
  const when = (iso: string) => iso.slice(0, 16).replace('T', ' ');
</script>

<template>
  <div class="stack">
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="detail.imageWins" class="notice">
      api가 시작할 때마다 이미지에 든 어댑터를 활성화합니다. 여기서 바꾼 버전은 다음 api 시작
      때까지만 유지되고, 어댑터를 되돌리는 정식 방법은 이전 api 이미지로 되돌리는 것입니다.
    </p>
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
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
