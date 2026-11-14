import ScheduledInterview from "../models/scheduledInterview.model.js";

/**
 * POST /api/interview/schedule
 * Allowed: trainer, admin
 * Schedules an AI or Live interview for a student or entire section.
 */
export const scheduleInterview = async (req, res) => {
  try {
    const institutionId = req.institutionId || "DEFAULT_COLLEGE";
    const trainerId = req.userId;
    const trainerName = req.userName || req.body.trainerName || "Instructor";

    const {
      mode = "ai",
      studentId,
      studentName,
      studentRollNumber,
      section,
      targetSection,
      role = "Software Engineer",
      interviewType = "technical",
      experience = "Fresher / Campus",
      scheduledAt,
      durationMinutes = 45,
      instructions = "",
    } = req.body;

    if (!scheduledAt) {
      return res.status(400).json({ success: false, message: "scheduledAt date is required." });
    }

    if (!role || !role.trim()) {
      return res.status(400).json({ success: false, message: "Target role is required." });
    }

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid scheduledAt date format." });
    }

    // Single student scheduling
    if (studentId) {
      const scheduled = await ScheduledInterview.create({
        institutionId,
        mode,
        studentId,
        studentName: studentName || "Student",
        studentRollNumber: studentRollNumber || "",
        section: section || "",
        trainerId,
        trainerName,
        role: role.trim(),
        interviewType,
        experience,
        scheduledAt: scheduledDate,
        durationMinutes: Number(durationMinutes) || 45,
        instructions: instructions.trim(),
        status: "scheduled",
      });

      return res.status(201).json({
        success: true,
        message: `Interview scheduled successfully for ${scheduled.studentName}.`,
        count: 1,
        scheduledInterviews: [scheduled],
      });
    }

    // Section-wide scheduling
    if (targetSection) {
      const authServiceUrl = process.env.AUTH_SERVICE_URL || "http://localhost:8001";
      const internalSecret = process.env.INTERNAL_SERVICE_SECRET || "";

      const authRes = await fetch(
        `${authServiceUrl}/internal/institution/students?institutionId=${encodeURIComponent(
          institutionId
        )}`,
        {
          headers: { "x-internal-service-key": internalSecret },
        }
      );

      let targetStudents = [];
      if (authRes.ok) {
        const data = await authRes.json();
        if (Array.isArray(data?.students)) {
          const cleanTarget = targetSection.toLowerCase().trim();
          targetStudents = data.students.filter(
            (s) => s.profile?.section?.toLowerCase().trim() === cleanTarget
          );
        }
      }

      if (targetStudents.length === 0) {
        return res.status(404).json({
          success: false,
          message: `No active students found in section '${targetSection}'.`,
        });
      }

      const recordsToInsert = targetStudents.map((s) => ({
        institutionId,
        mode,
        studentId: s._id,
        studentName: s.name || "Student",
        studentRollNumber: s.profile?.rollNumber || "",
        section: s.profile?.section || targetSection,
        trainerId,
        trainerName,
        role: role.trim(),
        interviewType,
        experience,
        scheduledAt: scheduledDate,
        durationMinutes: Number(durationMinutes) || 45,
        instructions: instructions.trim(),
        status: "scheduled",
      }));

      const createdRecords = await ScheduledInterview.insertMany(recordsToInsert);

      return res.status(201).json({
        success: true,
        message: `Scheduled ${createdRecords.length} interviews for section ${targetSection}.`,
        count: createdRecords.length,
        scheduledInterviews: createdRecords,
      });
    }

    return res.status(400).json({
      success: false,
      message: "Either studentId or targetSection must be provided.",
    });
  } catch (error) {
    console.error("scheduleInterview error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/interview/schedule
 * Allowed: student, trainer, admin
 */
export const getScheduledInterviews = async (req, res) => {
  try {
    const institutionId = req.institutionId || "DEFAULT_COLLEGE";
    const userRole = req.userRole || "student";
    const userId = req.userId;

    if (userRole === "student") {
      const scheduled = await ScheduledInterview.find({
        institutionId,
        studentId: userId,
      }).sort({ scheduledAt: 1 });

      return res.status(200).json({
        success: true,
        count: scheduled.length,
        scheduledInterviews: scheduled,
      });
    }

    // For trainer / admin
    const filter = { institutionId };
    if (req.query.status && req.query.status !== "all") {
      filter.status = req.query.status;
    }
    if (req.query.mode && req.query.mode !== "all") {
      filter.mode = req.query.mode;
    }
    if (req.query.studentId) {
      filter.studentId = req.query.studentId;
    }
    if (req.query.trainerId) {
      filter.trainerId = req.query.trainerId;
    }

    const scheduled = await ScheduledInterview.find(filter).sort({ scheduledAt: -1 });

    return res.status(200).json({
      success: true,
      count: scheduled.length,
      scheduledInterviews: scheduled,
    });
  } catch (error) {
    console.error("getScheduledInterviews error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PATCH /api/interview/schedule/:id/status
 * Allowed: trainer, admin
 */
export const updateScheduleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, scheduledAt, instructions } = req.body;

    const scheduled = await ScheduledInterview.findById(id);
    if (!scheduled) {
      return res.status(404).json({ success: false, message: "Scheduled interview not found." });
    }

    if (req.institutionId && scheduled.institutionId !== req.institutionId) {
      return res.status(403).json({ success: false, message: "Forbidden: Cross-institution action denied." });
    }

    if (status) {
      if (!["scheduled", "in-progress", "completed", "cancelled"].includes(status)) {
        return res.status(400).json({ success: false, message: `Invalid status: ${status}` });
      }
      scheduled.status = status;
    }

    if (scheduledAt) {
      const parsedDate = new Date(scheduledAt);
      if (!isNaN(parsedDate.getTime())) {
        scheduled.scheduledAt = parsedDate;
      }
    }

    if (instructions !== undefined) {
      scheduled.instructions = instructions.trim();
    }

    await scheduled.save();

    return res.status(200).json({
      success: true,
      message: "Scheduled interview updated successfully.",
      scheduledInterview: scheduled,
    });
  } catch (error) {
    console.error("updateScheduleStatus error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/interview/schedule/:id
 * Allowed: student, trainer, admin
 */
export const getScheduleById = async (req, res) => {
  try {
    const { id } = req.params;
    const scheduled = await ScheduledInterview.findById(id);
    if (!scheduled) {
      return res.status(404).json({ success: false, message: "Scheduled session not found." });
    }

    if (req.institutionId && scheduled.institutionId !== req.institutionId) {
      return res.status(403).json({ success: false, message: "Forbidden: Cross-institution access denied." });
    }

    return res.status(200).json({
      success: true,
      scheduledInterview: scheduled,
    });
  } catch (error) {
    console.error("getScheduleById error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
