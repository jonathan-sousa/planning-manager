DROP INDEX "shift_types_code_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX ASYNC "shift_types_active_code_idx" ON "shift_types"("code") WHERE NOT "shift_types"."archived";
