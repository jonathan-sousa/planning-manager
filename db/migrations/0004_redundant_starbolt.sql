CREATE TABLE "accepted_violations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"month" text NOT NULL,
	"agent_id" uuid NOT NULL,
	"date" date NOT NULL,
	"rule" text NOT NULL,
	"comment" text NOT NULL,
	"accepted_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accepted_violations" ADD CONSTRAINT "accepted_violations_month_plannings_month_fk" FOREIGN KEY ("month") REFERENCES "public"."plannings"("month") ON DELETE RESTRICT ON UPDATE NO ACTION NOT VALID;
--> statement-breakpoint
ALTER TABLE "accepted_violations" ADD CONSTRAINT "accepted_violations_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE RESTRICT ON UPDATE NO ACTION NOT VALID;
--> statement-breakpoint
CREATE UNIQUE INDEX ASYNC "accepted_violations_key_idx" ON "accepted_violations"("agent_id", "date", "rule");
--> statement-breakpoint
ALTER TABLE ASYNC "accepted_violations" VALIDATE CONSTRAINT "accepted_violations_month_plannings_month_fk";
--> statement-breakpoint
ALTER TABLE ASYNC "accepted_violations" VALIDATE CONSTRAINT "accepted_violations_agent_id_agents_id_fk";
