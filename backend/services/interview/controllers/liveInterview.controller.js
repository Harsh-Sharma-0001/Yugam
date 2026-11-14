import LiveInterview from "../models/liveInterview.model.js";
import ScheduledInterview from "../models/scheduledInterview.model.js";

/**
 * POST /api/interview/live/join/:scheduleId
 * Verifies that the user is an authorized participant (student, trainer, or admin).
 * Initializes or rejoins the live room document and returns sanitized data.
 */
export const joinLiveRoom = async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const userId = req.userId;
    const userRole = req.userRole || "student";
    const institutionId = req.institutionId || "DEFAULT_COLLEGE";

    const scheduled = await ScheduledInterview.findById(scheduleId);
    if (!scheduled) {
      return res.status(404).json({
        success: false,
        message: "Scheduled interview not found.",
      });
    }

    if (scheduled.institutionId !== institutionId) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Cross-institution interview room access denied.",
      });
    }

    // Strict Trainer & Student Only: Admins are not permitted to join live interview rooms
    if (userRole === "admin") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Admins are not permitted to join live interview rooms.",
      });
    }

    const isStudent = String(scheduled.studentId) === String(userId);
    const isTrainer = String(scheduled.trainerId) === String(userId);

    if (!isStudent && !isTrainer) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Only the assigned Technical Trainer and Student can enter this live video room.",
      });
    }

    const participantRole = isTrainer ? "trainer" : "student";

    // Find or initialize LiveInterview room
    let liveInterview = await LiveInterview.findOne({ scheduledInterviewId: scheduleId });

    if (!liveInterview) {
      liveInterview = await LiveInterview.create({
        institutionId,
        scheduledInterviewId: scheduled._id,
        studentId: scheduled.studentId,
        studentName: scheduled.studentName,
        studentRollNumber: scheduled.studentRollNumber,
        trainerId: scheduled.trainerId,
        trainerName: scheduled.trainerName,
        role: scheduled.role,
        interviewType: scheduled.interviewType,
        status: "in-progress",
        startedAt: new Date(),
        sharedCode: {
          language: "javascript",
          content: "// Welcome to your live technical interview\n// Write your solution below:\n\nfunction solution() {\n  \n}\n",
          lastOutput: "",
        },
      });

      scheduled.status = "in-progress";
      scheduled.linkedInterviewId = liveInterview._id;
      await scheduled.save();
    } else if (liveInterview.status === "waiting") {
      liveInterview.status = "in-progress";
      if (!liveInterview.startedAt) liveInterview.startedAt = new Date();
      await liveInterview.save();

      scheduled.status = "in-progress";
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

    if (req.institutionId && liveInterview.institutionId !== req.institutionId) {
      return res.status(403).json({ success: false, message: "Forbidden: Cross-institution access denied." });
    }

    const endedAt = new Date();
    const startedAt = liveInterview.startedAt || endedAt;
    const durationSeconds = Math.max(0, Math.round((endedAt - startedAt) / 1000));

    liveInterview.status = "completed";
    liveInterview.endedAt = endedAt;
    liveInterview.durationSeconds = durationSeconds;

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
      strengths: Array.isArray(strengths) ? strengths : [],
      weaknesses: Array.isArray(weaknesses) ? weaknesses : [],
      summaryFeedback: (summaryFeedback || "").trim(),
      evaluatedBy: req.userName || req.body.trainerName || "Faculty Instructor",
      evaluatedAt: new Date(),
    };

    if (trainerPrivateNotes !== undefined) {
      liveInterview.trainerPrivateNotes = (trainerPrivateNotes || "").trim();
    }

    if (Array.isArray(questions) && questions.length > 0) {
      liveInterview.questions = questions;
    }

    if (sharedCode) {
      liveInterview.sharedCode = {
        language: sharedCode.language || "javascript",
        content: sharedCode.content || "",
        lastOutput: sharedCode.lastOutput || "",
      };
    }

    await liveInterview.save();

    // Mark corresponding ScheduledInterview as completed
    if (liveInterview.scheduledInterviewId) {
      await ScheduledInterview.findByIdAndUpdate(liveInterview.scheduledInterviewId, {
        status: "completed",
        linkedInterviewId: liveInterview._id,
      });
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
    const liveInterview = await LiveInterview.findById(liveId);
    if (!liveInterview) {
      return res.status(404).json({ success: false, message: "Interview report not found." });
    }

    if (req.institutionId && liveInterview.institutionId !== req.institutionId) {
      return res.status(403).json({ success: false, message: "Forbidden: Cross-institution access denied." });
    }

    const isStudent = String(req.userId) === String(liveInterview.studentId);
    const isTrainerOrAdmin =
      String(req.userId) === String(liveInterview.trainerId) ||
      req.userRole === "admin" ||
      req.userRole === "trainer";

    if (!isStudent && !isTrainerOrAdmin) {
      return res.status(403).json({ success: false, message: "Forbidden: Unauthorized access to report." });
    }

    const roomObject = liveInterview.toObject();

    // Strip private notes if requesting user is the student
    if (isStudent && !isTrainerOrAdmin) {
      delete roomObject.trainerPrivateNotes;
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
    const liveInterview = await LiveInterview.findOne({ scheduledInterviewId: scheduleId });
    if (!liveInterview) {
      return res.status(404).json({ success: false, message: "No live session record for this schedule." });
    }

    const isStudent = String(req.userId) === String(liveInterview.studentId);
    const isTrainerOrAdmin =
      String(req.userId) === String(liveInterview.trainerId) ||
      req.userRole === "admin" ||
      req.userRole === "trainer";

    if (!isStudent && !isTrainerOrAdmin) {
      return res.status(403).json({ success: false, message: "Forbidden: Access denied." });
    }

    const roomObject = liveInterview.toObject();
    if (isStudent && !isTrainerOrAdmin) {
      delete roomObject.trainerPrivateNotes;
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
