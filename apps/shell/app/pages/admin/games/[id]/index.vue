<script setup lang="ts">
  import type {
    AdminGame,
    AdminVersion,
    GameServerView,
    ServerKeyView,
  } from '~~/shared/types/admin';

  definePageMeta({ middleware: 'admin' });

  const route = useRoute();
  const id = String(route.params.id);
  const { call, error, busy } = useAdmin();
  const { data: game, refresh: refreshGame } = await useFetch<
    AdminGame & { versions: AdminVersion[] }
  >(`/api/admin/games/${id}`);
  const { data: keys, refresh: refreshKeys } = await useFetch<{ items: ServerKeyView[] }>(
    `/api/admin/games/${id}/server-keys`,
  );
  const { data: server, refresh: refreshServer } = await useFetch<GameServerView | null>(
    `/api/admin/games/${id}/server`,
    { default: () => null, onResponseError: () => undefined, ignoreResponseError: true },
  );
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
  const newKey = ref<string | null>(null);
  const keyLabel = ref('');

  useHead({ title: () => `${game.value?.name ?? id} · 관리` });

  async function act(path: string, body?: object) {
    if (await call('POST', path, body)) {
      await refreshGame();
    }
  }

  async function decideServer(action: 'approve' | 'revoke') {
    await call('POST', `games/${id}/server/${action}`);
    await refreshServer();
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

  async function issueKey() {
    const res = await call<{ key: string }>('POST', `games/${id}/server-keys`, {
      label: keyLabel.value,
    });
    newKey.value = res?.key ?? null;
    keyLabel.value = '';
    await refreshKeys();
  }

  async function rotateKey(keyId: string) {
    const res = await call<{ key: string }>('POST', `games/${id}/server-keys/${keyId}/rotate`);
    newKey.value = res?.key ?? null;
    await refreshKeys();
  }

  async function revokeKey(keyId: string) {
    await call('DELETE', `games/${id}/server-keys/${keyId}`);
    await refreshKeys();
  }
</script>

<template>
  <section v-if="game" class="admin">
    <NuxtLink to="/admin">← 게임 관리</NuxtLink>
    <h1 class="page-title">
      {{ game.name }} <span class="muted">({{ game.id }})</span>
    </h1>
    <p class="muted">
      stable {{ game.stableVersion ?? '—' }} · preview {{ game.previewVersion ?? '—' }}
    </p>
    <p v-if="error" class="error">{{ error }}</p>

    <h2>버전</h2>
    <table class="table">
      <thead>
        <tr>
          <th>버전</th>
          <th>상태</th>
          <th>SDK</th>
          <th>업로드</th>
          <th />
        </tr>
      </thead>
      <tbody>
        <tr v-for="v in game.versions" :key="v.version">
          <td>
            <NuxtLink
              v-if="v.status !== 'pending'"
              :to="`/admin/games/${game.id}/versions/${v.version}`"
            >
              {{ v.version }}
            </NuxtLink>
            <span v-else>{{ v.version }}</span>
            <span v-if="v.version === game.stableVersion" class="badge">stable</span>
          </td>
          <td>{{ v.status }}</td>
          <td>v{{ v.sdkMajor }}</td>
          <td>{{ v.uploadedAt?.slice(0, 16).replace('T', ' ') ?? '—' }}</td>
          <td class="actions">
            <button
              v-if="v.status === 'uploaded'"
              type="button"
              class="button"
              :disabled="busy"
              @click="act(`games/${game.id}/versions/${v.version}/approve`)"
            >
              승인
            </button>
            <button
              v-if="v.status === 'approved' && v.version !== game.stableVersion"
              type="button"
              class="button button--ghost"
              :disabled="busy"
              @click="act(`games/${game.id}/rollback`, { version: v.version })"
            >
              이 버전으로 롤백
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <template v-if="server && 'image' in server">
      <h2>전용 서버 (Tier 2)</h2>
      <p>
        <code>{{ server.image }}</code> · 프로토콜 v{{ server.protocol }} ·
        <strong>{{ server.status }}</strong>
      </p>
      <div class="row">
        <button
          v-if="server.status !== 'approved'"
          type="button"
          class="button"
          :disabled="busy"
          @click="decideServer('approve')"
        >
          서버 승인
        </button>
        <button
          v-if="server.status === 'approved'"
          type="button"
          class="button button--ghost"
          :disabled="busy"
          @click="decideServer('revoke')"
        >
          승인 폐기
        </button>
        <a
          v-if="server.status === 'approved'"
          :href="`/api/admin/games/${id}/server/compose`"
          class="button button--ghost"
        >
          compose 내려받기
        </a>
      </div>
    </template>

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

    <h2>게임 서버 키</h2>
    <p v-if="newKey" class="notice">
      새 키 (지금만 표시됩니다): <code>{{ newKey }}</code>
    </p>
    <table class="table">
      <tbody>
        <tr v-for="k in keys?.items ?? []" :key="k.id">
          <td>
            <code>{{ k.prefix }}…</code>
          </td>
          <td>{{ k.label }}</td>
          <td>마지막 사용 {{ k.lastUsedAt?.slice(0, 10) ?? '—' }}</td>
          <td class="actions">
            <span v-if="k.revokedAt" class="muted">폐기됨</span>
            <span v-else-if="k.expiresAt" class="muted"
              >{{ k.expiresAt.slice(0, 16).replace('T', ' ') }} 만료</span
            >
            <button
              v-if="!k.revokedAt && !k.expiresAt"
              type="button"
              class="button button--ghost"
              :disabled="busy"
              @click="rotateKey(k.id)"
            >
              회전
            </button>
            <button
              v-if="!k.revokedAt"
              type="button"
              class="button button--ghost"
              :disabled="busy"
              @click="revokeKey(k.id)"
            >
              폐기
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <form class="row" @submit.prevent="issueKey">
      <input v-model="keyLabel" class="input" placeholder="라벨 (예: game-server)" />
      <button class="button" type="submit" :disabled="busy">서버 키 발급</button>
    </form>
  </section>
</template>
