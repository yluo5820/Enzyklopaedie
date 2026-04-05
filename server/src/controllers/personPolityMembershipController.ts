import { NextFunction, Request, Response } from 'express';
import type { NewPersonPolityMembership } from '@enzyklopaedie/shared';
import { getDb } from '../db';
import { recordActivityEvent } from '../lib/activity';
import {
  createPersonPolityMembershipRecord,
  getReferenceEntityById,
  listPersonPolityMembershipsForPerson,
  listPersonPolityMembershipsForPolity,
} from '../lib/personPolityMemberships';

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<any>;

const asyncErrorHandler = (fn: AsyncRoute) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

const parseId = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseOptionalYear = (value: unknown) => {
  if (value === undefined) return { provided: false as const };
  if (value === null || value === '') return { provided: true as const, value: null };

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return { provided: true as const, invalid: true as const };
  }

  return { provided: true as const, value: parsed };
};

export const getPersonPolityMembershipsByReferenceEntity = asyncErrorHandler(
  async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ message: 'Invalid reference entity id' });
    }

    const db = await getDb();
    const entity = await getReferenceEntityById(db, id);
    if (!entity) {
      return res.status(404).json({ message: 'Reference entity not found' });
    }

    if (entity.kind === 'person') {
      return res.json(await listPersonPolityMembershipsForPerson(db, id));
    }

    if (entity.kind === 'polity') {
      return res.json(await listPersonPolityMembershipsForPolity(db, id));
    }

    return res.json([]);
  }
);

export const createPersonPolityMembership = asyncErrorHandler(async (req: Request, res: Response) => {
  const personEntityId = parseId(req.params.id);
  if (!personEntityId) {
    return res.status(400).json({ message: 'Invalid person entity id' });
  }

  const payload: Partial<NewPersonPolityMembership> = req.body;
  const polityEntityId = parseId(payload.polityEntityId);
  const startYear = parseOptionalYear(payload.startYear);
  const endYear = parseOptionalYear(payload.endYear);

  if (!polityEntityId) {
    return res.status(400).json({ message: 'A polity entity id is required' });
  }

  if (startYear.invalid || endYear.invalid) {
    return res.status(400).json({ message: 'Invalid person polity membership year' });
  }

  const db = await getDb();
  const personEntity = await getReferenceEntityById(db, personEntityId);
  if (!personEntity) {
    return res.status(404).json({ message: 'Person not found' });
  }
  if (personEntity.kind !== 'person') {
    return res.status(400).json({ message: 'Polity memberships can only be added from a person entity' });
  }

  const polityEntity = await getReferenceEntityById(db, polityEntityId);
  if (!polityEntity) {
    return res.status(404).json({ message: 'Polity not found' });
  }
  if (polityEntity.kind !== 'polity') {
    return res.status(400).json({ message: 'Person polity memberships can only target a polity entity' });
  }

  const existing = await db.get(
    `SELECT id FROM person_polity_memberships
     WHERE personEntityId = ? AND polityEntityId = ?
       AND startYear IS ? AND endYear IS ?`,
    personEntityId,
    polityEntityId,
    startYear.value ?? null,
    endYear.value ?? null
  );

  if (existing) {
    const memberships = await listPersonPolityMembershipsForPerson(db, personEntityId);
    return res.status(200).json(
      memberships.find((membership) => membership.id === existing.id) ?? null
    );
  }

  const created = await createPersonPolityMembershipRecord(db, personEntityId, {
    polityEntityId,
    startYear: startYear.value ?? undefined,
    endYear: endYear.value ?? undefined,
    note: typeof payload.note === 'string' ? payload.note : undefined,
  });

  if (!created) {
    return res.status(500).json({ message: 'Failed to create person polity membership' });
  }

  const memberships = await listPersonPolityMembershipsForPerson(db, personEntityId);
  const createdDetail = memberships.find((membership) => membership.id === created.id);

  await recordActivityEvent({
    type: 'relation_created',
    entityType: 'reference_entity',
    entityId: personEntityId,
    message: `Placed "${personEntity.title}" in polity "${polityEntity.title}"`,
    metadata: {
      relationType: 'person_polity_membership',
      personEntityId,
      polityEntityId,
    },
  });

  return res.status(201).json(createdDetail ?? created);
});

export const deletePersonPolityMembership = asyncErrorHandler(async (req: Request, res: Response) => {
  const personEntityId = parseId(req.params.id);
  const membershipId = parseId(req.params.membershipId);

  if (!personEntityId || !membershipId) {
    return res.status(400).json({ message: 'Invalid person polity membership id' });
  }

  const db = await getDb();
  const personEntity = await getReferenceEntityById(db, personEntityId);
  if (!personEntity) {
    return res.status(404).json({ message: 'Person not found' });
  }
  if (personEntity.kind !== 'person') {
    return res.status(400).json({ message: 'Polity memberships can only be removed from a person entity' });
  }

  const result = await db.run(
    'DELETE FROM person_polity_memberships WHERE id = ? AND personEntityId = ?',
    membershipId,
    personEntityId
  );

  if (!result.changes) {
    return res.status(404).json({ message: 'Person polity membership not found' });
  }

  return res.status(204).send();
});
