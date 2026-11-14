import Task from "../models/task.model.js";
import TaskSubmission from "../models/taskSubmission.model.js";

/**
 * POST /api/interview/tasks
 * Allowed: admin, trainer
 */
export const createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      targetType = "ALL_STUDENTS",
      targetSection,
      assignedTo = [],
      dueDate,
      priority = "medium",
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: "Task title is required." });
    }

    const task = await Task.create({
      institutionId: req.institutionId || "DEFAULT_COLLEGE",
      title: title.trim(),
      description: (description || "").trim(),
      targetType,
      targetSection: targetSection ? targetSection.trim() : "",
      assignedTo: Array.isArray(assignedTo) ? assignedTo : [],
      assignedBy: req.userId,
      assignedByName: req.userName || req.body.assignedByName || "Instructor",
      assignedByRole: req.userRole || "trainer",
      dueDate: dueDate ? new Date(dueDate) : null,
      priority,
    });

    return res.status(201).json({
      success: true,
      message: "Task created and assigned successfully.",
      task,
    });
  } catch (error) {
    console.error("createTask error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/interview/tasks
 * Allowed: student, trainer, admin
 */
export const getTasks = async (req, res) => {
  try {
    const institutionId = req.institutionId || "DEFAULT_COLLEGE";
    const userRole = req.userRole || "student";
    const userId = req.userId;

    if (userRole === "student") {
      const studentSection = req.userSection || req.query.section || "";

      const query = {
        institutionId,
        $or: [
          { targetType: "ALL_STUDENTS" },
          { targetType: "SECTION", targetSection: studentSection },
          { assignedTo: userId },
        ],
      };

      const tasks = await Task.find(query).sort({ createdAt: -1 }).lean();
      const taskIds = tasks.map((t) => t._id);

      const submissions = await TaskSubmission.find({
        taskId: { $in: taskIds },
        studentId: userId,
      }).lean();

      const submissionMap = new Map();
      submissions.forEach((sub) => {
        submissionMap.set(String(sub.taskId), sub);
      });

      const enrichedTasks = tasks.map((task) => ({
        ...task,
        submission: submissionMap.get(String(task._id)) || null,
        isSubmitted: submissionMap.has(String(task._id)),
      }));

      return res.status(200).json({
        success: true,
        count: enrichedTasks.length,
        tasks: enrichedTasks,
      });
    }

    // For trainer and admin: list all institution tasks with submission analytics
    const tasks = await Task.find({ institutionId }).sort({ createdAt: -1 }).lean();
    const taskIds = tasks.map((t) => t._id);

    const submissionStats = await TaskSubmission.aggregate([
      { $match: { taskId: { $in: taskIds } } },
      {
        $group: {
          _id: "$taskId",
          totalSubmissions: { $sum: 1 },
          reviewedSubmissions: {
            $sum: { $cond: [{ $eq: ["$status", "reviewed"] }, 1, 0] },
          },
        },
      },
    ]);

    const statsMap = new Map();
    submissionStats.forEach((s) => {
      statsMap.set(String(s._id), s);
    });

    const enrichedTasks = tasks.map((task) => {
      const stats = statsMap.get(String(task._id)) || { totalSubmissions: 0, reviewedSubmissions: 0 };
      return {
        ...task,
        submissionCount: stats.totalSubmissions,
        reviewedCount: stats.reviewedSubmissions,
      };
    });

    return res.status(200).json({
      success: true,
      count: enrichedTasks.length,
      tasks: enrichedTasks,
    });
  } catch (error) {
    console.error("getTasks error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/interview/tasks/:taskId/submit
 * Allowed: student only
 */
export const submitTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { submissionText, submissionLink, studentRollNumber } = req.body;

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found." });
    }

    if (req.institutionId && task.institutionId !== req.institutionId) {
      return res.status(403).json({ success: false, message: "Forbidden: Task belongs to a different institution." });
    }

    const submission = await TaskSubmission.findOneAndUpdate(
      { taskId, studentId: req.userId },
      {
        taskId,
        studentId: req.userId,
        studentName: req.userName || req.body.studentName || "Student",
        studentRollNumber: studentRollNumber || "",
        submissionText: (submissionText || "").trim(),
        submissionLink: (submissionLink || "").trim(),
        status: "submitted",
        submittedAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({
      success: true,
      message: "Task submission recorded successfully.",
      submission,
    });
  } catch (error) {
    console.error("submitTask error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/interview/tasks/:taskId/submissions
 * Allowed: trainer, admin
 */
export const getTaskSubmissions = async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found." });
    }

    if (req.institutionId && task.institutionId !== req.institutionId) {
      return res.status(403).json({ success: false, message: "Forbidden: Cross-institution access denied." });
    }

    const submissions = await TaskSubmission.find({ taskId }).sort({ submittedAt: -1 });

    return res.status(200).json({
      success: true,
      count: submissions.length,
      submissions,
    });
  } catch (error) {
    console.error("getTaskSubmissions error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PATCH /api/interview/tasks/:taskId/submissions/:submissionId
 * Allowed: trainer, admin
 */
export const reviewSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { trainerRemarks, score } = req.body;

    const submission = await TaskSubmission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ success: false, message: "Submission not found." });
    }

    if (trainerRemarks !== undefined) submission.trainerRemarks = trainerRemarks;
    if (score !== undefined) submission.score = Number(score);
    submission.status = "reviewed";

    await submission.save();

    return res.status(200).json({
      success: true,
      message: "Submission evaluated successfully.",
      submission,
    });
  } catch (error) {
    console.error("reviewSubmission error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
