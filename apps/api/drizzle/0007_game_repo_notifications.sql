CREATE TABLE "sdk_notifications" (
	"game_id" text NOT NULL,
	"major" integer NOT NULL,
	"kind" "sdk_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sdk_notifications_game_id_major_kind_pk" PRIMARY KEY("game_id","major","kind")
);
--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "repo" text;--> statement-breakpoint
ALTER TABLE "sdk_notifications" ADD CONSTRAINT "sdk_notifications_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;