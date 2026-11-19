import { feedbackAgent } from "../agents/feedback.agent.js";
import { interviewAgent } from "../agents/interview.agent.js";
import { summaryAgent } from "../agents/summary.agent.js";
import { isGibberishOrEmpty, getZeroScoreFeedback } from "../utils/answerValidator.js";

export async function interviewNode(state) {
    const questions = await interviewAgent({
        role: state.role,
        type: state.type,
        useResume: state.useResume,
        resume: state.resume
    });

    return {
        questions
    };
}

export async function feedbackNode(state) {
    // 1. Deterministic Gibberish & Empty Non-Answer Guard
    if (isGibberishOrEmpty(state.answer)) {
        return {
            feedback: getZeroScoreFeedback()
        };
    }

    const feedback = await feedbackAgent({
        question: state.question,
        answer: state.answer,
        difficulty: state.difficulty,
    });

    return {
        feedback
    };
}

export async function summaryNode(state) {
    let questions = Array.isArray(state.questions) ? [...state.questions] : [];
    if (questions.length > 0 && state.feedback) {
        questions = questions.map((q, idx) => {
            const qObj = q && typeof q.toObject === "function" ? q.toObject() : { ...q };
            if (idx === questions.length - 1 || (state.question && qObj.question === state.question)) {
                return {
                    ...qObj,
                    userAnswer: state.answer || qObj.userAnswer || "",
                    feedback: state.feedback || qObj.feedback || {},
                };
            }
            return qObj;
        });
    }

    // 2. Deterministic Score Aggregation across questions
    const questionScores = questions.map((q) => {
        const qScore = q.feedback?.score ?? q.score ?? 0;
        return Number(qScore) || 0;
    });

    const totalQuestions = questions.length;
    const computedAverageScore = totalQuestions > 0
        ? Math.round(questionScores.reduce((sum, s) => sum + s, 0) / totalQuestions)
        : 0;

    const validAnsweredCount = questions.filter((q) => {
        const ans = (q.userAnswer || q.answer || "").trim();
        const score = q.feedback?.score ?? q.score ?? 0;
        return ans.length > 0 && score > 0 && !isGibberishOrEmpty(ans);
    }).length;

    // 3. Invoke summary agent with deterministic ground truth
    const report = await summaryAgent({
        role: state.role,
        type: state.type,
        questions,
        computedAverageScore,
        validAnsweredCount,
    });

    return {
        report
    };
}
