CREATE TYPE "public"."game_version_status" AS ENUM('pending', 'uploaded', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "game_versions" (
	"game_id" text NOT NULL,
	"version" text NOT NULL,
	"status" "game_version_status" DEFAULT 'pending' NOT NULL,
	"manifest" jsonb NOT NULL,
	"uploaded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_versions_game_id_version_pk" PRIMARY KEY("game_id","version")
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"stable_version" text,
	"preview_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "game_versions" ADD CONSTRAINT "game_versions_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;