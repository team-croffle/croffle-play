# 운영 가이드

개인 서버 한 대(Docker Compose) + Cloudflare 기준. 서비스·환경변수 표는 [infra/README.md](../infra/README.md),
보안 모델은 [security.md](./security.md).

## 배포 (릴리스 → 서버)

1. 릴리스 워크플로가 이미지를 GHCR에 올린다: `ghcr.io/team-croffle/croffle-play/{api,shell,rooms}:<버전>`.
2. 서버의 `infra/.env`에서 `API_IMAGE`·`SHELL_IMAGE`·`ROOMS_IMAGE`를 새 버전으로 바꾼다.
3. `docker compose -f infra/compose.yml --env-file infra/.env pull && … up -d`. API는 시작할 때
   마이그레이션을 적용한다(되돌릴 수 없는 마이그레이션이 있는 릴리스는 노트에 표시한다).
4. 호스트 어댑터가 바뀐 릴리스면 [infra/README.md](../infra/README.md)의 "Releasing a host adapter" 절차로
   업로드·등록한다. 셸 재배포와 무관하다.

롤백: 이미지 태그를 이전 버전으로 되돌린다. DB 마이그레이션이 포함된 경우 백업 복구가 필요할 수 있다.

## 백업

`ops` 서비스가 매일 04:30(UTC)에 실행한다(`infra/ops/backup.sh`).

- PostgreSQL: 플랫폼 DB와 Logto DB를 `pg_dump --format=custom`으로 `BACKUP_PATH/pg/`에. 14일 보존.
- 스토리지: `games`·`adapters` 버킷을 읽기 전용 사용자(`play-backup`)로 `BACKUP_PATH/storage/`에 미러.
  번들은 불변이라 미러는 추가만 한다.
- 백업 디렉터리는 서버 밖(외장 디스크, 다른 호스트)으로 한 번 더 복사한다. 같은 디스크의 백업은
  디스크 장애를 막지 못한다.

수동 실행: `docker compose … exec ops /ops/backup.sh`

### 복구

```bash
# 1) 데이터베이스 (예: 플랫폼 DB)
docker compose … stop api
docker compose … exec -T postgres psql -U play -d postgres -c 'drop database play' -c 'create database play'
docker compose … exec -T postgres pg_restore -U play -d play --no-owner < backups/pg/play-<시각>.dump
docker compose … start api

# 2) 스토리지
mc mirror backups/storage/games local/games
```

복구 리허설을 분기마다 한 번 한다(새 DB 이름으로 `pg_restore` 후 게임 수 확인).

## 모니터링

`ops` 서비스가 매분 `HEALTH_URLS`(api, shell, rooms, games-edge, logto)를 확인하고, 상태가 **바뀔 때만**
`ALERT_WEBHOOK_URL`(Discord)에 알린다. 상태 파일은 컨테이너 안 `/var/lib/healthcheck`에 있다.

## 정기 작업

| 주기   | 작업                                                                     |
| ------ | ------------------------------------------------------------------------ |
| 매일   | 백업(자동), 알림 확인                                                    |
| 매주   | `docker compose … pull`로 기반 이미지 보안 업데이트, 디스크 사용량       |
| 분기   | 복구 리허설, 배포 키 정리(안 쓰는 키 폐기), `GITHUB_NOTIFY_TOKEN` 만료일 |
| 연 1회 | `croffle-play.link` 갱신(만료 2년 이상 유지 — PSL 조건), SDK 메이저 계획 |

## 사고 대응 메모

- **배포 키 유출**: 관리자 게임 페이지에서 폐기(즉시) 또는 회전(24시간 유예). 유출된 키로 올라간
  버전은 승인 전이면 반려, 승인됐다면 이전 버전으로 롤백.
- **게임 서버 이상**: 관리자 화면에서 승인 폐기 → `docker compose … stop game-<id>`.
- **문제 있는 게임 버전**: 롤백(이전 승인 버전으로 stable 포인터 이동). 파일은 지우지 않는다.
- **IdP 장애**: 로그인·점수·저장만 멈추고 카탈로그·게스트 플레이는 동작한다.
