<script setup lang="ts">
  import type { SessionUser } from '~~/server/utils/session';

  const route = useRoute();
  const { data: me, refresh } = await useMe();
  if (!me.value.user) {
    await navigateTo(loginHref(route.fullPath), { external: true });
  }
  useHead({ title: '내 정보 · Croffle Play' });

  const nickname = ref(me.value.user?.nickname ?? '');
  const busy = ref(false);
  const message = ref('');

  async function run(action: () => Promise<{ user: SessionUser | null }>, done: string) {
    busy.value = true;
    message.value = '';
    try {
      await action();
      await refresh();
      message.value = done;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      message.value =
        status === 422
          ? 'PNG, JPEG, WebP 이미지(64×64 이상, 512KB 이하)만 올릴 수 있습니다.'
          : '저장하지 못했습니다. 잠시 후 다시 시도해 주세요.';
    } finally {
      busy.value = false;
    }
  }

  function saveNickname() {
    return run(
      () => $fetch('/api/me', { method: 'PUT', body: { nickname: nickname.value } }),
      '닉네임을 바꿨습니다.',
    );
  }

  function upload(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) {
      return;
    }
    return run(
      () =>
        $fetch('/api/me/avatar', {
          method: 'PUT',
          body: file,
          headers: { 'content-type': file.type },
        }),
      '프로필 사진을 바꿨습니다.',
    );
  }

  function removeAvatar() {
    return run(() => $fetch('/api/me/avatar', { method: 'DELETE' }), '프로필 사진을 지웠습니다.');
  }
</script>

<template>
  <section v-if="me.user" class="admin">
    <h1 class="page-title">내 정보</h1>
    <div class="row">
      <img v-if="me.user.avatar" :src="me.user.avatar" alt="" class="avatar avatar--large" />
      <div v-else class="avatar avatar--large" aria-hidden="true">
        {{ me.user.nickname.charAt(0) }}
      </div>
      <div class="stack">
        <label class="button button--ghost">
          사진 올리기
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            :disabled="busy"
            @change="upload"
          />
        </label>
        <button
          v-if="me.user.avatar"
          type="button"
          class="button button--ghost"
          :disabled="busy"
          @click="removeAvatar"
        >
          사진 지우기
        </button>
      </div>
    </div>

    <h2>닉네임</h2>
    <form class="row" @submit.prevent="saveNickname">
      <input v-model="nickname" class="input" maxlength="24" required />
      <button class="button" type="submit" :disabled="busy">저장</button>
    </form>
    <p v-if="message" class="notice" role="status">{{ message }}</p>

    <h2>계정</h2>
    <p class="muted">
      계정 id <code>{{ me.user.id }}</code> · {{ me.user.role === 'admin' ? '관리자' : '플레이어' }}
    </p>
  </section>
</template>
