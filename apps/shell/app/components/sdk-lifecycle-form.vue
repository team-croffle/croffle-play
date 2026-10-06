<script setup lang="ts">
  import type { SdkDetail, SdkStatus } from '~~/shared/types/sdk-admin';

  /** Status (forward only) and the old/deprecated dates of a major; deprecating asks for the major back. */
  const props = defineProps<{ detail: SdkDetail }>();
  const emit = defineEmits<{ changed: [] }>();
  const { call, error, busy } = useAdmin();

  const ORDER: SdkStatus[] = ['current', 'lts', 'old', 'deprecated'];
  const next = computed(() => ORDER.slice(ORDER.indexOf(props.detail.status) + 1));
  const toLocal = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : '');
  const form = reactive({
    status: props.detail.status as SdkStatus,
    oldAt: toLocal(props.detail.oldAt),
    deprecatedAt: toLocal(props.detail.deprecatedAt),
    confirm: '',
  });
  const deprecating = computed(
    () =>
      form.status === 'deprecated' ||
      (form.deprecatedAt !== '' && new Date(`${form.deprecatedAt}Z`) <= new Date()),
  );

  async function save() {
    const body: Record<string, unknown> = {
      oldAt: form.oldAt ? new Date(`${form.oldAt}Z`).toISOString() : null,
      deprecatedAt: form.deprecatedAt ? new Date(`${form.deprecatedAt}Z`).toISOString() : null,
    };
    if (form.status !== props.detail.status) {
      body.status = form.status;
    }
    if (deprecating.value) {
      body.confirm = Number(form.confirm);
    }
    const ok = await call('PATCH', `sdk/${props.detail.major}`, body);
    if (ok) {
      form.confirm = '';
      emit('changed');
    }
  }
</script>

<template>
  <form class="stack narrow" @submit.prevent="save">
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="detail.status === 'deprecated'" class="notice">
      deprecated: 이 메이저로 만든 게임은 실행되지 않습니다. 되돌릴 수 없습니다.
    </p>
    <template v-else>
      <label>
        상태
        <select v-model="form.status" class="input">
          <option :value="detail.status">{{ detail.status }} (지금)</option>
          <option v-for="s in next" :key="s" :value="s">{{ s }}</option>
        </select>
      </label>
      <label>
        old 시작 (UTC)
        <input v-model="form.oldAt" class="input" type="datetime-local" />
      </label>
      <label>
        deprecated 시작 (UTC)
        <input v-model="form.deprecatedAt" class="input" type="datetime-local" />
      </label>
      <p class="muted">
        날짜가 되면 자동으로 적용되고 그 메이저의 게임 저장소에 알림이 갑니다. old = 새 등록·수정
        거부, deprecated = 실행 중단.
      </p>
      <label v-if="deprecating" class="notice">
        deprecated로 바꾸면 이 메이저의 게임이 모두 멈춥니다. 확인하려면 메이저 번호
        <code>{{ detail.major }}</code
        >를 입력하세요.
        <input v-model="form.confirm" class="input" inputmode="numeric" required />
      </label>
      <button class="button" type="submit" :disabled="busy">저장</button>
    </template>
  </form>
</template>
