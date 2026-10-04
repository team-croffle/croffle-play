CREATE TYPE "public"."key_kind" AS ENUM('deploy', 'server');--> statement-breakpoint
CREATE TYPE "public"."score_policy" AS ENUM('client', 'server');--> statement-breakpoint
ALTER TABLE "deploy_keys" ADD COLUMN "kind" "key_kind" DEFAULT 'deploy' NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "score_policy" "score_policy" DEFAULT 'client' NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "score_min" double precision;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "score_max" double precision;--> statement-breakpoint
ALTER TABLE "scores" ADD COLUMN "verified" boolean DEFAULT false NOT NULL;