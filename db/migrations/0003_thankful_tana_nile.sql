CREATE TABLE "assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"date" date NOT NULL,
	"month" text NOT NULL,
	"shift_type_id" uuid NOT NULL,
	"counted_minutes" integer NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"source" text NOT NULL,
	"comment" text,
	"updated_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plannings" (
	"month" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE RESTRICT ON UPDATE NO ACTION NOT VALID;
--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_month_plannings_month_fk" FOREIGN KEY ("month") REFERENCES "public"."plannings"("month") ON DELETE RESTRICT ON UPDATE NO ACTION NOT VALID;
--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_shift_type_id_shift_types_id_fk" FOREIGN KEY ("shift_type_id") REFERENCES "public"."shift_types"("id") ON DELETE RESTRICT ON UPDATE NO ACTION NOT VALID;
--> statement-breakpoint
CREATE UNIQUE INDEX ASYNC "assignments_agent_date_idx" ON "assignments"("agent_id", "date");
--> statement-breakpoint
CREATE INDEX ASYNC "assignments_date_idx" ON "assignments"("date");
--> statement-breakpoint
ALTER TABLE ASYNC "assignments" VALIDATE CONSTRAINT "assignments_agent_id_agents_id_fk";
--> statement-breakpoint
ALTER TABLE ASYNC "assignments" VALIDATE CONSTRAINT "assignments_month_plannings_month_fk";
--> statement-breakpoint
ALTER TABLE ASYNC "assignments" VALIDATE CONSTRAINT "assignments_shift_type_id_shift_types_id_fk";
