import { describe, expect, it, vi } from 'vitest';

vi.mock('./db/client', () => ({ db: {} }));
const { toRows } = await import('./email-events');

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
    expect(toRows({ eventType: 'Delivery' })).toEqual([]);
  });
});
