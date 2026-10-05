-- Games are hosted by their teams: the platform keeps each game's game.json and a listed flag
-- instead of uploaded versions. Listed = had a stable version; the manifest and SDK major of that
-- version are kept. Versions, pointers, and per-game bundle limits are dropped.
ALTER TABLE "games" ADD COLUMN "listed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "manifest" jsonb;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "sdk_major" integer;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "manifest_fetched_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "manifest_error" text;--> statement-breakpoint
UPDATE "games" SET "listed" = true, "manifest" = v."manifest", "sdk_major" = v."sdk_major", "manifest_fetched_at" = v."uploaded_at" FROM "game_versions" v WHERE v."game_id" = "games"."id" AND v."version" = "games"."stable_version";--> statement-breakpoint
ALTER TABLE "games" DROP COLUMN "stable_version";--> statement-breakpoint
ALTER TABLE "games" DROP COLUMN "preview_version";--> statement-breakpoint
ALTER TABLE "games" DROP COLUMN "max_bundle_bytes";--> statement-breakpoint
DROP TABLE "game_versions";--> statement-breakpoint
DROP TYPE "public"."game_version_status";
