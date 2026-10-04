CREATE TABLE "sdk_version_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"major" integer NOT NULL,
	"from_status" "sdk_status" NOT NULL,
	"to_status" "sdk_status" NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sdk_version_events" ADD CONSTRAINT "sdk_version_events_major_sdk_versions_major_fk" FOREIGN KEY ("major") REFERENCES "public"."sdk_versions"("major") ON DELETE cascade ON UPDATE no action;