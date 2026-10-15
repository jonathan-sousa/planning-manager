CREATE TABLE "month_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"month" text NOT NULL,
	"credited_minutes" integer NOT NULL,
	"target_minutes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "initial_balance_minutes" integer;
--> statement-breakpoint
ALTER TABLE "agents" ALTER COLUMN "initial_balance_minutes" SET DEFAULT 0;
--> statement-breakpoint
UPDATE "agents" SET "initial_balance_minutes" = 0 WHERE "initial_balance_minutes" IS NULL;
--> statement-breakpoint
ALTER TABLE "month_balances" ADD CONSTRAINT "month_balances_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE restrict ON UPDATE no action NOT VALID;
--> statement-breakpoint
ALTER TABLE ASYNC "month_balances" VALIDATE CONSTRAINT "month_balances_agent_id_agents_id_fk";
--> statement-breakpoint
ALTER TABLE "month_balances" ADD CONSTRAINT "month_balances_month_plannings_month_fk" FOREIGN KEY ("month") REFERENCES "public"."plannings"("month") ON DELETE restrict ON UPDATE no action NOT VALID;
--> statement-breakpoint
ALTER TABLE ASYNC "month_balances" VALIDATE CONSTRAINT "month_balances_month_plannings_month_fk";
--> statement-breakpoint
CREATE UNIQUE INDEX ASYNC "month_balances_agent_month_idx" ON "month_balances"("agent_id","month");
