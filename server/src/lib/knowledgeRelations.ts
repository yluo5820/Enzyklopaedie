import {
  type KnowledgeRelationDetail,
  type KnowledgeRelationEntityType,
  type KnowledgeRelationType,
  type ReferenceEntityKind,
} from '@enzyklopaedie/shared';
import { getDb } from '../db';
import { getKnowledgeItemLookup } from './knowledgeItems';
import { getReferenceEntityLookup } from './referenceEntities';
import { getSubjectSummaryById } from './subjects';
import { getTopicById } from './topics';

export interface RelationEntityLookup {
  id: number;
  entityType: KnowledgeRelationEntityType;
  title: string;
  kind: string;
}

export const isKnowledgeRelationType = (value: unknown): value is KnowledgeRelationType =>
  value === 'about' ||
  value === 'contains' ||
  value === 'created_by' ||
  value === 'related_to' ||
  value === 'influenced_by' ||
  value === 'part_of' ||
  value === 'located_in' ||
  value === 'during' ||
  value === 'references';

export const isKnowledgeRelationEntityType = (value: unknown): value is KnowledgeRelationEntityType =>
  value === 'knowledge_item' ||
  value === 'subject' ||
  value === 'topic' ||
  value === 'reference_entity';

const relationTypeSet = (...values: KnowledgeRelationType[]) => new Set(values);

const formatRelationEndpoint = (
  entityType: KnowledgeRelationEntityType,
  entityKind?: string
) => {
  if (entityType === 'knowledge_item') {
    return entityKind === 'lecture' ? 'lecture item' : 'book item';
  }

  if (entityType === 'topic') return 'topic';
  if (entityType === 'subject') return 'subject';
  if (entityType === 'reference_entity') return entityKind ?? 'reference entity';
  return 'entity';
};

export const getAllowedKnowledgeRelationTypesForEdge = (
  fromEntityType: KnowledgeRelationEntityType,
  fromEntityKind: string | undefined,
  toEntityType: KnowledgeRelationEntityType,
  toEntityKind: string | undefined
) => {
  if (fromEntityType === 'knowledge_item') {
    if (toEntityType === 'knowledge_item') {
      return relationTypeSet('references', 'related_to', 'influenced_by', 'part_of');
    }

    if (toEntityType !== 'reference_entity') {
      return relationTypeSet();
    }

    if (toEntityKind === 'person') {
      return relationTypeSet('created_by', 'influenced_by', 'related_to');
    }

    if (toEntityKind === 'era') {
      return relationTypeSet('during', 'about', 'related_to');
    }

    if (toEntityKind === 'nation' || toEntityKind === 'place') {
      return relationTypeSet('located_in', 'about', 'related_to');
    }

    if (toEntityKind === 'civilization') {
      return relationTypeSet('about', 'related_to', 'influenced_by');
    }

    return relationTypeSet();
  }

  if (fromEntityType === 'topic') {
    if (toEntityType !== 'reference_entity') {
      return relationTypeSet();
    }

    if (toEntityKind === 'person') {
      return relationTypeSet('about', 'influenced_by', 'related_to');
    }

    if (toEntityKind === 'era') {
      return relationTypeSet('during', 'about', 'related_to');
    }

    if (toEntityKind === 'nation' || toEntityKind === 'place') {
      return relationTypeSet('located_in', 'about', 'related_to');
    }

    if (toEntityKind === 'civilization') {
      return relationTypeSet('part_of', 'about', 'related_to');
    }

    return relationTypeSet();
  }

  if (fromEntityType === 'reference_entity') {
    if (toEntityType !== 'reference_entity') {
      return relationTypeSet();
    }

    switch (fromEntityKind as ReferenceEntityKind | undefined) {
      case 'person':
        if (toEntityKind === 'person') return relationTypeSet('influenced_by', 'related_to');
        if (toEntityKind === 'nation' || toEntityKind === 'place') return relationTypeSet('located_in');
        if (toEntityKind === 'era') return relationTypeSet('during');
        if (toEntityKind === 'civilization') return relationTypeSet('part_of');
        return relationTypeSet();
      case 'nation':
        if (toEntityKind === 'nation') return relationTypeSet('contains', 'influenced_by', 'related_to');
        if (toEntityKind === 'civilization') return relationTypeSet('part_of', 'influenced_by', 'related_to');
        if (toEntityKind === 'era') return relationTypeSet('during');
        if (toEntityKind === 'place') return relationTypeSet('located_in');
        return relationTypeSet();
      case 'civilization':
        if (toEntityKind === 'nation' || toEntityKind === 'era') return relationTypeSet('contains');
        if (toEntityKind === 'civilization') return relationTypeSet('part_of');
        if (toEntityKind === 'place') return relationTypeSet('located_in');
        return relationTypeSet();
      case 'era':
        if (toEntityKind === 'era') {
          return relationTypeSet('contains', 'part_of', 'related_to', 'influenced_by');
        }
        return relationTypeSet();
      case 'place':
        if (toEntityKind === 'place') return relationTypeSet('contains', 'part_of');
        if (toEntityKind === 'nation' || toEntityKind === 'civilization') return relationTypeSet('contains');
        return relationTypeSet();
      default:
        return relationTypeSet();
    }
  }

  return relationTypeSet();
};

