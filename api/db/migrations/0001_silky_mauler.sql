CREATE TABLE "agent_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"kind" text NOT NULL,
	"shift_type_id" uuid,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_skills" (
	"agent_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	CONSTRAINT "agent_skills_agent_id_skill_id_pk" PRIMARY KEY("agent_id","skill_id")
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"grade_id" uuid NOT NULL,
	"work_time_ratio" integer DEFAULT 100 NOT NULL,
	"night_mode" text NOT NULL,
	"hours_regime" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coverage_needs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shift_type_id" uuid NOT NULL,
	"grade_id" uuid NOT NULL,
	"skill_id" uuid,
	"day_kind" text NOT NULL,
	"min_count" integer NOT NULL,
	"target_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coverage_needs_slot_key" UNIQUE NULLS NOT DISTINCT("shift_type_id","grade_id","skill_id","day_kind")
);
--> statement-breakpoint
CREATE TABLE "coverage_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"shift_type_id" uuid NOT NULL,
	"grade_id" uuid NOT NULL,
	"skill_id" uuid,
	"min_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coverage_overrides_slot_key" UNIQUE NULLS NOT DISTINCT("date","shift_type_id","grade_id","skill_id")
);
--> statement-breakpoint
CREATE TABLE "rule_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"min_daily_rest_minutes" integer DEFAULT 720 NOT NULL,
	"max_shift_amplitude_minutes" integer DEFAULT 720 NOT NULL,
	"break_threshold_minutes" integer DEFAULT 360 NOT NULL,
	"min_break_minutes" integer DEFAULT 20 NOT NULL,
	"max_weekly_minutes" integer DEFAULT 2880 NOT NULL,
	"min_weekly_rest_minutes" integer DEFAULT 2160 NOT NULL,
	"fortnight_min_rest_days" integer DEFAULT 4 NOT NULL,
	"fortnight_anchor_date" date DEFAULT '2026-01-05' NOT NULL,
	"max_consecutive_work_days" integer DEFAULT 5 NOT NULL,
	"rest_day_excludes_previous_night" boolean DEFAULT true NOT NULL,
	"monthly_hours_tolerance_minutes" integer DEFAULT 720 NOT NULL,
	"hours_deviation_weight" integer DEFAULT 10 NOT NULL,
	"wish_weight" integer DEFAULT 5 NOT NULL,
	"weekend_fairness_weight" integer DEFAULT 3 NOT NULL,
	"night_fairness_weight" integer DEFAULT 3 NOT NULL,
	"holiday_fairness_weight" integer DEFAULT 3 NOT NULL,
	"isolated_rest_day_weight" integer DEFAULT 2 NOT NULL,
	"stability_weight" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"kind" text NOT NULL,
	"start_time" text,
	"end_time" text,
	"break_minutes" integer DEFAULT 0 NOT NULL,
	"counted_minutes" integer NOT NULL,
	"is_night" boolean DEFAULT false NOT NULL,
	"color" text NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_requests" ADD CONSTRAINT "agent_requests_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE ON UPDATE NO ACTION NOT VALID;
