-- Publishing is gone (games are hosted by their authors): deploy keys (cpk_) are dropped and the
-- table keeps only game-server keys (csk_) for verified scores.
DELETE FROM "deploy_keys" WHERE "kind" = 'deploy';--> statement-breakpoint
ALTER TABLE "deploy_keys" RENAME TO "server_keys";--> statement-breakpoint
ALTER TABLE "server_keys" DROP COLUMN "kind";--> statement-breakpoint
DROP TYPE "public"."key_kind";--> statement-breakpoint
ALTER TABLE "server_keys" RENAME CONSTRAINT "deploy_keys_pkey" TO "server_keys_pkey";--> statement-breakpoint
ALTER TABLE "server_keys" RENAME CONSTRAINT "deploy_keys_game_id_games_id_fk" TO "server_keys_game_id_games_id_fk";--> statement-breakpoint
ALTER TABLE "server_keys" RENAME CONSTRAINT "deploy_keys_key_hash_unique" TO "server_keys_key_hash_unique";
