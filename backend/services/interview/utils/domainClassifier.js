/**
 * AI Domain Competency Classifier
 * Evaluates candidate performance across DSA, Technical (System & Architecture),
 * and Communication domains (0-100) from questions, answers, code, and rubric evaluations.
 */

const DSA_REGEX = /\b(dsa|data\s*structures?|algorithms?|arrays?|strings?|matrix|matrices|linked\s*lists?|stacks?|queues?|trees?|binary\s*trees?|bst|heaps?|priority\s*queues?|graphs?|dfs|bfs|hash\b|hashmaps?|hash\s*tables?|sorting|sort|quicksort|mergesort|binary\s*search|two\s*pointers?|sliding\s*windows?|dynamic\s*programming|\bdp\b|recursion|backtracking|big\s*o|complexity|leetcode|tries?|palindrome|anagram|traversal)\b/i;

const COMM_REGEX = /\b(tell\s*me\s*about\s*yourself|introduce|behavioral|conflict|teamwork|team\s*player|leadership|strengths?|weakness(es)?|challenges?|situations?|star\s*method|communication|describe\s*a\s*time|why\s*should\s*we|why\s*do\s*you|walk\s*me\s*through\s*your\s*resume)\b/i;

const TECH_REGEX = /\b(system\s*design|databases?|sql|nosql|mongodb|postgres|postgresql|indexing|architecture|apis?|rest|restful|graphql|endpoints?|microservices?|distributed|dockers?|kubernetes|k8s|clouds?|aws|caches?|redis|concurrency|multithreading|threads?|deadlocks?|operating\s*systems?|os\b|networking|tcp|udp|http|https|websockets?|react|node|javascript|typescript|python|frontend|backend|security|jwt|auth|performance|scalability)\b/i;

/**
 * Normalizes a score between 0 and 100 as an integer.
 */
function clampScore(score) {
  if (typeof score !== "number" || isNaN(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Computes DSA, Technical, and Communication domain scores for an interview.
 *
 * @param {Object} params
 * @param {string} [params.type='technical'] - "technical" or "hr"
 * @param {string} [params.role=''] - Target role or job title
 * @param {Array} [params.questions=[]] - Questions with scores/feedbacks
 * @param {Object} [params.evaluation={}] - Overall evaluation criteria
 * @param {number} [params.overallScore=0] - Session overall score
 * @returns {{ dsa: number, technical: number, communication: number }}
 */
export function evaluateDomainScores({
  type = "technical",
  role = "",
  questions = [],
  evaluation = {},
  overallScore = 0,
} = {}) {
  const finalOverall = Number(overallScore) || 0;
  if (finalOverall === 0) {
    return { dsa: 0, technical: 0, communication: 0 };
  }

  const criteria = evaluation?.criteria || {};

  let sumCorrectness = criteria.correctness !== undefined ? Number(criteria.correctness) : 0;
  let countCorrectness = criteria.correctness !== undefined ? 1 : 0;

  let sumClarity = criteria.clarity !== undefined ? Number(criteria.clarity) : 0;
  let countClarity = criteria.clarity !== undefined ? 1 : 0;

  let sumEfficiency = criteria.efficiency !== undefined ? Number(criteria.efficiency) : 0;
  let countEfficiency = criteria.efficiency !== undefined ? 1 : 0;

  let sumCommunication = criteria.communication !== undefined ? Number(criteria.communication) : 0;
  let countCommunication = criteria.communication !== undefined ? 1 : 0;

  let sumProblemSolving = criteria.problemSolving !== undefined ? Number(criteria.problemSolving) : 0;
  let countProblemSolving = criteria.problemSolving !== undefined ? 1 : 0;

  const dsaScores = [];
  const techScores = [];
  const commScores = [];

  if (Array.isArray(questions)) {
    questions.forEach((q) => {
      const qText = String(q.questionText || q.question || "").toLowerCase();
      const fb = q.feedback || {};
      const qScore = Number(q.score ?? fb.score ?? finalOverall);

      if (fb.correctness !== undefined) {
        sumCorrectness += Number(fb.correctness);
        countCorrectness++;
      }
      if (fb.clarity !== undefined) {
        sumClarity += Number(fb.clarity);
        countClarity++;
      }
      if (fb.efficiency !== undefined) {
        sumEfficiency += Number(fb.efficiency);
        countEfficiency++;
      }
      if (fb.communication !== undefined) {
        sumCommunication += Number(fb.communication);
        countCommunication++;
      }
      if (fb.problemSolving !== undefined) {
        sumProblemSolving += Number(fb.problemSolving);
        countProblemSolving++;
      }

      const hasCode = Boolean(
        (q.submittedCode && q.submittedCode.trim().length > 15) ||
        (q.studentAnswer && /function|class|def |const |let |return |public void/i.test(q.studentAnswer))
      );

      const isDsa = DSA_REGEX.test(qText) || (hasCode && !TECH_REGEX.test(qText));
      const isComm = COMM_REGEX.test(qText) || type === "hr";
      const isTech = TECH_REGEX.test(qText) || (!isDsa && !isComm);

      if (isDsa) dsaScores.push(qScore);
      if (isComm) commScores.push(qScore);
      if (isTech) techScores.push(qScore);
    });
  }

  const cCorrectness = countCorrectness > 0 ? sumCorrectness / countCorrectness : finalOverall;
  const cClarity = countClarity > 0 ? sumClarity / countClarity : finalOverall;
  const cEfficiency = countEfficiency > 0 ? sumEfficiency / countEfficiency : finalOverall;
  const cCommunication = countCommunication > 0 ? sumCommunication / countCommunication : finalOverall;
  const cProblemSolving = countProblemSolving > 0 ? sumProblemSolving / countProblemSolving : finalOverall;

  // 1. DSA Score Calculation
  let dsa;
  if (dsaScores.length > 0) {
    const avgDsaQ = dsaScores.reduce((a, b) => a + b, 0) / dsaScores.length;
    dsa = avgDsaQ * 0.65 + (cProblemSolving * 0.6 + cEfficiency * 0.4) * 0.35;
  } else if (type === "hr") {
    dsa = Math.round(finalOverall * 0.7);
  } else {
    dsa = cProblemSolving * 0.55 + cEfficiency * 0.45;
  }

  // 2. Technical Score Calculation
  let technical;
  if (techScores.length > 0) {
    const avgTechQ = techScores.reduce((a, b) => a + b, 0) / techScores.length;
    technical = avgTechQ * 0.65 + (cCorrectness * 0.6 + cEfficiency * 0.4) * 0.35;
  } else if (type === "hr") {
    technical = Math.round(finalOverall * 0.75);
  } else {
    technical = cCorrectness * 0.55 + cProblemSolving * 0.45;
  }

  // 3. Communication Score Calculation
  let communication;
  if (commScores.length > 0) {
    const avgCommQ = commScores.reduce((a, b) => a + b, 0) / commScores.length;
    communication = avgCommQ * 0.6 + (cCommunication * 0.6 + cClarity * 0.4) * 0.4;
  } else {
    communication = cCommunication * 0.6 + cClarity * 0.4;
  }

  return {
    dsa: clampScore(dsa),
    technical: clampScore(technical),
    communication: clampScore(communication),
  };
}