--> statement-breakpoint
ALTER TABLE "agent_requests" ADD CONSTRAINT "agent_requests_shift_type_id_shift_types_id_fk" FOREIGN KEY ("shift_type_id") REFERENCES "public"."shift_types"("id") ON DELETE RESTRICT ON UPDATE NO ACTION NOT VALID;
--> statement-breakpoint
ALTER TABLE "agent_skills" ADD CONSTRAINT "agent_skills_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE ON UPDATE NO ACTION NOT VALID;
--> statement-breakpoint
ALTER TABLE "agent_skills" ADD CONSTRAINT "agent_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE RESTRICT ON UPDATE NO ACTION NOT VALID;
--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_grade_id_grades_id_fk" FOREIGN KEY ("grade_id") REFERENCES "public"."grades"("id") ON DELETE RESTRICT ON UPDATE NO ACTION NOT VALID;
--> statement-breakpoint
ALTER TABLE "coverage_needs" ADD CONSTRAINT "coverage_needs_shift_type_id_shift_types_id_fk" FOREIGN KEY ("shift_type_id") REFERENCES "public"."shift_types"("id") ON DELETE RESTRICT ON UPDATE NO ACTION NOT VALID;
--> statement-breakpoint
ALTER TABLE "coverage_needs" ADD CONSTRAINT "coverage_needs_grade_id_grades_id_fk" FOREIGN KEY ("grade_id") REFERENCES "public"."grades"("id") ON DELETE RESTRICT ON UPDATE NO ACTION NOT VALID;
--> statement-breakpoint
ALTER TABLE "coverage_needs" ADD CONSTRAINT "coverage_needs_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE RESTRICT ON UPDATE NO ACTION NOT VALID;
--> statement-breakpoint
ALTER TABLE "coverage_overrides" ADD CONSTRAINT "coverage_overrides_shift_type_id_shift_types_id_fk" FOREIGN KEY ("shift_type_id") REFERENCES "public"."shift_types"("id") ON DELETE RESTRICT ON UPDATE NO ACTION NOT VALID;
--> statement-breakpoint
ALTER TABLE "coverage_overrides" ADD CONSTRAINT "coverage_overrides_grade_id_grades_id_fk" FOREIGN KEY ("grade_id") REFERENCES "public"."grades"("id") ON DELETE RESTRICT ON UPDATE NO ACTION NOT VALID;
--> statement-breakpoint
ALTER TABLE "coverage_overrides" ADD CONSTRAINT "coverage_overrides_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE RESTRICT ON UPDATE NO ACTION NOT VALID;
--> statement-breakpoint
CREATE UNIQUE INDEX ASYNC "shift_types_code_idx" ON "shift_types"("code");
--> statement-breakpoint
CREATE UNIQUE INDEX ASYNC "skills_code_idx" ON "skills"("code");

--> statement-breakpoint
ALTER TABLE ASYNC "agent_requests" VALIDATE CONSTRAINT "agent_requests_agent_id_agents_id_fk";
--> statement-breakpoint
ALTER TABLE ASYNC "agent_requests" VALIDATE CONSTRAINT "agent_requests_shift_type_id_shift_types_id_fk";
--> statement-breakpoint
ALTER TABLE ASYNC "agent_skills" VALIDATE CONSTRAINT "agent_skills_agent_id_agents_id_fk";
--> statement-breakpoint
ALTER TABLE ASYNC "agent_skills" VALIDATE CONSTRAINT "agent_skills_skill_id_skills_id_fk";
--> statement-breakpoint
ALTER TABLE ASYNC "agents" VALIDATE CONSTRAINT "agents_grade_id_grades_id_fk";
--> statement-breakpoint
ALTER TABLE ASYNC "coverage_needs" VALIDATE CONSTRAINT "coverage_needs_shift_type_id_shift_types_id_fk";
--> statement-breakpoint
ALTER TABLE ASYNC "coverage_needs" VALIDATE CONSTRAINT "coverage_needs_grade_id_grades_id_fk";
--> statement-breakpoint
ALTER TABLE ASYNC "coverage_needs" VALIDATE CONSTRAINT "coverage_needs_skill_id_skills_id_fk";
--> statement-breakpoint
ALTER TABLE ASYNC "coverage_overrides" VALIDATE CONSTRAINT "coverage_overrides_shift_type_id_shift_types_id_fk";
--> statement-breakpoint
ALTER TABLE ASYNC "coverage_overrides" VALIDATE CONSTRAINT "coverage_overrides_grade_id_grades_id_fk";
--> statement-breakpoint
ALTER TABLE ASYNC "coverage_overrides" VALIDATE CONSTRAINT "coverage_overrides_skill_id_skills_id_fk";
--> statement-breakpoint
INSERT INTO "rule_settings" ("id") VALUES ('default');
