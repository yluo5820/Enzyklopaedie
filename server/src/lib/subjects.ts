import { KnowledgeItem, SubjectSummary } from '@enzyklopaedie/shared';
import { getDb } from '../db';

const subjectSummarySelect = `
  SELECT
    t.id,
    t.name,
    t.slug,
    t.description,
    t.parentTopicId AS parentSubjectId,
    t.color,
    t.createdAt,
    t.updatedAt,
    COALESCE(item_counts.knowledgeItemCount, 0) AS knowledgeItemCount,
    COALESCE(child_counts.childSubjectCount, 0) AS childSubjectCount,
    COALESCE(topic_counts.topicCount, 0) AS topicCount
  FROM topics t
  LEFT JOIN (
    SELECT st.subjectId, COUNT(DISTINCT kist.knowledgeItemId) AS knowledgeItemCount
    FROM study_topics st
    INNER JOIN knowledge_item_study_topics kist ON kist.studyTopicId = st.id
    GROUP BY st.subjectId
  ) item_counts ON item_counts.subjectId = t.id
  LEFT JOIN (
    SELECT parentTopicId, COUNT(*) AS childSubjectCount
    FROM topics
    WHERE parentTopicId IS NOT NULL
    GROUP BY parentTopicId
  ) child_counts ON child_counts.parentTopicId = t.id
  LEFT JOIN (
    SELECT subjectId, COUNT(*) AS topicCount
    FROM study_topics
    GROUP BY subjectId
  ) topic_counts ON topic_counts.subjectId = t.id
`;

export const listSubjectSummaries = async () => {
  const db = await getDb();
  return db.all<SubjectSummary[]>(
    `${subjectSummarySelect}
     ORDER BY CASE WHEN t.slug = 'ontology' THEN 0 ELSE 1 END, lower(t.name) ASC, t.createdAt ASC`
  );
};

export const getSubjectSummaryById = async (subjectId: number) => {
  const db = await getDb();
  return db.get<SubjectSummary>(
    `${subjectSummarySelect}
     WHERE t.id = ?`,
    subjectId
  );
};

export const getOntologySubject = async () => {
  const db = await getDb();
  return db.get<SubjectSummary>(
    `${subjectSummarySelect}
     WHERE t.slug = 'ontology'`
  );
};

export const listKnowledgeItemsForSubject = async (subjectId: number) => {
  const db = await getDb();
  return db.all<KnowledgeItem[]>(
    `SELECT DISTINCT ki.*
     FROM study_topics st
     INNER JOIN knowledge_item_study_topics kist ON kist.studyTopicId = st.id
     INNER JOIN knowledge_items ki ON ki.id = kist.knowledgeItemId
     WHERE st.subjectId = ?
     ORDER BY ki.updatedAt DESC`,
    subjectId
  );
};
