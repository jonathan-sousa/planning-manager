import { describe, expect, it, vi } from 'vitest';

vi.mock('./db/client', () => ({ db: {} }));
const { parseMessage, toRows } = await import('./email-events');

describe('SES events', () => {
  it('records a bounce per recipient', () => {
    expect(
      toRows({
        eventType: 'Bounce',
        bounce: {
          bounceType: 'Permanent',
          bounceSubType: 'General',
          timestamp: '2026-10-14T08:00:00.000Z',
          bouncedRecipients: [{ emailAddress: 'Jean.Dupont@Example.org' }],
        },
      })
    ).toEqual([
      {
        email: 'jean.dupont@example.org',
        kind: 'BOUNCE',
        detail: 'Permanent / General',
        occurredAt: '2026-10-14T08:00:00.000Z',
      },
    ]);
  });

  it('records a complaint and ignores other events', () => {
    expect(
      toRows({
        eventType: 'Complaint',
        complaint: {
          complaintFeedbackType: 'abuse',
          timestamp: '2026-10-14T08:00:00.000Z',
          complainedRecipients: [{ emailAddress: 'a@example.org' }],
        },
      })
    ).toMatchObject([{ kind: 'COMPLAINT', detail: 'abuse' }]);
    expect(toRows({ eventType: 'Open' })).toEqual([]);
  });

  it('records a delivery, which clears an earlier bounce on the accounts page', () => {
    expect(
      toRows({
        eventType: 'Delivery',
        delivery: { timestamp: '2026-10-14T09:00:00.000Z', recipients: ['A@example.org'] },
      })
    ).toEqual([
      {
        email: 'a@example.org',
        kind: 'DELIVERY',
        detail: null,
        occurredAt: '2026-10-14T09:00:00.000Z',
      },
    ]);
  });

  it('ignores the plain text message SES sends to validate the topic', () => {
    expect(
      parseMessage('Successfully validated SNS topic for Amazon SES event publishing.')
    ).toBeNull();
    expect(parseMessage('{"eventType":"Bounce"}')).toEqual({ eventType: 'Bounce' });
  });
});
