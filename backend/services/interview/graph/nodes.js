import { feedbackAgent } from "../agents/feedback.agent.js";
import { interviewAgent } from "../agents/interview.agent.js";
import { summaryAgent } from "../agents/summary.agent.js";



export async function interviewNode(state) {
    const questions = await interviewAgent({
        role:state.role,
        type:state.type,
        useResume:state.useResume,
        resume:state.resume

    })

    return {
        questions
    }
    
}

export async function feedbackNode(state) {
    const feedback = await feedbackAgent({
        question: state.question,

        answer: state.answer,

        difficulty: state.difficulty,

    })

    return {
        feedback
    }
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

    const report = await summaryAgent({
         role: state.role,

        type: state.type,

        questions,
    })

    return {
        report
    }
}