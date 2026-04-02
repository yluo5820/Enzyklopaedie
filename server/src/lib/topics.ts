import { KnowledgeItem, TopicSummary } from '@enzyklopaedie/shared';
import { getDb } from '../db';

const topicSummarySelect = `
  SELECT
    t.*,
    COALESCE(item_counts.knowledgeItemCount, 0) AS knowledgeItemCount,
    COALESCE(child_counts.childTopicCount, 0) AS childTopicCount,
    COALESCE(topic_counts.topicCount, 0) AS topicCount
  FROM topics t
  LEFT JOIN (
    SELECT st.subjectId, COUNT(DISTINCT kist.knowledgeItemId) AS knowledgeItemCount
    FROM study_topics st
    INNER JOIN knowledge_item_study_topics kist ON kist.studyTopicId = st.id
    GROUP BY st.subjectId
  ) item_counts ON item_counts.subjectId = t.id
  LEFT JOIN (
    SELECT parentTopicId, COUNT(*) AS childTopicCount
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

export const listTopicSummaries = async () => {
  const db = await getDb();
  return db.all<TopicSummary[]>(
    `${topicSummarySelect}
     ORDER BY CASE WHEN t.slug = 'ontology' THEN 0 ELSE 1 END, lower(t.name) ASC, t.createdAt ASC`
  );
};

export const getTopicSummaryById = async (topicId: number) => {
  const db = await getDb();
  return db.get<TopicSummary>(
    `${topicSummarySelect}
     WHERE t.id = ?`,
    topicId
  );
};

export const getOntologyTopic = async () => {
  const db = await getDb();
  return db.get<TopicSummary>(
    `${topicSummarySelect}
     WHERE t.slug = 'ontology'`
  );
};

export const listKnowledgeItemsForTopic = async (topicId: number) => {
  const db = await getDb();
  return db.all<KnowledgeItem[]>(
    `SELECT DISTINCT ki.*
     FROM study_topics st
     INNER JOIN knowledge_item_study_topics kist ON kist.studyTopicId = st.id
     INNER JOIN knowledge_items ki ON ki.id = kist.knowledgeItemId
     WHERE st.subjectId = ?
     ORDER BY ki.updatedAt DESC`,
    topicId
  );
};
