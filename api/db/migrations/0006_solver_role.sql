-- Least-privilege role of the solver Lambda: reads the month, records its runs.
-- Its IAM role is mapped by scripts/db-migrate.ts (AWS IAM GRANT, ARN known at deploy).
CREATE ROLE solver WITH LOGIN;
--> statement-breakpoint
GRANT SELECT ON agents, agent_skills, shift_types, assignments, coverage_needs, coverage_overrides, agent_requests, rule_settings TO solver;
--> statement-breakpoint
GRANT SELECT, UPDATE ON solve_runs TO solver;
