<script setup lang="ts">
  import { parseHello, sdkMajor, type Welcome } from '@croffledev/play-protocol';
  import type { MountedAdapter } from '@croffledev/play-protocol/host';
  import type { PlayInfo, SdkInfo } from '~~/shared/types/play';

  const props = defineProps<{ info: PlayInfo }>();

  const frame = ref<HTMLIFrameElement | null>(null);
  const stage = ref<HTMLElement | null>(null);
  const failure = ref<string | null>(null);
  const loaded = ref(false);
  const notice = ref('');
  const loginPrompt = ref(false);
  const route = useRoute();

  const gameOrigin = new URL(props.info.url).origin;
  const NOT_UPDATED =
    '이 게임은 업데이트되지 않아 실행할 수 없습니다. 제작자가 업데이트하면 다시 플레이할 수 있습니다.';

  let mounted: MountedAdapter | null = null;
  let welcome: Welcome | null = null;
  let starting = false;
  let offHello: (() => void) | undefined;
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;
  let loadingTimer: ReturnType<typeof setTimeout> | undefined;

  function fail(reason: string) {
    failure.value = reason;
    mounted?.dispose();
    mounted = null;
  }

  function notify(message: string) {
    notice.value = message;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => (notice.value = ''), 4000);
  }

  /** The SDK major the game says it was built with decides the host adapter (and whether it runs). */
  async function adapterFor(version: string) {
    const major = sdkMajor(version);
    const sdk =
      major === null ? null : await $fetch<SdkInfo>(`/api/sdk/${major}`).catch(() => null);
    if (!sdk || sdk.status === 'deprecated' || !sdk.adapterUrl || !sdk.sri) {
      return null;
    }
    const mod = await loadAdapter(sdk.adapterUrl, sdk.sri);
    if (mod.major !== major) {
      throw new Error(`Adapter is for SDK v${mod.major}`);
    }
    return mod;
  }

  onMounted(() => {
    if (!frame.value) {
      return;
    }
    const port = createGamePort(frame.value, gameOrigin, window);
    offHello = port.onMessage(async (raw) => {
      const hello = parseHello(raw);
      if (!hello) {
        return;
      }
      // The SDK repeats __hello until it hears back; answer repeats with the same welcome.
      if (welcome) {
        port.post(welcome);
        return;
      }
      if (starting) {
        return;
      }
      starting = true;
      if (hello.game !== props.info.id) {
        fail('게임이 등록 정보와 맞지 않아 실행할 수 없습니다.');
        return;
      }
      try {
        const mod = await adapterFor(hello.sdk);
        if (!mod) {
          fail(NOT_UPDATED);
          return;
        }
        const core = createHostCore({
          gameId: props.info.id,
          // The platform does not track game versions (the team hosts the game).
          version: '',
          stage: () => stage.value,
          onGameReady: () => (loaded.value = true),
          onNotify: notify,
          onLoginRequested: () => (loginPrompt.value = true),
          onExit: () => void navigateTo(`/game/${props.info.id}`),
        });
        mounted = mod.mount({ core, port, sdkVersion: hello.sdk });
        welcome = { type: '__welcome', capabilities: mounted.capabilities };
        port.post(welcome);
        // Games that never call sdk.ready() still get revealed.
        loadingTimer = setTimeout(() => (loaded.value = true), 15_000);
      } catch {
        fail('플랫폼 구성 요소를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
      }
    });
  });

  onBeforeUnmount(() => {
    offHello?.();
    mounted?.dispose();
    clearTimeout(noticeTimer);
    clearTimeout(loadingTimer);
  });
</script>

<template>
  <div ref="stage" class="player">
    <iframe
      v-if="!failure"
      ref="frame"
      class="player__frame"
      :src="info.url"
      :title="info.name"
      v-bind="GAME_FRAME"
    />
    <p v-if="failure" class="player__message">{{ failure }}</p>
    <div v-else-if="!loaded" class="player__overlay" aria-live="polite">불러오는 중…</div>
    <div v-if="notice" class="player__toast" role="status">{{ notice }}</div>
    <div v-if="loginPrompt" class="player__toast player__toast--action" role="status">
      로그인하면 점수와 저장이 기록됩니다.
      <a :href="loginHref(route.fullPath)" class="button">로그인</a>
      <button type="button" class="button button--ghost" @click="loginPrompt = false">닫기</button>
    </div>
  </div>
</template>
