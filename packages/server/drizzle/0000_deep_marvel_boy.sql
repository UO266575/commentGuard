CREATE TYPE "public"."tab" AS ENUM('positivo', 'constructivo', 'neutral', 'irrelevante', 'negativo', 'toxico', 'sin_clasificar');--> statement-breakpoint
CREATE TABLE "comment_classification_cache" (
	"comment_id" text PRIMARY KEY NOT NULL,
	"category" "tab" NOT NULL,
	"confidence" real NOT NULL,
	"model_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quota_usage" (
	"user_google_sub" text NOT NULL,
	"period_month" text NOT NULL,
	"classified_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "quota_usage_user_google_sub_period_month_pk" PRIMARY KEY("user_google_sub","period_month")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"google_sub" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quota_usage" ADD CONSTRAINT "quota_usage_user_google_sub_users_google_sub_fk" FOREIGN KEY ("user_google_sub") REFERENCES "public"."users"("google_sub") ON DELETE no action ON UPDATE no action;