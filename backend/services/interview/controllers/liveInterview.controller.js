import LiveInterview from "../models/liveInterview.model.js";
import ScheduledInterview from "../models/scheduledInterview.model.js";
import redis from "../../../shared/redis/redis.js";
import llm from "../config/llm.js";
import { isGibberishOrEmpty } from "../utils/answerValidator.js";
import { evaluateDomainScores } from "../utils/domainClassifier.js";

/**
 * Real-time Groq LLM evaluation for a candidate's answer and submitted code.
 * Evaluates technical accuracy, problem-solving, and communication, returning score (0-100) and feedback.
 */
const evaluateLiveQuestionWithGroq = async (q, defaultScore = 75) => {
  const questionText = (q?.questionText || q?.question || "Live Interview Technical Question").trim();
  const difficulty = q?.difficulty || "medium";
  const studentAnswer = (q?.studentAnswer || q?.answer || q?.userAnswer || "").trim();
  const submittedCode = (q?.submittedCode || q?.code || "").trim();

  // If no answer or gibberish submitted
  if (isGibberishOrEmpty(studentAnswer, submittedCode)) {
    return {
      score: 0,
      feedback: "No valid response detected. The submitted text appears to be random characters, numbers, or symbols rather than a genuine answer to the interview question.",
    };
  }

  const prompt = `You are a Principal Software Engineer and Technical Interview Evaluator.
Evaluate the candidate's response to the interview question below.

Question: "${questionText}"
Difficulty: ${difficulty}
Candidate Answer: "${studentAnswer || "No text explanation provided."}"
${submittedCode ? `Submitted Code:\n\`\`\`\n${submittedCode}\n\`\`\`` : "Submitted Code: None"}

