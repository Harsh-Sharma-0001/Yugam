/**
 * Cache key management and normalization utilities for Interview Service.
 */

export const getInterviewCacheKey = (institutionId, userRole, userId) => {
  const inst = institutionId || "DEFAULT_COLLEGE";
  const role = userRole || "student";
  return `interviews:${inst}:${role}:${userId}`;
};

export const invalidateInterviewCache = async (redisClient, { userId, institutionId, userRole } = {}) => {
  if (!redisClient || !userId) return;

  const keysToDelete = [
    `interviews:${userId}`,
    `interviews:student:${userId}`,
    `interviews:trainer:${userId}`,
  ];

  if (institutionId) {
    keysToDelete.push(`interviews:${institutionId}:${userRole || "student"}:${userId}`);
    keysToDelete.push(`interviews:${institutionId}:student:${userId}`);
    keysToDelete.push(`interviews:${institutionId}:trainer:${userId}`);
    keysToDelete.push(`interviews:${institutionId}:admin:${userId}`);
  }

  try {
    await Promise.allSettled(keysToDelete.map((k) => redisClient.del(k)));
  } catch (err) {
    console.error("Cache invalidation error:", err);
  }
};

export const clampScore = (score, min = 0, max = 100) => {
  const num = Number(score);
  if (isNaN(num)) return min;
  return Math.min(max, Math.max(min, Math.round(num)));
};

export const normalizeFeedbackCriteria = (feedback = {}) => {
  return {
    score: clampScore(feedback.score),
    correctness: clampScore(feedback.correctness),
    clarity: clampScore(feedback.clarity),
    relevance: clampScore(feedback.relevance),
    detail: clampScore(feedback.detail),
    efficiency: clampScore(feedback.efficiency),
    communication: clampScore(feedback.communication),
    problemSolving: clampScore(feedback.problemSolving),
    creativity: clampScore(feedback.creativity),
    feedback: feedback.feedback || "",
    improvements: Array.isArray(feedback.improvements) ? feedback.improvements : [],
  };
};
