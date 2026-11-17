import LiveInterview from "../models/liveInterview.model.js";
import ScheduledInterview from "../models/scheduledInterview.model.js";
import redis from "../../../shared/redis/redis.js";

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

    return res.status(200).json({
      success: true,
      room: roomObject,
    });
  } catch (error) {
    console.error("getLiveRoomBySchedule error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
