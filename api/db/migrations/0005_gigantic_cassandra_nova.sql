CREATE TABLE "solve_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"month" text NOT NULL,
	"mode" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"planning_version" integer NOT NULL,
	"result" jsonb,
	"error" text,
	"created_by" text NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "solve_runs" ADD CONSTRAINT "solve_runs_month_plannings_month_fk" FOREIGN KEY ("month") REFERENCES "public"."plannings"("month") ON DELETE RESTRICT ON UPDATE NO ACTION NOT VALID;
--> statement-breakpoint
CREATE INDEX ASYNC "solve_runs_month_idx" ON "solve_runs"("month");
--> statement-breakpoint
ALTER TABLE ASYNC "solve_runs" VALIDATE CONSTRAINT "solve_runs_month_plannings_month_fk";
