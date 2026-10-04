CREATE TYPE "public"."sdk_status" AS ENUM('current', 'lts', 'maintenance', 'deprecated', 'eol');--> statement-breakpoint
CREATE TABLE "sdk_versions" (
	"major" integer PRIMARY KEY NOT NULL,
	"status" "sdk_status" DEFAULT 'current' NOT NULL,
	"adapter_url" text,
	"sri" text,
	"deprecated_at" timestamp with time zone,
	"eol_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "game_versions" ADD COLUMN "sdk_major" integer DEFAULT 1 NOT NULL;