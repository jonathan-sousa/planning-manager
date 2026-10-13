// Lambda entry point for the SES events of the stage's configuration set
// (deliveries, bounces, complaints), delivered by SNS: one row per recipient.
// The accounts page flags an email whose last event is a bounce or a complaint.
import type { SNSEvent } from 'aws-lambda';
import { db } from './db/client';
import { emailEvents } from './db/schema';
import type { EmailEventKind } from './domain';

/** SES event publishing format, fields in use only. */
interface SesEvent {
  eventType: string;
  delivery?: { timestamp: string; recipients: string[] };
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
  if (event.eventType === 'Delivery' && event.delivery) {
    const { recipients, timestamp } = event.delivery;
    return rows(
      'DELIVERY',
      recipients.map((emailAddress) => ({ emailAddress })),
      null,
      timestamp
    );
  }
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

/** An SES event, or null for other messages (SES validates the topic with a plain text one). */
export function parseMessage(message: string): SesEvent | null {
  try {
    const parsed: unknown = JSON.parse(message);
    return typeof parsed === 'object' && parsed !== null && 'eventType' in parsed
      ? (parsed as SesEvent)
      : null;
  } catch {
    return null;
  }
}

export async function handler(event: SNSEvent): Promise<void> {
  const rows = event.Records.flatMap((record) => {
    const sesEvent = parseMessage(record.Sns.Message);
    return sesEvent ? toRows(sesEvent) : [];
  });
  if (rows.length) await db.insert(emailEvents).values(rows);
}
