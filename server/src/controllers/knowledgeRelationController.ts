import { NextFunction, Request, Response } from 'express';
import { type KnowledgeRelationEntityType } from '@enzyklopaedie/shared';
import { getDb } from '../db';
import { recordActivityEvent } from '../lib/activity';
import { getKnowledgeItemLookup } from '../lib/knowledgeItems';
import {
  findKnowledgeRelation,
  getKnowledgeRelationById,
  getRelationEntityLookup,
  isKnowledgeRelationEntityType,
  isKnowledgeRelationType,
  listKnowledgeRelationsBySource,
  validateKnowledgeRelationEdge,
} from '../lib/knowledgeRelations';

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<any>;

const asyncErrorHandler = (fn: AsyncRoute) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

const parseId = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const getKnowledgeItemFromParams = async (req: Request, res: Response) => {
  const knowledgeItemId = parseId(req.params.knowledgeItemId);
  if (!knowledgeItemId) {
    res.status(400).json({ message: 'Invalid knowledge item id' });
    return null;
  }

  const item = await getKnowledgeItemLookup(knowledgeItemId);
  if (!item) {
    res.status(404).json({ message: 'Knowledge item not found' });
    return null;
  }

  return item;
};

export const getRelationsByKnowledgeItem = asyncErrorHandler(async (req: Request, res: Response) => {
  const item = await getKnowledgeItemFromParams(req, res);
  if (!item) return;

  res.json(await listKnowledgeRelationsBySource('knowledge_item', item.id));
});

export const createKnowledgeRelation = asyncErrorHandler(async (req: Request, res: Response) => {
  const item = await getKnowledgeItemFromParams(req, res);
  if (!item) return;

  const toEntityType = (req.body.toEntityType ?? 'knowledge_item') as KnowledgeRelationEntityType;
  if (!isKnowledgeRelationEntityType(toEntityType)) {
    return res.status(400).json({ message: 'Invalid target entity type' });
  }

  const toEntityId = parseId(req.body.toEntityId);
  if (!toEntityId) {
    return res.status(400).json({ message: 'A valid target entity id is required' });
  }

  if (toEntityType === 'knowledge_item' && toEntityId === item.id) {
    return res.status(400).json({ message: 'An item cannot be related to itself' });
  }

  const relationType = req.body.relationType;
  if (!isKnowledgeRelationType(relationType)) {
    return res.status(400).json({ message: 'Invalid relation type' });
  }

  const db = await getDb();
  const targetEntity = await getRelationEntityLookup(toEntityType, toEntityId);
  if (!targetEntity) {
    return res.status(404).json({ message: 'Target entity not found' });
  }

  const relationValidationMessage = validateKnowledgeRelationEdge(
    'knowledge_item',
    item.kind,
    toEntityType,
    targetEntity.kind,
    relationType
  );
  if (relationValidationMessage) {
    return res.status(400).json({ message: relationValidationMessage });
  }

  const existingRelation = await findKnowledgeRelation(
    'knowledge_item',
    item.id,
    toEntityType,
    toEntityId,
    relationType
  );

  if (existingRelation) {
    return res.status(200).json(existingRelation);
  }

  const note = typeof req.body.note === 'string' && req.body.note.trim() ? req.body.note.trim() : null;
  const createdAt = new Date().toISOString();
  const result = await db.run(
    `INSERT INTO knowledge_relations
      (fromEntityType, fromEntityId, toEntityType, toEntityId, relationType, note, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    'knowledge_item',
    item.id,
    toEntityType,
    toEntityId,
    relationType,
    note,
    createdAt
  );

  const relation = await getKnowledgeRelationById(result.lastID as number);

  await recordActivityEvent({
    type: 'relation_created',
    entityType: 'knowledge_item',
    entityId: item.id,
    message: `Linked "${item.title}" to "${targetEntity.title}"`,
    metadata: {
      relationType,
      toEntityType,
      toEntityId,
      toEntityTitle: targetEntity.title,
    },
  });

  res.status(201).json(relation);
});

export const deleteKnowledgeRelation = asyncErrorHandler(async (req: Request, res: Response) => {
  const item = await getKnowledgeItemFromParams(req, res);
  if (!item) return;

  const relationId = parseId(req.params.id);
  if (!relationId) {
    return res.status(400).json({ message: 'Invalid relation id' });
  }

  const db = await getDb();
  const result = await db.run(
    `DELETE FROM knowledge_relations
     WHERE id = ? AND fromEntityType = 'knowledge_item' AND fromEntityId = ?`,
    relationId,
    item.id
  );

  if (!result.changes) {
    return res.status(404).json({ message: 'Knowledge relation not found' });
  }

  res.status(204).send();
});
