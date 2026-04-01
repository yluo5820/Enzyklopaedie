import { ActivityEventType } from '@enzyklopaedie/shared';
import { getDb } from '../db';

interface RecordActivityInput {
  type: ActivityEventType;
  entityType: string;
  entityId: number;
  message: string;
  metadata?: Record<string, unknown>;
}

export async function recordActivityEvent(input: RecordActivityInput) {
  const db = await getDb();
  const occurredAt = new Date().toISOString();

  await db.run(
    'INSERT INTO activity_events (type, entityType, entityId, message, metadata, occurredAt) VALUES (?, ?, ?, ?, ?, ?)',
    input.type,
    input.entityType,
    input.entityId,
    input.message,
    input.metadata ? JSON.stringify(input.metadata) : null,
    occurredAt
  );
}
