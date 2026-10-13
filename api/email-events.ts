// Lambda entry point for the SES events of the stage's configuration set
// (bounces, complaints), delivered by SNS: one row per recipient, shown on
// the accounts page next to the account with that email.
import type { SNSEvent } from 'aws-lambda';
import { db } from './db/client';
import { emailEvents } from './db/schema';
import type { EmailEventKind } from './domain';

/** SES event publishing format, fields in use only. */
interface SesEvent {
  eventType: string;
  bounce?: {
    bounceType: string;
    bounceSubType: string;
    timestamp: string;
    bouncedRecipients: { emailAddress: string }[];
  };
  complaint?: {
    complaintFeedbackType?: string;
    timestamp: string;
    complainedRecipients: { emailAddress: string }[];
  };
}

export function toRows(event: SesEvent) {
  const rows = (
    kind: EmailEventKind,
    recipients: { emailAddress: string }[],
    detail: string | null,
    occurredAt: string
  ) =>
    recipients.map(({ emailAddress }) => ({
      email: emailAddress.toLowerCase(),
      kind,
      detail,
      occurredAt,
    }));
  if (event.eventType === 'Bounce' && event.bounce) {
    const { bounceType, bounceSubType, bouncedRecipients, timestamp } = event.bounce;
    return rows('BOUNCE', bouncedRecipients, `${bounceType} / ${bounceSubType}`, timestamp);
  }
  if (event.eventType === 'Complaint' && event.complaint) {
    const { complaintFeedbackType, complainedRecipients, timestamp } = event.complaint;
    return rows('COMPLAINT', complainedRecipients, complaintFeedbackType ?? null, timestamp);
  }
  return [];
}

export async function handler(event: SNSEvent): Promise<void> {
  const rows = event.Records.flatMap((record) => toRows(JSON.parse(record.Sns.Message)));
  if (rows.length) await db.insert(emailEvents).values(rows);
}
