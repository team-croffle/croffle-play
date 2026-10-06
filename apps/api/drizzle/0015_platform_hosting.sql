CREATE TYPE "public"."game_hosting" AS ENUM('team', 'platform');--> statement-breakpoint
CREATE TABLE "game_deploys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" text NOT NULL,
	"uploaded_by" uuid,
	"deploy_key_id" uuid,
	"size" integer NOT NULL,
	"file_count" integer NOT NULL,
	"manifest" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "hosting" "game_hosting" DEFAULT 'team' NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "active_deploy_id" uuid;--> statement-breakpoint
ALTER TABLE "game_deploys" ADD CONSTRAINT "game_deploys_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_deploys" ADD CONSTRAINT "game_deploys_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_deploys_game_created_idx" ON "game_deploys" USING btree ("game_id","created_at");