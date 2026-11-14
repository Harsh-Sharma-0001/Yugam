import mongoose from "mongoose";
import ScheduledInterview from "../models/scheduledInterview.model.js";

/**
 * Helper to fetch institution students from auth service
 */
const fetchInstitutionStudents = async (institutionId) => {
  try {
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

    if (authRes.ok) {
      const data = await authRes.json();
      if (Array.isArray(data?.students)) {
        return data.students;
      }
    }
  } catch (err) {
    console.warn("fetchInstitutionStudents warning:", err.message);
  }
  return [];
};

/**
 * POST /api/interview/schedule
 * Allowed: trainer, admin
 * Schedules an AI or Live interview for a student or entire section.
 * Supports resolving student by MongoDB _id, Email, or University Roll Number.
 */
export const scheduleInterview = async (req, res) => {
  try {
    const institutionId = req.institutionId || "DEFAULT_COLLEGE";
    const trainerId = req.userId;
    const trainerName = req.userName || req.body.trainerName || "Instructor";

    const {
      mode = "ai",
      studentId,
      studentIdentifier,
      studentName,
      studentRollNumber,
      section,
      targetSection,
      targetType = "individual",
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

    const isSectionScheduling =
      String(targetType).toUpperCase() === "SECTION" ||
      Boolean(targetSection && !studentIdentifier && !studentId);

    // Section-wide scheduling
    if (isSectionScheduling) {
      if (!targetSection || !targetSection.trim()) {
        return res.status(400).json({
          success: false,
          message: "Target section code is required for section-wide scheduling.",
        });
      }

      const allStudents = await fetchInstitutionStudents(institutionId);
      const cleanTarget = targetSection.toLowerCase().trim();
      const targetStudents = allStudents.filter(
        (s) => s.profile?.section?.toLowerCase().trim() === cleanTarget
      );

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

    // Individual student scheduling
    const rawInput = (studentIdentifier || studentId || "").trim();
    if (!rawInput) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid Student ID, Email, Roll Number, or select a student.",
      });
    }

    const allStudents = await fetchInstitutionStudents(institutionId);
    const cleanInput = rawInput.toLowerCase();

    // Match by MongoDB _id, Email, or University Roll Number
    let resolvedStudent = allStudents.find((s) => {
      const sId = String(s._id);
      const sEmail = (s.email || "").toLowerCase();
      const sRoll = (s.profile?.rollNumber || "").toLowerCase();
      return sId === rawInput || sEmail === cleanInput || sRoll === cleanInput;
    });

    if (!resolvedStudent) {
      // If auth returned students or input is not a valid ObjectId, reject with 404
      if (allStudents.length > 0 || !mongoose.Types.ObjectId.isValid(rawInput)) {
        return res.status(404).json({
          success: false,
          message: "No registered student found matching that email, roll number, or ID.",
        });
      }
    }

    const finalStudentId = resolvedStudent ? resolvedStudent._id : rawInput;
    const finalStudentName = (resolvedStudent?.name || studentName || "Student").trim();
    const finalStudentRoll = (resolvedStudent?.profile?.rollNumber || studentRollNumber || "").trim();
    const finalSection = (resolvedStudent?.profile?.section || section || "").trim();

    const scheduled = await ScheduledInterview.create({
      institutionId,
      mode,
      studentId: finalStudentId,
      studentName: finalStudentName,
      studentRollNumber: finalStudentRoll,
      section: finalSection,
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
  } catch (error) {
    console.error("scheduleInterview error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createScheduledInterview = scheduleInterview;

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

/**
 * DELETE /api/interview/schedule/:id
 * Allowed: trainer, admin
 * Deletes a scheduled interview document by ID, scoped to institutionId.
 * Logs the deletion event to AuditLog.
 */
export const deleteScheduledInterview = async (req, res) => {
  try {
    const { id } = req.params;
    const institutionId = req.institutionId || "DEFAULT_COLLEGE";
    const userId = req.userId;
    const userRole = req.userRole || "trainer";

    const scheduled = await ScheduledInterview.findById(id);
    if (!scheduled) {
      return res.status(404).json({
        success: false,
        message: "Scheduled interview not found.",
      });
    }

    if (scheduled.institutionId !== institutionId) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Cross-institution interview deletion denied.",
      });
    }

    // Trainers can only delete interviews they scheduled; Admins can delete any in their institution
    if (userRole === "trainer" && String(scheduled.trainerId) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Trainers can only delete interviews they scheduled.",
      });
    }

    await ScheduledInterview.findByIdAndDelete(id);

    // Asynchronously log to auth service AuditLog
    const authServiceUrl = process.env.AUTH_SERVICE_URL || "http://localhost:8001";
    const internalSecret = process.env.INTERNAL_SERVICE_SECRET || "";
    fetch(`${authServiceUrl}/internal/audit-logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-service-key": internalSecret,
      },
      body: JSON.stringify({
        institutionId,
        actorId: userId,
        actorRole: userRole,
        action: "SCHEDULED_INTERVIEW_DELETED",
        details: {
          scheduledInterviewId: id,
          studentId: scheduled.studentId,
          studentName: scheduled.studentName,
          role: scheduled.role,
          mode: scheduled.mode,
          scheduledAt: scheduled.scheduledAt,
          deletedAt: new Date(),
        },
      }),
    }).catch((auditErr) => {
      console.error("Failed to log SCHEDULED_INTERVIEW_DELETED to audit log:", auditErr.message);
    });

    return res.status(200).json({
      success: true,
      message: "Scheduled interview removed successfully.",
      deletedId: id,
    });
  } catch (error) {
    console.error("deleteScheduledInterview error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
