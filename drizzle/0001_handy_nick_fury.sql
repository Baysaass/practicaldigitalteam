ALTER TABLE "issues" ADD COLUMN "parent_key" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "parent_summary" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "resolution_notes" text;--> statement-breakpoint
ALTER TABLE "manager_ratings" ADD COLUMN "full_name" text;--> statement-breakpoint
ALTER TABLE "manager_ratings" ADD COLUMN "job_title" text;--> statement-breakpoint
ALTER TABLE "manager_ratings" ADD COLUMN "department" text;--> statement-breakpoint
ALTER TABLE "manager_ratings" ADD COLUMN "role" text;--> statement-breakpoint
ALTER TABLE "manager_ratings" ADD COLUMN "manager" text;--> statement-breakpoint
ALTER TABLE "manager_ratings" ADD COLUMN "training" text;--> statement-breakpoint
ALTER TABLE "manager_ratings" ADD COLUMN "voluntary" text;--> statement-breakpoint
ALTER TABLE "manager_ratings" ADD COLUMN "improvements" text;--> statement-breakpoint
ALTER TABLE "manager_ratings" ADD COLUMN "conclusion" text;--> statement-breakpoint
ALTER TABLE "manager_ratings" ADD COLUMN "late_minutes" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "manager_ratings" ADD COLUMN "absent_days" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "manager_ratings" ADD COLUMN "vacation_days" integer DEFAULT 0;