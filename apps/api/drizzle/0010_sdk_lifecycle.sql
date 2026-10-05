-- SDK lifecycle current → lts → old → deprecated (was current → lts → maintenance → deprecated → eol).
-- maintenance → lts, deprecated → old, eol → deprecated; deprecated_at → old_at, eol_at → deprecated_at.
CREATE TYPE "public"."sdk_status_v2" AS ENUM('current', 'lts', 'old', 'deprecated');--> statement-breakpoint
ALTER TABLE "sdk_versions" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "sdk_versions" ALTER COLUMN "status" SET DATA TYPE "public"."sdk_status_v2" USING (CASE "status"::text WHEN 'maintenance' THEN 'lts' WHEN 'deprecated' THEN 'old' WHEN 'eol' THEN 'deprecated' ELSE "status"::text END)::"public"."sdk_status_v2";--> statement-breakpoint
ALTER TABLE "sdk_versions" ALTER COLUMN "status" SET DEFAULT 'current';--> statement-breakpoint
ALTER TABLE "sdk_notifications" ALTER COLUMN "kind" SET DATA TYPE "public"."sdk_status_v2" USING (CASE "kind"::text WHEN 'maintenance' THEN 'lts' WHEN 'deprecated' THEN 'old' WHEN 'eol' THEN 'deprecated' ELSE "kind"::text END)::"public"."sdk_status_v2";--> statement-breakpoint
ALTER TABLE "sdk_version_events" ALTER COLUMN "from_status" SET DATA TYPE "public"."sdk_status_v2" USING (CASE "from_status"::text WHEN 'maintenance' THEN 'lts' WHEN 'deprecated' THEN 'old' WHEN 'eol' THEN 'deprecated' ELSE "from_status"::text END)::"public"."sdk_status_v2";--> statement-breakpoint
ALTER TABLE "sdk_version_events" ALTER COLUMN "to_status" SET DATA TYPE "public"."sdk_status_v2" USING (CASE "to_status"::text WHEN 'maintenance' THEN 'lts' WHEN 'deprecated' THEN 'old' WHEN 'eol' THEN 'deprecated' ELSE "to_status"::text END)::"public"."sdk_status_v2";--> statement-breakpoint
DROP TYPE "public"."sdk_status";--> statement-breakpoint
ALTER TYPE "public"."sdk_status_v2" RENAME TO "sdk_status";--> statement-breakpoint
ALTER TABLE "sdk_versions" RENAME COLUMN "deprecated_at" TO "old_at";--> statement-breakpoint
ALTER TABLE "sdk_versions" RENAME COLUMN "eol_at" TO "deprecated_at";
