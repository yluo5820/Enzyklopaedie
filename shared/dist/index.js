"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildReferenceEntitySlug = exports.slugifyTopicName = exports.summarizeKnowledgeProgress = void 0;
const summarizeKnowledgeProgress = (items) => {
    const byStatus = {
        inbox: 0,
        queued: 0,
        active: 0,
        completed: 0,
        archived: 0,
    };
    for (const item of items) {
        byStatus[item.status] += 1;
    }
    return {
        total: items.length,
        active: byStatus.active,
        completed: byStatus.completed,
        byStatus,
    };
};
exports.summarizeKnowledgeProgress = summarizeKnowledgeProgress;
const slugifyTopicName = (value) => value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
exports.slugifyTopicName = slugifyTopicName;
const buildReferenceEntitySlug = (kind, title) => `${kind}-${(0, exports.slugifyTopicName)(title)}`;
exports.buildReferenceEntitySlug = buildReferenceEntitySlug;
