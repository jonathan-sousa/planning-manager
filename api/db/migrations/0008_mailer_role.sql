-- Least-privilege role of the email events Lambda: records SES events only.
-- Its IAM role is mapped by scripts/db-migrate.ts (AWS IAM GRANT, ARN known at deploy).
CREATE ROLE mailer WITH LOGIN;
--> statement-breakpoint
GRANT INSERT ON email_events TO mailer;
