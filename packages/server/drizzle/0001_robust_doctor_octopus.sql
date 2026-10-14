CREATE TABLE "comment_corrections" (
	"id" serial PRIMARY KEY NOT NULL,
	"comment_id" text NOT NULL,
	"original_category" "tab" NOT NULL,
	"corrected_category" "tab" NOT NULL,
	"model_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
