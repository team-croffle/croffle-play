CREATE TYPE "public"."member_role" AS ENUM('owner', 'developer');--> statement-breakpoint
CREATE TABLE "game_members" (
	"game_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "member_role" DEFAULT 'developer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_members_game_id_user_id_pk" PRIMARY KEY("game_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "game_members" ADD CONSTRAINT "game_members_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_members" ADD CONSTRAINT "game_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;