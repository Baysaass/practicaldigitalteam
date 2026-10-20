CREATE TABLE "issue_sprints" (
	"issue_key" text NOT NULL,
	"sprint_id" integer NOT NULL,
	CONSTRAINT "issue_sprints_issue_key_sprint_id_pk" PRIMARY KEY("issue_key","sprint_id")
);
--> statement-breakpoint
CREATE TABLE "issues" (
	"key" text PRIMARY KEY NOT NULL,
	"jira_id" text,
	"summary" text DEFAULT '' NOT NULL,
	"assignee" text,
	"assignee_id" text,
	"status" text DEFAULT '' NOT NULL,
	"status_category" text,
	"type" text,
	"priority" text,
	"created_at" timestamp with time zone,
	"taken_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"due_at" timestamp with time zone,
	"story_points" real,
	"estimate_sec" integer,
	"spent_sec" integer,
	"reopens" smallint DEFAULT 0 NOT NULL,
	"last_sprint_id" integer,
	"jira_updated_at" timestamp with time zone,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manager_ratings" (
	"person" text NOT NULL,
	"period" text NOT NULL,
	"collab" smallint,
	"comm" smallint,
	"init" smallint,
	"resp" smallint,
	"note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "manager_ratings_person_period_pk" PRIMARY KEY("person","period")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sprints" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"state" text,
	"board_id" integer,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"complete_date" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"trigger" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"issues" integer DEFAULT 0 NOT NULL,
	"sprints" integer DEFAULT 0 NOT NULL,
	"message" text
);
--> statement-breakpoint
ALTER TABLE "issue_sprints" ADD CONSTRAINT "issue_sprints_issue_key_issues_key_fk" FOREIGN KEY ("issue_key") REFERENCES "public"."issues"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_sprints" ADD CONSTRAINT "issue_sprints_sprint_id_sprints_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE cascade ON UPDATE no action;