export const validateKnowledgeRelationEdge = (
  fromEntityType: KnowledgeRelationEntityType,
  fromEntityKind: string | undefined,
  toEntityType: KnowledgeRelationEntityType,
  toEntityKind: string | undefined,
  relationType: KnowledgeRelationType
) => {
  const allowedRelationTypes = getAllowedKnowledgeRelationTypesForEdge(
    fromEntityType,
    fromEntityKind,
    toEntityType,
    toEntityKind
  );

  if (allowedRelationTypes.has(relationType)) {
    return null;
  }

  return `Relation "${relationType}" is not allowed from ${formatRelationEndpoint(
    fromEntityType,
    fromEntityKind
  )} to ${formatRelationEndpoint(toEntityType, toEntityKind)}`;
};

const relationDetailSelect = `
  SELECT
    kr.*,
    COALESCE(source_item.title, source_subject.name, source_topic.name, source_reference.title) AS fromEntityTitle,
    COALESCE(
      source_item.kind,
      CASE
        WHEN kr.fromEntityType = 'subject' THEN 'subject'
        WHEN kr.fromEntityType = 'topic' THEN 'topic'
      END,
      source_reference.kind
    ) AS fromEntityKind,
    COALESCE(target_item.title, target_subject.name, target_topic.name, target_reference.title) AS toEntityTitle,
    COALESCE(
      target_item.kind,
      CASE
        WHEN kr.toEntityType = 'subject' THEN 'subject'
        WHEN kr.toEntityType = 'topic' THEN 'topic'
      END,
      target_reference.kind
    ) AS toEntityKind
  FROM knowledge_relations kr
  LEFT JOIN knowledge_items source_item
    ON kr.fromEntityType = 'knowledge_item' AND kr.fromEntityId = source_item.id
  LEFT JOIN topics source_subject
    ON kr.fromEntityType = 'subject' AND kr.fromEntityId = source_subject.id
  LEFT JOIN study_topics source_topic
    ON kr.fromEntityType = 'topic' AND kr.fromEntityId = source_topic.id
  LEFT JOIN reference_entities source_reference
    ON kr.fromEntityType = 'reference_entity' AND kr.fromEntityId = source_reference.id
  LEFT JOIN knowledge_items target_item
    ON kr.toEntityType = 'knowledge_item' AND kr.toEntityId = target_item.id
  LEFT JOIN topics target_subject
    ON kr.toEntityType = 'subject' AND kr.toEntityId = target_subject.id
  LEFT JOIN study_topics target_topic
    ON kr.toEntityType = 'topic' AND kr.toEntityId = target_topic.id
  LEFT JOIN reference_entities target_reference
    ON kr.toEntityType = 'reference_entity' AND kr.toEntityId = target_reference.id
`;

export const getRelationEntityLookup = async (
  entityType: KnowledgeRelationEntityType,
  entityId: number
): Promise<RelationEntityLookup | null> => {
  if (entityType === 'knowledge_item') {
    const item = await getKnowledgeItemLookup(entityId);
    return item
      ? {
          id: item.id,
          entityType,
          title: item.title,
          kind: item.kind,
        }
      : null;
  }

  if (entityType === 'subject') {
    const subject = await getSubjectSummaryById(entityId);
    return subject
      ? {
          id: subject.id,
          entityType,
          title: subject.name,
          kind: 'subject',
        }
      : null;
  }

  if (entityType === 'topic') {
    const topic = await getTopicById(entityId);
    return topic
      ? {
          id: topic.id,
          entityType,
          title: topic.name,
          kind: 'topic',
        }
      : null;
  }

  const referenceEntity = await getReferenceEntityLookup(entityId);
  return referenceEntity
    ? {
        id: referenceEntity.id,
        entityType,
        title: referenceEntity.title,
        kind: referenceEntity.kind,
      }
    : null;
};

export const listKnowledgeRelationsBySource = async (
  fromEntityType: KnowledgeRelationEntityType,
  fromEntityId: number
) => {
  const db = await getDb();
  return db.all<KnowledgeRelationDetail[]>(
    `${relationDetailSelect}
     WHERE kr.fromEntityType = ? AND kr.fromEntityId = ?
     ORDER BY kr.createdAt DESC`,
    fromEntityType,
    fromEntityId
  );
};

export const findKnowledgeRelation = async (
  fromEntityType: KnowledgeRelationEntityType,
  fromEntityId: number,
  toEntityType: KnowledgeRelationEntityType,
  toEntityId: number,
  relationType: KnowledgeRelationType
) => {
  const db = await getDb();
  return db.get<KnowledgeRelationDetail>(
    `${relationDetailSelect}
     WHERE kr.fromEntityType = ?
       AND kr.fromEntityId = ?
       AND kr.toEntityType = ?
       AND kr.toEntityId = ?
       AND kr.relationType = ?`,
    fromEntityType,
    fromEntityId,
    toEntityType,
    toEntityId,
    relationType
  );
};

export const listKnowledgeRelationsByTarget = async (
  toEntityType: KnowledgeRelationEntityType,
  toEntityId: number
) => {
  const db = await getDb();
  return db.all<KnowledgeRelationDetail[]>(
    `${relationDetailSelect}
     WHERE kr.toEntityType = ? AND kr.toEntityId = ?
     ORDER BY kr.createdAt DESC`,
    toEntityType,
    toEntityId
  );
};

export const getKnowledgeRelationById = async (relationId: number) => {
  const db = await getDb();
  return db.get<KnowledgeRelationDetail>(
    `${relationDetailSelect}
     WHERE kr.id = ?`,
    relationId
  );
};
