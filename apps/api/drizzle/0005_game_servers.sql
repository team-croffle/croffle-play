CREATE TYPE "public"."game_server_status" AS ENUM('requested', 'approved', 'revoked');--> statement-breakpoint
CREATE TABLE "game_servers" (
	"game_id" text PRIMARY KEY NOT NULL,
	"image" text NOT NULL,
	"protocol" text NOT NULL,
	"status" "game_server_status" DEFAULT 'requested' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"approved_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "game_servers" ADD CONSTRAINT "game_servers_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_servers" ADD CONSTRAINT "game_servers_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;