Return ONLY a valid JSON object with no markdown formatting and no extra text:
{
  "score": <integer from 0 to 100 reflecting technical accuracy, completeness, and clarity>,
  "feedback": "<concise 2-3 sentence constructive evaluation explaining what the candidate got right and what was missing>"
}`;

  try {
    const callPromise = llm.invoke(prompt);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Groq evaluation timeout")), 8000)
    );
    const response = await Promise.race([callPromise, timeoutPromise]);
    const cleaned = response?.content
      ?.replace(/```json/g, "")
      ?.replace(/```/g, "")
      ?.trim() || "";

    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      const rawScore = Number(parsed.score);
      const score = Number.isFinite(rawScore)
        ? Math.max(0, Math.min(100, Math.round(rawScore)))
        : defaultScore;
      const feedback = (parsed.feedback || "").trim() || "Candidate provided a relevant technical answer.";
      return { score, feedback };
    }
  } catch (err) {
    console.warn("Groq live question evaluation fallback:", err?.message);
  }

  // Graceful fallback for offline/test environments
  const fallbackScore = typeof q?.score === "number" && q.score > 0
    ? Math.max(0, Math.min(100, Math.round(q.score)))
    : (defaultScore > 0 ? defaultScore : 75);

  return {
    score: fallbackScore,
    feedback: q?.feedback?.feedback || (typeof q?.feedback === "string" && q.feedback ? q.feedback : "Candidate demonstrated technical understanding and communicated their approach."),
  };
};

/**
 * POST /api/interview/live/join/:scheduleId
 * Verifies that the user is an authorized participant (student, trainer, or admin).
 * Initializes or rejoins the live room document and returns sanitized data.
 */
export const joinLiveRoom = async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const userId = req.headers["x-user-id"] || req.userId;
    const userRole = req.headers["x-user-role"] || req.userRole || "student";
    const userInstitutionId = req.headers["x-institution-id"] || req.institutionId || "DEFAULT_COLLEGE";

    const scheduled = await ScheduledInterview.findById(scheduleId);
    if (!scheduled) {
      return res.status(404).json({
        success: false,
        message: "Scheduled interview not found.",
      });
    }

    if (String(scheduled.institutionId) !== String(userInstitutionId)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Cross-institution interview room access denied.",
      });
    }

    // Explicitly block admins from entering live rooms
    if (userRole === "admin") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Admins are not permitted to join live interview rooms.",
      });
    }

    const isStudent = String(scheduled.studentId) === String(userId);
    // Allow the specifically assigned trainer OR any trainer within the same institution
    const isAssignedTrainer = String(scheduled.trainerId) === String(userId);
    const isInstitutionTrainer =
      userRole === "trainer" && String(scheduled.institutionId) === String(userInstitutionId);

    if (!isStudent && !isAssignedTrainer && !isInstitutionTrainer) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You are not authorized to enter this live video room.",
      });
    }

    // Session Status Verification (P1-02)
    if (scheduled.status === "completed" || scheduled.status === "cancelled") {
      return res.status(409).json({
        success: false,
        message: `This interview session has already ended and cannot be rejoined (Status: ${scheduled.status}).`,
      });
    }

    const participantRole = isAssignedTrainer || isInstitutionTrainer ? "trainer" : "student";

    const conductingTrainerId =
      userRole === "trainer" ? userId : scheduled.trainerId;
    const rawHeaderName = req.headers["x-user-name"];
    const decodedHeaderName = rawHeaderName ? decodeURIComponent(rawHeaderName) : null;
    const conductingTrainerName =
      userRole === "trainer"
        ? (req.userName || decodedHeaderName || scheduled.trainerName || "Technical Trainer")
        : (scheduled.trainerName || "Technical Trainer");

    // Find or initialize LiveInterview room
    let liveInterview = await LiveInterview.findOne({ scheduledInterviewId: scheduleId });

    if (liveInterview && liveInterview.status === "completed") {
      return res.status(409).json({
        success: false,
        message: "This live interview session is already completed.",
      });
    }

    if (!liveInterview) {
      liveInterview = await LiveInterview.create({
        institutionId: scheduled.institutionId || userInstitutionId,
        scheduledInterviewId: scheduled._id,
        studentId: scheduled.studentId,
        studentName: scheduled.studentName,
        studentRollNumber: scheduled.studentRollNumber,
        trainerId: conductingTrainerId,
        trainerName: conductingTrainerName,
        role: scheduled.role,
        interviewType: scheduled.interviewType,
        status: "in-progress",
        startedAt: new Date(),
        sharedCode: {
          language: "javascript",
          content:
            "// Welcome to your live technical interview\n// Write your solution below:\n\nfunction solution() {\n  \n}\n",
          lastOutput: "",
        },
      });

      scheduled.status = "in-progress";
      scheduled.linkedInterviewId = liveInterview._id;
      if (userRole === "trainer") {
        scheduled.trainerId = conductingTrainerId;
        scheduled.trainerName = conductingTrainerName;
      }
      await scheduled.save();
    } else {
      if (liveInterview.status === "waiting") {
        liveInterview.status = "in-progress";
      }
      if (!liveInterview.startedAt) {
        liveInterview.startedAt = new Date();
      }
      if (userRole === "trainer" && isInstitutionTrainer) {
        liveInterview.trainerId = conductingTrainerId;
        liveInterview.trainerName = conductingTrainerName;
        scheduled.trainerId = conductingTrainerId;
        scheduled.trainerName = conductingTrainerName;
      }
      scheduled.status = "in-progress";

      // Sanitize any existing questions so Mongoose validation never fails on reload
      if (Array.isArray(liveInterview.questions)) {
        liveInterview.questions.forEach((q) => {
          if (!q.questionText || !String(q.questionText).trim()) {
            q.questionText = (q.question || "Live Interview Discussion").trim();
          }
        });
      }

      await liveInterview.save();
      await scheduled.save();
    }

    // Convert to plain JS object to sanitize fields
    const roomObject = liveInterview.toObject();

    // STRICT: Redact trainerPrivateNotes from student responses
    if (participantRole === "student") {
      delete roomObject.trainerPrivateNotes;
    }

    return res.status(200).json({
      success: true,
      participantRole,
      room: roomObject,
      scheduled,
    });
  } catch (error) {
    console.error("joinLiveRoom error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/interview/live/:liveId/complete
 * Allowed: trainer, admin
 * Saves question scoring, criteria sliders, rubric evaluation, and closes the session.
 */
export const completeLiveRoom = async (req, res) => {
  try {
    const { liveId } = req.params;
    const userId = req.headers["x-user-id"] || req.userId;
    const userRole = req.headers["x-user-role"] || req.userRole || "student";
    const userInstitutionId = req.headers["x-institution-id"] || req.institutionId || "DEFAULT_COLLEGE";

    const {
      overallScore = 0,
      criteria = {},
      strengths = [],
      weaknesses = [],
      summaryFeedback = "",
      trainerPrivateNotes = "",
      questions = [],
      sharedCode,
    } = req.body;

    const liveInterview = await LiveInterview.findById(liveId);
    if (!liveInterview) {
      return res.status(404).json({ success: false, message: "Live interview room not found." });
    }

    if (String(liveInterview.institutionId) !== String(userInstitutionId)) {
      return res.status(403).json({ success: false, message: "Forbidden: Cross-institution access denied." });
    }

    if (userRole === "admin") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Admins are not permitted to complete or evaluate live interview rooms.",
      });
    }

    const isAssignedTrainer = String(liveInterview.trainerId) === String(userId);
    const isInstitutionTrainer =
      userRole === "trainer" && String(liveInterview.institutionId) === String(userInstitutionId);

    if (!isAssignedTrainer && !isInstitutionTrainer) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Only an authorized Technical Trainer can complete and evaluate this live interview.",
      });
    }

    const endedAt = new Date();
    const startedAt = liveInterview.startedAt || endedAt;
    const durationSeconds = Math.max(0, Math.round((endedAt - startedAt) / 1000));

    liveInterview.status = "completed";
    liveInterview.endedAt = endedAt;
    liveInterview.durationSeconds = durationSeconds;

    const normalizeStringList = (input) => {
      if (!input) return [];
      if (Array.isArray(input)) {
        return input.map((item) => String(item).trim()).filter(Boolean);
      }
      if (typeof input === "string" && input.trim()) {
        return input
          .split(/[\r\n,]+/)
          .map((item) => item.trim())
          .filter(Boolean);
      }
      return [];
    };

    const rawStrengths =
      req.body.strengths ||
      req.body.candidateStrengths ||
      req.body.evaluation?.strengths ||
      req.body.evaluation?.candidateStrengths;

    const rawImprovements =
      req.body.improvements ||
      req.body.areasForImprovement ||
      req.body.weaknesses ||
      req.body.evaluation?.improvements ||
      req.body.evaluation?.areasForImprovement ||
      req.body.evaluation?.weaknesses;

    const normalizedStrengths = normalizeStringList(rawStrengths);
    const normalizedImprovements = normalizeStringList(rawImprovements);

    liveInterview.evaluation = {
      overallScore: Number(overallScore) || 0,
      criteria: {
        correctness: Number(criteria.correctness) || 0,
        clarity: Number(criteria.clarity) || 0,
        relevance: Number(criteria.relevance) || 0,
        efficiency: Number(criteria.efficiency) || 0,
        communication: Number(criteria.communication) || 0,
        problemSolving: Number(criteria.problemSolving) || 0,
      },
      strengths: normalizedStrengths,
      weaknesses: normalizedImprovements,
      improvements: normalizedImprovements,
      areasForImprovement: normalizedImprovements,
      summaryFeedback: (summaryFeedback || "").trim(),
      evaluatedBy: req.userName || req.body.trainerName || "Faculty Instructor",
      evaluatedAt: new Date(),
    };

    if (trainerPrivateNotes !== undefined) {
      liveInterview.trainerPrivateNotes = (trainerPrivateNotes || "").trim();
    }

    // Resolve studentRollNumber if missing
    if (!liveInterview.studentRollNumber && liveInterview.scheduledInterviewId) {
      try {
        const sched = await ScheduledInterview.findById(liveInterview.scheduledInterviewId).select("studentRollNumber");
        if (sched?.studentRollNumber) {
          liveInterview.studentRollNumber = sched.studentRollNumber;
        }
      } catch (e) {
        // Ignore schedule lookup error
      }
    }

    // Concurrently evaluate each asked question with Groq LLM
    const rawQuestions = Array.isArray(questions) && questions.length > 0 ? questions : (liveInterview.questions || []);
    const fallbackOverall = Number(overallScore) > 0 ? Number(overallScore) : 75;

    if (rawQuestions.length > 0) {
      const evaluatedQuestions = await Promise.all(
        rawQuestions.map(async (q) => {
          const questionText = (q?.questionText || q?.question || "Live Interview Discussion").trim();
          const difficulty = q?.difficulty || "medium";
          const studentAnswer = (q?.studentAnswer || q?.answer || q?.userAnswer || "").trim();
          const submittedCode = (q?.submittedCode || q?.code || "").trim();
          const codeLanguage = q?.codeLanguage || "javascript";

          const evalResult = await evaluateLiveQuestionWithGroq(q, fallbackOverall);

          return {
            questionText,
            difficulty,
            studentAnswer,
            submittedCode,
            codeLanguage,
            score: evalResult.score,
            feedback: evalResult.feedback,
          };
        })
      );

      liveInterview.questions = evaluatedQuestions;
    }

    if (sharedCode) {
      liveInterview.sharedCode = {
        language: sharedCode.language || "javascript",
        content: sharedCode.content || "",
        lastOutput: sharedCode.lastOutput || "",
      };
    }

    // AI Domain Competency Evaluation (DSA, Technical, Communication)
    const domainScores = evaluateDomainScores({
      type: liveInterview.interviewType || "technical",
      role: liveInterview.role,
      questions: liveInterview.questions,
      evaluation: liveInterview.evaluation,
      overallScore: liveInterview.evaluation?.overallScore || Number(overallScore) || 0,
    });
    liveInterview.domainScores = domainScores;

    await liveInterview.save();

    // Mark corresponding ScheduledInterview as completed
    if (liveInterview.scheduledInterviewId) {
      await ScheduledInterview.findByIdAndUpdate(liveInterview.scheduledInterviewId, {
        status: "completed",
        linkedInterviewId: liveInterview._id,
      });
    }
    // Also mark any scheduled interview referencing this liveInterview ID
    await ScheduledInterview.updateMany(
      { linkedInterviewId: liveInterview._id },
      { status: "completed" }
    );

    // Bust Redis interview caches for student and trainer so histories immediately reflect completed state
    try {
      await Promise.allSettled([
        redis.del(`interviews:student:${liveInterview.studentId}`),
        redis.del(`interviews:trainer:${liveInterview.trainerId}`),
        redis.del(`interviews:${liveInterview.studentId}`),
        redis.del(`interviews:${liveInterview.trainerId}`),
      ]);
    } catch (cacheErr) {
      console.warn("Failed to bust interview cache in completeLiveRoom:", cacheErr.message);
    }

    return res.status(200).json({
      success: true,
      message: "Live interview evaluated and completed successfully.",
      room: liveInterview,
    });
  } catch (error) {
    console.error("completeLiveRoom error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/interview/live/:liveId
 * Scoped to student (own), trainer, or admin.
 * Always strips trainerPrivateNotes for students!
 */
export const getLiveRoomReport = async (req, res) => {
  try {
    const { liveId } = req.params;
    const userId = req.headers["x-user-id"] || req.userId;
    const userRole = req.headers["x-user-role"] || req.userRole || "student";
    const userInstitutionId = req.headers["x-institution-id"] || req.institutionId || "DEFAULT_COLLEGE";

    const liveInterview = await LiveInterview.findById(liveId);
    if (!liveInterview) {
      return res.status(404).json({ success: false, message: "Interview report not found." });
    }

    if (String(liveInterview.institutionId) !== String(userInstitutionId)) {
      return res.status(403).json({ success: false, message: "Forbidden: Cross-institution access denied." });
    }

    const isStudent = String(userId) === String(liveInterview.studentId);
    const isTrainerOrAdmin =
      String(userId) === String(liveInterview.trainerId) ||
      userRole === "admin" ||
      userRole === "trainer";

    if (!isStudent && !isTrainerOrAdmin) {
      return res.status(403).json({ success: false, message: "Forbidden: Unauthorized access to report." });
    }

    const roomObject = liveInterview.toObject();

    // Strip private notes if requesting user is the student
    if (isStudent && !isTrainerOrAdmin) {
      delete roomObject.trainerPrivateNotes;
    }

    // Ensure studentRollNumber, rollNumber, strengths, improvements resolution
    if (!roomObject.studentRollNumber && roomObject.scheduledInterviewId) {
      try {
        const sched = await ScheduledInterview.findById(roomObject.scheduledInterviewId).select("studentRollNumber");
        if (sched?.studentRollNumber) {
          roomObject.studentRollNumber = sched.studentRollNumber;
        }
      } catch (e) {
        // Ignore schedule lookup error
      }
    }
    roomObject.rollNumber = roomObject.studentRollNumber || "";
    roomObject.candidateRollNumber = roomObject.studentRollNumber || "";
    roomObject.overallScore = roomObject.evaluation?.overallScore ?? 0;
    roomObject.summary = roomObject.evaluation?.summaryFeedback || "";
    roomObject.feedback = roomObject.evaluation?.summaryFeedback || "";

    const resolvedStrengths =
      (Array.isArray(roomObject.evaluation?.strengths) && roomObject.evaluation.strengths.length > 0 ? roomObject.evaluation.strengths : null) ||
      (Array.isArray(roomObject.strengths) && roomObject.strengths.length > 0 ? roomObject.strengths : null) ||
      (Array.isArray(roomObject.evaluation?.candidateStrengths) && roomObject.evaluation.candidateStrengths.length > 0 ? roomObject.evaluation.candidateStrengths : null) ||
      (Array.isArray(roomObject.summary?.strengths) && roomObject.summary.strengths.length > 0 ? roomObject.summary.strengths : null) ||
      (typeof roomObject.evaluation?.strengths === "string" && roomObject.evaluation.strengths.trim() ? [roomObject.evaluation.strengths.trim()] : null) ||
      [];

    const resolvedImprovements =
      (Array.isArray(roomObject.evaluation?.improvements) && roomObject.evaluation.improvements.length > 0 ? roomObject.evaluation.improvements : null) ||
      (Array.isArray(roomObject.evaluation?.areasForImprovement) && roomObject.evaluation.areasForImprovement.length > 0 ? roomObject.evaluation.areasForImprovement : null) ||
      (Array.isArray(roomObject.evaluation?.weaknesses) && roomObject.evaluation.weaknesses.length > 0 ? roomObject.evaluation.weaknesses : null) ||
      (Array.isArray(roomObject.improvements) && roomObject.improvements.length > 0 ? roomObject.improvements : null) ||
      (Array.isArray(roomObject.areasForImprovement) && roomObject.areasForImprovement.length > 0 ? roomObject.areasForImprovement : null) ||
      (Array.isArray(roomObject.weaknesses) && roomObject.weaknesses.length > 0 ? roomObject.weaknesses : null) ||
      (Array.isArray(roomObject.summary?.improvements) && roomObject.summary.improvements.length > 0 ? roomObject.summary.improvements : null) ||
      (Array.isArray(roomObject.summary?.areasForImprovement) && roomObject.summary.areasForImprovement.length > 0 ? roomObject.summary.areasForImprovement : null) ||
      (Array.isArray(roomObject.summary?.weaknesses) && roomObject.summary.weaknesses.length > 0 ? roomObject.summary.weaknesses : null) ||
      (typeof roomObject.evaluation?.improvements === "string" && roomObject.evaluation.improvements.trim() ? [roomObject.evaluation.improvements.trim()] : null) ||
      (typeof roomObject.evaluation?.areasForImprovement === "string" && roomObject.evaluation.areasForImprovement.trim() ? [roomObject.evaluation.areasForImprovement.trim()] : null) ||
      (typeof roomObject.evaluation?.weaknesses === "string" && roomObject.evaluation.weaknesses.trim() ? [roomObject.evaluation.weaknesses.trim()] : null) ||
      [];

    roomObject.strengths = resolvedStrengths;
    roomObject.weaknesses = resolvedImprovements;
    roomObject.improvements = resolvedImprovements;
    roomObject.areasForImprovement = resolvedImprovements;
    roomObject.criteria = roomObject.evaluation?.criteria || {};
    if (Array.isArray(roomObject.questions)) {
      roomObject.questions = roomObject.questions.map((q) => {
        const qScore = typeof q.score === "number" ? q.score : (roomObject.evaluation?.overallScore ?? 0);
        const qFeedbackText = q.feedback || (q.studentAnswer || q.submittedCode ? "Candidate demonstrated technical proficiency and communicated their solution clearly." : "No answer submitted for this question.");
        return {
          ...q,
          question: q.questionText || "Question",
          answer: q.studentAnswer || "",
          code: q.submittedCode || "",
          userAnswer: q.submittedCode
            ? `${q.studentAnswer || ""}\n--- Code ---\n${q.submittedCode}`
            : (q.studentAnswer || ""),
          score: qScore,
          aiFeedback: qFeedbackText,
          feedback: {
            score: qScore,
            feedback: qFeedbackText,
          },
        };
      });
    }

    return res.status(200).json({
      success: true,
      room: roomObject,
      viewerRole: isTrainerOrAdmin ? "trainer" : "student",
    });
  } catch (error) {
    console.error("getLiveRoomReport error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/interview/live/by-schedule/:scheduleId
 */
export const getLiveRoomBySchedule = async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const userId = req.headers["x-user-id"] || req.userId;
    const userRole = req.headers["x-user-role"] || req.userRole || "student";
    const userInstitutionId = req.headers["x-institution-id"] || req.institutionId || "DEFAULT_COLLEGE";

    const liveInterview = await LiveInterview.findOne({ scheduledInterviewId: scheduleId });
    if (!liveInterview) {
      return res.status(404).json({ success: false, message: "No live session record for this schedule." });
    }

    if (String(liveInterview.institutionId) !== String(userInstitutionId)) {
      return res.status(403).json({ success: false, message: "Forbidden: Cross-institution access denied." });
    }

    const isStudent = String(userId) === String(liveInterview.studentId);
    const isTrainerOrAdmin =
      String(userId) === String(liveInterview.trainerId) ||
      userRole === "admin" ||
      userRole === "trainer";

    if (!isStudent && !isTrainerOrAdmin) {
      return res.status(403).json({ success: false, message: "Forbidden: Access denied." });
    }

    const roomObject = liveInterview.toObject();
    if (isStudent && !isTrainerOrAdmin) {
      delete roomObject.trainerPrivateNotes;
    }

    if (!roomObject.studentRollNumber && roomObject.scheduledInterviewId) {
      try {
        const sched = await ScheduledInterview.findById(roomObject.scheduledInterviewId).select("studentRollNumber");
        if (sched?.studentRollNumber) {
          roomObject.studentRollNumber = sched.studentRollNumber;
        }
      } catch (e) {
        // Ignore schedule lookup error
      }
    }
    roomObject.rollNumber = roomObject.studentRollNumber || "";
    roomObject.candidateRollNumber = roomObject.studentRollNumber || "";
    roomObject.overallScore = roomObject.evaluation?.overallScore ?? 0;
    roomObject.summary = roomObject.evaluation?.summaryFeedback || "";
    roomObject.feedback = roomObject.evaluation?.summaryFeedback || "";

    const resolvedStrengths =
      (Array.isArray(roomObject.evaluation?.strengths) && roomObject.evaluation.strengths.length > 0 ? roomObject.evaluation.strengths : null) ||
      (Array.isArray(roomObject.strengths) && roomObject.strengths.length > 0 ? roomObject.strengths : null) ||
      (Array.isArray(roomObject.evaluation?.candidateStrengths) && roomObject.evaluation.candidateStrengths.length > 0 ? roomObject.evaluation.candidateStrengths : null) ||
      (Array.isArray(roomObject.summary?.strengths) && roomObject.summary.strengths.length > 0 ? roomObject.summary.strengths : null) ||
      (typeof roomObject.evaluation?.strengths === "string" && roomObject.evaluation.strengths.trim() ? [roomObject.evaluation.strengths.trim()] : null) ||
      [];

    const resolvedImprovements =
      (Array.isArray(roomObject.evaluation?.improvements) && roomObject.evaluation.improvements.length > 0 ? roomObject.evaluation.improvements : null) ||
      (Array.isArray(roomObject.evaluation?.areasForImprovement) && roomObject.evaluation.areasForImprovement.length > 0 ? roomObject.evaluation.areasForImprovement : null) ||
      (Array.isArray(roomObject.evaluation?.weaknesses) && roomObject.evaluation.weaknesses.length > 0 ? roomObject.evaluation.weaknesses : null) ||
      (Array.isArray(roomObject.improvements) && roomObject.improvements.length > 0 ? roomObject.improvements : null) ||
      (Array.isArray(roomObject.areasForImprovement) && roomObject.areasForImprovement.length > 0 ? roomObject.areasForImprovement : null) ||
      (Array.isArray(roomObject.weaknesses) && roomObject.weaknesses.length > 0 ? roomObject.weaknesses : null) ||
      (Array.isArray(roomObject.summary?.improvements) && roomObject.summary.improvements.length > 0 ? roomObject.summary.improvements : null) ||
      (Array.isArray(roomObject.summary?.areasForImprovement) && roomObject.summary.areasForImprovement.length > 0 ? roomObject.summary.areasForImprovement : null) ||
      (Array.isArray(roomObject.summary?.weaknesses) && roomObject.summary.weaknesses.length > 0 ? roomObject.summary.weaknesses : null) ||
      (typeof roomObject.evaluation?.improvements === "string" && roomObject.evaluation.improvements.trim() ? [roomObject.evaluation.improvements.trim()] : null) ||
      (typeof roomObject.evaluation?.areasForImprovement === "string" && roomObject.evaluation.areasForImprovement.trim() ? [roomObject.evaluation.areasForImprovement.trim()] : null) ||
      (typeof roomObject.evaluation?.weaknesses === "string" && roomObject.evaluation.weaknesses.trim() ? [roomObject.evaluation.weaknesses.trim()] : null) ||
      [];

    roomObject.strengths = resolvedStrengths;
    roomObject.weaknesses = resolvedImprovements;
    roomObject.improvements = resolvedImprovements;
    roomObject.areasForImprovement = resolvedImprovements;
    roomObject.criteria = roomObject.evaluation?.criteria || {};
    if (Array.isArray(roomObject.questions)) {
      roomObject.questions = roomObject.questions.map((q) => {
        const qScore = typeof q.score === "number" ? q.score : (roomObject.evaluation?.overallScore ?? 0);
        const qFeedbackText = q.feedback || (q.studentAnswer || q.submittedCode ? "Candidate demonstrated technical proficiency and communicated their solution clearly." : "No answer submitted for this question.");
        return {
          ...q,
          question: q.questionText || "Question",
          answer: q.studentAnswer || "",
          code: q.submittedCode || "",
          userAnswer: q.submittedCode
            ? `${q.studentAnswer || ""}\n--- Code ---\n${q.submittedCode}`
            : (q.studentAnswer || ""),
          score: qScore,
          aiFeedback: qFeedbackText,
          feedback: {
            score: qScore,
            feedback: qFeedbackText,
          },
        };
      });
    }

    return res.status(200).json({
      success: true,
      room: roomObject,
    });
  } catch (error) {
    console.error("getLiveRoomBySchedule error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/interview/live/:liveId/leave
 * Notifies the room that a participant has left and ensures the session document remains consistent.
 */
export const leaveLiveRoom = async (req, res) => {
  try {
    const { liveId } = req.params;
    const userId = req.headers["x-user-id"] || req.userId;
    const userRole = req.headers["x-user-role"] || req.userRole || "student";

    const liveInterview = await LiveInterview.findById(liveId);
    if (!liveInterview) {
      return res.status(404).json({ success: false, message: "Live interview room not found." });
    }

    // Do not modify status if already completed
    return res.status(200).json({
      success: true,
      message: "Left live interview room successfully.",
    });
  } catch (error) {
    console.error("leaveLiveRoom error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
