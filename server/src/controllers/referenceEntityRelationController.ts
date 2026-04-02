import { NextFunction, Request, Response } from 'express';
import { type KnowledgeRelationType } from '@enzyklopaedie/shared';
import { getDb } from '../db';
import { recordActivityEvent } from '../lib/activity';
import {
  findKnowledgeRelation,
  getKnowledgeRelationById,
  getRelationEntityLookup,
  isKnowledgeRelationType,
  listKnowledgeRelationsBySource,
  validateKnowledgeRelationEdge,
} from '../lib/knowledgeRelations';
import { getReferenceEntityLookup } from '../lib/referenceEntities';

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<any>;

const asyncErrorHandler = (fn: AsyncRoute) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

const parseId = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const getReferenceEntityFromParams = async (req: Request, res: Response) => {
  const referenceEntityId = parseId(req.params.id);
  if (!referenceEntityId) {
    res.status(400).json({ message: 'Invalid reference entity id' });
    return null;
  }

  const entity = await getReferenceEntityLookup(referenceEntityId);
  if (!entity) {
    res.status(404).json({ message: 'Reference entity not found' });
    return null;
  }

  return entity;
};

export const getOutgoingRelationsByReferenceEntity = asyncErrorHandler(async (req: Request, res: Response) => {
  const entity = await getReferenceEntityFromParams(req, res);
  if (!entity) return;

  res.json(await listKnowledgeRelationsBySource('reference_entity', entity.id));
});

export const createReferenceEntityRelation = asyncErrorHandler(async (req: Request, res: Response) => {
  const entity = await getReferenceEntityFromParams(req, res);
  if (!entity) return;

  const toEntityId = parseId(req.body.toEntityId);
  if (!toEntityId) {
    return res.status(400).json({ message: 'A valid target entity id is required' });
  }

  if (toEntityId === entity.id) {
    return res.status(400).json({ message: 'An entity cannot be related to itself' });
  }

  const relationType = req.body.relationType;
  if (!isKnowledgeRelationType(relationType)) {
    return res.status(400).json({ message: 'Invalid relation type' });
  }

  const targetEntity = await getRelationEntityLookup('reference_entity', toEntityId);
  if (!targetEntity) {
    return res.status(404).json({ message: 'Target entity not found' });
  }

  const relationValidationMessage = validateKnowledgeRelationEdge(
    'reference_entity',
    entity.kind,
    'reference_entity',
    targetEntity.kind,
    relationType
  );
  if (relationValidationMessage) {
    return res.status(400).json({ message: relationValidationMessage });
  }

  const existingRelation = await findKnowledgeRelation(
    'reference_entity',
    entity.id,
    'reference_entity',
    toEntityId,
    relationType
  );
  if (existingRelation) {
    return res.status(200).json(existingRelation);
  }

  const note = typeof req.body.note === 'string' && req.body.note.trim() ? req.body.note.trim() : null;
  const createdAt = new Date().toISOString();
  const db = await getDb();
  const result = await db.run(
    `INSERT INTO knowledge_relations
      (fromEntityType, fromEntityId, toEntityType, toEntityId, relationType, note, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    'reference_entity',
    entity.id,
    'reference_entity',
    toEntityId,
    relationType,
    note,
    createdAt
  );

  const relation = await getKnowledgeRelationById(result.lastID as number);

  await recordActivityEvent({
    type: 'relation_created',
    entityType: 'reference_entity',
    entityId: entity.id,
    message: `Linked ${entity.kind} "${entity.title}" to "${targetEntity.title}"`,
    metadata: {
      relationType,
      toEntityId,
      toEntityTitle: targetEntity.title,
    },
  });

  res.status(201).json(relation);
});

export const deleteReferenceEntityRelation = asyncErrorHandler(async (req: Request, res: Response) => {
  const entity = await getReferenceEntityFromParams(req, res);
  if (!entity) return;

  const relationId = parseId(req.params.relationId);
  if (!relationId) {
    return res.status(400).json({ message: 'Invalid relation id' });
  }

  const db = await getDb();
  const result = await db.run(
    `DELETE FROM knowledge_relations
     WHERE id = ? AND fromEntityType = 'reference_entity' AND fromEntityId = ? AND toEntityType = 'reference_entity'`,
    relationId,
    entity.id
  );

  if (!result.changes) {
    return res.status(404).json({ message: 'Reference entity relation not found' });
  }

  res.status(204).send();
});
