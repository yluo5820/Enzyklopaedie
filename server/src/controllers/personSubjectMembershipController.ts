import { NextFunction, Request, Response } from 'express';
import type { NewPersonSubjectMembership } from '@enzyklopaedie/shared';
import { getDb } from '../db';
import { recordActivityEvent } from '../lib/activity';
import {
  createPersonSubjectMembershipRecord,
  getReferenceEntityById,
  getSubjectById,
  listPersonSubjectMembershipsForPerson,
} from '../lib/personSubjectMemberships';

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<any>;

const asyncErrorHandler = (fn: AsyncRoute) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

const parseId = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const getPersonSubjectMembershipsByReferenceEntity = asyncErrorHandler(
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

    if (entity.kind !== 'person') {
      return res.json([]);
    }

    return res.json(await listPersonSubjectMembershipsForPerson(db, id));
  }
);

export const createPersonSubjectMembership = asyncErrorHandler(async (req: Request, res: Response) => {
  const personEntityId = parseId(req.params.id);
  if (!personEntityId) {
    return res.status(400).json({ message: 'Invalid person entity id' });
  }

  const payload: Partial<NewPersonSubjectMembership> = req.body;
  const subjectId = parseId(payload.subjectId);
  if (!subjectId) {
    return res.status(400).json({ message: 'A subject id is required' });
  }

  const db = await getDb();
  const personEntity = await getReferenceEntityById(db, personEntityId);
  if (!personEntity) {
    return res.status(404).json({ message: 'Person not found' });
  }
  if (personEntity.kind !== 'person') {
    return res.status(400).json({ message: 'Subject memberships can only be added from a person entity' });
  }

  const subject = await getSubjectById(db, subjectId);
  if (!subject) {
    return res.status(404).json({ message: 'Subject not found' });
  }

  const existing = await db.get(
    `SELECT id FROM person_subject_memberships
     WHERE personEntityId = ? AND subjectId = ?`,
    personEntityId,
    subjectId
  );

  if (existing) {
    const memberships = await listPersonSubjectMembershipsForPerson(db, personEntityId);
    return res.status(200).json(
      memberships.find((membership) => membership.id === existing.id) ?? null
    );
  }

  const created = await createPersonSubjectMembershipRecord(db, personEntityId, {
    subjectId,
    note: typeof payload.note === 'string' ? payload.note : undefined,
  });

  if (!created) {
    return res.status(500).json({ message: 'Failed to create person subject membership' });
  }

  const memberships = await listPersonSubjectMembershipsForPerson(db, personEntityId);
  const createdDetail = memberships.find((membership) => membership.id === created.id);

  await recordActivityEvent({
    type: 'relation_created',
    entityType: 'reference_entity',
    entityId: personEntityId,
    message: `Assigned "${personEntity.title}" to subject "${subject.name}"`,
    metadata: {
      relationType: 'person_subject_membership',
      personEntityId,
      subjectId,
    },
  });

  return res.status(201).json(createdDetail ?? created);
});

export const deletePersonSubjectMembership = asyncErrorHandler(async (req: Request, res: Response) => {
  const personEntityId = parseId(req.params.id);
  const membershipId = parseId(req.params.membershipId);

  if (!personEntityId || !membershipId) {
    return res.status(400).json({ message: 'Invalid person subject membership id' });
  }

  const db = await getDb();
  const personEntity = await getReferenceEntityById(db, personEntityId);
  if (!personEntity) {
    return res.status(404).json({ message: 'Person not found' });
  }
  if (personEntity.kind !== 'person') {
    return res.status(400).json({ message: 'Subject memberships can only be removed from a person entity' });
  }

  const result = await db.run(
    'DELETE FROM person_subject_memberships WHERE id = ? AND personEntityId = ?',
    membershipId,
    personEntityId
  );

  if (!result.changes) {
    return res.status(404).json({ message: 'Person subject membership not found' });
  }

  return res.status(204).send();
});
