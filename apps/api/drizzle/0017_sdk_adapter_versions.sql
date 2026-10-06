CREATE TYPE "public"."adapter_source" AS ENUM('image', 'cli', 'dev');--> statement-breakpoint
CREATE TYPE "public"."sdk_admin_event_kind" AS ENUM('adapter_activated', 'status_changed', 'schedule_changed');--> statement-breakpoint
CREATE TABLE "sdk_adapter_versions" (
	"major" integer NOT NULL,
	"version" text NOT NULL,
	"url" text NOT NULL,
	"sri" text NOT NULL,
	"source" "adapter_source" NOT NULL,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sdk_adapter_versions_major_version_pk" PRIMARY KEY("major","version")
);
--> statement-breakpoint
CREATE TABLE "sdk_admin_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"major" integer NOT NULL,
	"kind" "sdk_admin_event_kind" NOT NULL,
	"from" jsonb,
	"to" jsonb NOT NULL,
	"actor" uuid,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sdk_adapter_versions" ADD CONSTRAINT "sdk_adapter_versions_major_sdk_versions_major_fk" FOREIGN KEY ("major") REFERENCES "public"."sdk_versions"("major") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sdk_admin_events" ADD CONSTRAINT "sdk_admin_events_major_sdk_versions_major_fk" FOREIGN KEY ("major") REFERENCES "public"."sdk_versions"("major") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sdk_admin_events" ADD CONSTRAINT "sdk_admin_events_actor_users_id_fk" FOREIGN KEY ("actor") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- The adapter each major serves today becomes its first recorded version. Release bundles live at
-- /adapters/v<N>/<version>/index.js (register-cli); anything else (a dev manifest URL) is `dev`.
INSERT INTO "sdk_adapter_versions" ("major", "version", "url", "sri", "source")
SELECT "major",
       COALESCE(substring("adapter_url" from '^/adapters/v[0-9]+/([^/]+)/index\.js$'), 'dev'),
       "adapter_url",
       "sri",
       CASE WHEN "adapter_url" ~ '^/adapters/v[0-9]+/[^/]+/index\.js$' THEN 'cli'::"adapter_source" ELSE 'dev'::"adapter_source" END
FROM "sdk_versions"
WHERE "adapter_url" IS NOT NULL AND "sri" IS NOT NULL;
