<script setup lang="ts">
  import type { AdminGame } from '~~/shared/types/admin';
  import type { PlayInfo } from '~~/shared/types/play';

  definePageMeta({ middleware: 'admin' });

  const route = useRoute();
  const id = String(route.params.id);
  const { call, error, busy } = useAdmin();
  const { data: game, refresh: refreshGame } = await useFetch<AdminGame>(`/api/admin/games/${id}`);
  const { data: play } = await useFetch<PlayInfo>(`/api/admin/games/${id}/play`);
  const info = reactive({
    name: game.value?.name ?? '',
    description: game.value?.description ?? '',
  });
  const { data: members, refresh: refreshMembers } = await useFetch<{
    items: { user: { id: string; nickname: string }; role: string }[];
  }>(`/api/admin/games/${id}/members`, { default: () => ({ items: [] }) });
  const memberForm = reactive({ userId: '', role: 'developer' });
  const repo = ref(game.value?.repo ?? '');
  const scoring = reactive({
    policy: game.value?.scorePolicy ?? 'client',
    min: game.value?.scoreMin ?? null,
    max: game.value?.scoreMax ?? null,
  });

  useHead({ title: () => `${game.value?.name ?? id} · 관리` });

  async function refreshManifest() {
    await call('POST', `games/${id}/refresh`);
    await refreshGame();
  }

  async function setListed(listed: boolean) {
    await call('PATCH', `games/${id}`, { listed });
    await refreshGame();
  }

  async function saveInfo() {
    await call('PATCH', `games/${id}`, { name: info.name, description: info.description });
    await refreshGame();
  }

  async function addMember() {
    await call('PUT', `games/${id}/members/${memberForm.userId.trim()}`, { role: memberForm.role });
    memberForm.userId = '';
    await refreshMembers();
  }

  async function removeMember(userId: string) {
    await call('DELETE', `games/${id}/members/${userId}`);
    await refreshMembers();
  }

  async function saveScoring() {
    await call('PATCH', `games/${id}`, {
      scorePolicy: scoring.policy,
      scoreMin: scoring.min === null || String(scoring.min) === '' ? null : Number(scoring.min),
      scoreMax: scoring.max === null || String(scoring.max) === '' ? null : Number(scoring.max),
    });
    await refreshGame();
  }

  async function saveRepo() {
    await call('PATCH', `games/${id}`, { repo: repo.value.trim() || null });
    await refreshGame();
  }

  /** Back to team hosting: the team's site is served again, uploads stay for a later switch. */
  async function hostByTeam() {
    await call('PATCH', `games/${id}`, { hosting: 'team' });
    await refreshGame();
  }
</script>

<template>
  <section v-if="game" class="admin">
    <NuxtLink to="/admin">← 게임 관리</NuxtLink>
    <h1 class="page-title">
      {{ game.name }} <span class="muted">({{ game.id }})</span>
    </h1>
    <p v-if="error" class="error">{{ error }}</p>

    <h2>게임 사이트</h2>
    <p>
      <a v-if="play" :href="play.url" target="_blank" rel="noopener">{{ play.url }}</a>
      ·
      <strong>{{ game.listed ? '공개' : '비공개' }}</strong>
    </p>
    <p class="muted">
      game.json
      <template v-if="game.manifest">
        · SDK v{{ game.sdkMajor }} · 진입 {{ game.manifest.entry }}
        <template v-if="game.manifest.version"> · 게임 버전 {{ game.manifest.version }}</template>
        · {{ game.manifestFetchedAt?.slice(0, 16).replace('T', ' ') }} 읽음
      </template>
      <template v-else> · 아직 읽지 못함</template>
    </p>
    <p v-if="game.manifestError" class="notice">마지막 읽기 실패: {{ game.manifestError }}</p>
    <p class="muted">
      호스팅:
      <strong>{{
        game.hosting === 'platform' ? '플랫폼 (업로드한 빌드)' : '팀 (직접 호스팅)'
      }}</strong>
    </p>
    <div class="row">
      <button
        v-if="game.hosting === 'team'"
        type="button"
        class="button button--ghost"
        :disabled="busy"
        @click="refreshManifest"
      >
        game.json 다시 읽기
      </button>
      <button
        v-else
        type="button"
        class="button button--ghost"
        :disabled="busy"
        @click="hostByTeam"
      >
        팀 호스팅으로 전환
      </button>
      <NuxtLink :to="`/game/${game.id}/play?preview=1`" class="button button--ghost">
        미리보기
      </NuxtLink>
      <button
        v-if="!game.listed"
        type="button"
        class="button"
        :disabled="busy || !game.manifest"
        @click="setListed(true)"
      >
        공개
      </button>
      <button
        v-else
        type="button"
        class="button button--ghost"
        :disabled="busy"
        @click="setListed(false)"
      >
        비공개로
      </button>
    </div>

    <h2>기본 정보</h2>
    <form class="stack narrow" @submit.prevent="saveInfo">
      <input v-model="info.name" class="input" placeholder="이름" required />
      <textarea v-model="info.description" class="input" placeholder="설명" rows="3" />
      <button class="button" type="submit" :disabled="busy">저장</button>
    </form>

    <p v-if="game.manifest?.server" class="muted">
      전용 서버 <code>{{ game.manifest.server.url }}</code> · 프로토콜 v{{
        game.manifest.server.protocol
      }}
    </p>

    <h2>멤버</h2>
    <table class="table">
      <tbody>
        <tr v-for="m in members.items" :key="m.user.id">
          <td>{{ m.user.nickname }}</td>
          <td>{{ m.role }}</td>
          <td class="actions">
            <button
              type="button"
              class="button button--ghost"
              :disabled="busy"
              @click="removeMember(m.user.id)"
            >
              제외
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <form class="row" @submit.prevent="addMember">
      <input
        v-model="memberForm.userId"
        class="input"
        placeholder="계정 id (내 게임 페이지에 표시됨)"
        required
      />
      <select v-model="memberForm.role" class="input">
        <option value="developer">developer</option>
        <option value="owner">owner</option>
      </select>
      <button class="button" type="submit" :disabled="busy">추가</button>
    </form>

    <h2>점수</h2>
    <form class="row" @submit.prevent="saveScoring">
      <select v-model="scoring.policy" class="input">
        <option value="client">client — 브라우저 보고(미검증 표시)</option>
        <option value="server">server — 게임 서버 키로 제출된 점수만</option>
      </select>
      <input v-model="scoring.min" class="input" type="number" placeholder="최소" />
      <input v-model="scoring.max" class="input" type="number" placeholder="최대" />
      <button class="button" type="submit" :disabled="busy">저장</button>
    </form>

    <h2>저장소</h2>
    <form class="row" @submit.prevent="saveRepo">
      <input v-model="repo" class="input" placeholder="owner/name (SDK 지원 종료 알림 이슈)" />
      <button class="button" type="submit" :disabled="busy">저장</button>
    </form>

    <h2>업로드 호스팅</h2>
    <DeployPanel
      :base="`/api/admin/games/${game.id}`"
      :hosting="game.hosting"
      @changed="refreshGame"
    />

    <h2>게임 서버 키</h2>
    <ServerKeysPanel :game-id="game.id" />
  </section>
</template>
