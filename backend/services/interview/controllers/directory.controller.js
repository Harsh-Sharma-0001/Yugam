import xlsx from "xlsx";
import Interview from "../models/interview.model.js";
import LiveInterview from "../models/liveInterview.model.js";
import ScheduledInterview from "../models/scheduledInterview.model.js";
import { generateCsvString, sanitizeFormula } from "../utils/exportSanitizer.js";

/**
 * Helper to fetch students from auth service and aggregate with MongoDB interview metrics.
 */
export const fetchAggregatedStudents = async (institutionId, queryParams = {}) => {
  const authServiceUrl = process.env.AUTH_SERVICE_URL || "http://localhost:8001";
  const internalSecret = process.env.INTERNAL_SERVICE_SECRET || "";

  let rawStudents = [];
  try {
    const res = await fetch(
      `${authServiceUrl}/internal/institution/students?institutionId=${encodeURIComponent(
        institutionId
      )}`,
      {
        headers: {
          "x-internal-service-key": internalSecret,
        },
      }
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.success && Array.isArray(data.students)) {
        rawStudents = data.students;
      }
    } else {
      console.error("fetchAggregatedStudents: auth service responded with status", res.status);
    }
  } catch (err) {
    console.error("fetchAggregatedStudents: error contacting auth service:", err.message);
  }

  if (rawStudents.length === 0) {
    return [];
  }

  const studentIds = rawStudents.map((s) => s._id);

  // Fetch only completed interviews across AI and Live collections
  const [completedAiInterviews, completedLiveInterviews, pendingScheduled] = await Promise.all([
    Interview.find({
      userId: { $in: studentIds },
      status: "completed",
    })
      .select("userId overallScore mode createdAt type role")
      .lean(),
    LiveInterview.find({
      studentId: { $in: studentIds },
      status: "completed",
    })
      .select("studentId evaluation createdAt role interviewType")
      .lean(),
    ScheduledInterview.find({
      institutionId,
      studentId: { $in: studentIds },
      status: "scheduled",
    })
      .select("studentId mode scheduledAt role")
      .lean(),
  ]);

  const liveFormatted = completedLiveInterviews.map((l) => ({
    userId: l.studentId,
    overallScore: l.evaluation?.overallScore ?? 0,
    mode: "live",
    createdAt: l.createdAt,
    type: l.interviewType || "technical",
    role: l.role,
  }));

  const allCompletedInterviews = [...completedAiInterviews, ...liveFormatted];

  // Group interviews by studentId
  const interviewMap = new Map();
  allCompletedInterviews.forEach((interview) => {
    const sid = String(interview.userId);
    if (!interviewMap.has(sid)) {
      interviewMap.set(sid, []);
    }
    interviewMap.get(sid).push(interview);
  });

  // Group scheduled by studentId
  const scheduledMap = new Map();
  pendingScheduled.forEach((sched) => {
    const sid = String(sched.studentId);
    if (!scheduledMap.has(sid)) {
      scheduledMap.set(sid, []);
    }
    scheduledMap.get(sid).push(sched);
  });

  // Aggregate metrics per student
  let aggregated = rawStudents.map((student) => {
    const sid = String(student._id);
    const studentInterviews = interviewMap.get(sid) || [];
    const studentScheduled = scheduledMap.get(sid) || [];

    const aiInterviews = studentInterviews.filter((i) => i.mode !== "live");
    const liveInterviews = studentInterviews.filter((i) => i.mode === "live");

    const overallScores = studentInterviews
      .map((i) => i.overallScore)
      .filter((s) => typeof s === "number" && !isNaN(s));

    const aiScores = aiInterviews
      .map((i) => i.overallScore)
      .filter((s) => typeof s === "number" && !isNaN(s));

    const liveScores = liveInterviews
      .map((i) => i.overallScore)
      .filter((s) => typeof s === "number" && !isNaN(s));

    const overallAvgScore =
      overallScores.length > 0
        ? Number((overallScores.reduce((a, b) => a + b, 0) / overallScores.length).toFixed(1))
        : null;

    const aiAvgScore =
      aiScores.length > 0
        ? Number((aiScores.reduce((a, b) => a + b, 0) / aiScores.length).toFixed(1))
        : null;

    const liveAvgScore =
      liveScores.length > 0
        ? Number((liveScores.reduce((a, b) => a + b, 0) / liveScores.length).toFixed(1))
        : null;

    const currentCGPA =
      student.profile?.currentCGPA !== undefined && student.profile?.currentCGPA !== null
        ? Number(student.profile.currentCGPA)
        : null;

    return {
      _id: student._id,
      name: student.name || "Student",
      email: student.email || "",
      status: student.status || "active",
      institutionId: student.institutionId || institutionId,
      profile: student.profile || {},
      overallAvgScore,
      aiAvgScore,
      liveAvgScore,
      aiCompletedCount: aiInterviews.length,
      liveCompletedCount: liveInterviews.length,
      totalCompleted: studentInterviews.length,
      pendingScheduledCount: studentScheduled.length,
      recentInterviews: studentInterviews.slice(-3),
    };
  });

  // Apply Search Filter (Name or Roll Number)
  if (queryParams.search) {
    const searchLower = String(queryParams.search).toLowerCase().trim();
    aggregated = aggregated.filter((s) => {
      const nameMatch = s.name?.toLowerCase().includes(searchLower);
      const rollMatch = s.profile?.rollNumber?.toLowerCase().includes(searchLower);
      return Boolean(nameMatch || rollMatch);
    });
  }

  // Apply Section Filter
  if (queryParams.section && queryParams.section !== "all") {
    const targetSection = String(queryParams.section).toLowerCase().trim();
    aggregated = aggregated.filter(
      (s) => s.profile?.section?.toLowerCase().trim() === targetSection
    );
  }

  // Apply Course Filter
  if (queryParams.course && queryParams.course !== "all") {
    const targetCourse = String(queryParams.course).toLowerCase().trim();
    aggregated = aggregated.filter(
      (s) => s.profile?.course?.toLowerCase().trim() === targetCourse
    );
  }

  // Apply Semester Filter
  if (queryParams.semester && queryParams.semester !== "all") {
    const targetSem = Number(queryParams.semester);
    if (!isNaN(targetSem)) {
      aggregated = aggregated.filter((s) => s.profile?.semester === targetSem);
    }
  }

  // Apply Academic Verification Status Filter
  if (queryParams.academicStatus && queryParams.academicStatus !== "all") {
    aggregated = aggregated.filter(
      (s) => s.profile?.academicVerificationStatus === queryParams.academicStatus
    );
  }

  // Apply Min/Max Score Filter (Overall Avg Interview Score)
  if (queryParams.minScore !== undefined && queryParams.minScore !== "") {
    const minS = Number(queryParams.minScore);
    if (!isNaN(minS)) {
      aggregated = aggregated.filter((s) => s.overallAvgScore !== null && s.overallAvgScore >= minS);
    }
  }
  if (queryParams.maxScore !== undefined && queryParams.maxScore !== "") {
    const maxS = Number(queryParams.maxScore);
    if (!isNaN(maxS)) {
      aggregated = aggregated.filter((s) => s.overallAvgScore !== null && s.overallAvgScore <= maxS);
    }
  }

  // Apply Min/Max CGPA Filter
  if (queryParams.minCgpa !== undefined && queryParams.minCgpa !== "") {
    const minC = Number(queryParams.minCgpa);
    if (!isNaN(minC)) {
      aggregated = aggregated.filter(
        (s) => s.profile?.currentCGPA !== undefined && s.profile.currentCGPA >= minC
      );
    }
  }
  if (queryParams.maxCgpa !== undefined && queryParams.maxCgpa !== "") {
    const maxC = Number(queryParams.maxCgpa);
    if (!isNaN(maxC)) {
      aggregated = aggregated.filter(
        (s) => s.profile?.currentCGPA !== undefined && s.profile.currentCGPA <= maxC
      );
    }
  }

  // Sorting
  const sortBy = queryParams.sortBy || "overallAvgScore";
  const sortOrder = queryParams.sortOrder === "asc" ? 1 : -1;

  aggregated.sort((a, b) => {
    let valA;
    let valB;

    switch (sortBy) {
      case "name":
        valA = a.name?.toLowerCase() || "";
        valB = b.name?.toLowerCase() || "";
        return sortOrder * valA.localeCompare(valB);

      case "rollNumber":
        valA = a.profile?.rollNumber?.toLowerCase() || "";
        valB = b.profile?.rollNumber?.toLowerCase() || "";
        return sortOrder * valA.localeCompare(valB);

      case "currentCGPA":
        valA = a.profile?.currentCGPA ?? -1;
        valB = b.profile?.currentCGPA ?? -1;
        return sortOrder * (valA - valB);

      case "overallAvgScore":
      default:
        valA = a.overallAvgScore ?? -1;
        valB = b.overallAvgScore ?? -1;
        return sortOrder * (valA - valB);
    }
  });

  return aggregated;
};

/**
 * GET /api/interview/students-directory
 * Allowed: trainer, admin
 */
export const getStudentsDirectory = async (req, res) => {
  try {
    const institutionId = req.institutionId || "DEFAULT_COLLEGE";
    const allStudents = await fetchAggregatedStudents(institutionId, req.query);

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 20));

    const startIndex = (page - 1) * limit;
    const paginatedStudents = allStudents.slice(startIndex, startIndex + limit);

    // Extract dynamic available sections and courses for filter dropdowns
    const availableSections = Array.from(
      new Set(
        allStudents
          .map((s) => s.profile?.section?.trim())
          .filter(Boolean)
      )
    ).sort();

    const availableCourses = Array.from(
      new Set(
        allStudents
          .map((s) => s.profile?.course?.trim())
          .filter(Boolean)
      )
    ).sort();

    return res.status(200).json({
      success: true,
      count: allStudents.length,
      totalPages: Math.ceil(allStudents.length / limit) || 1,
      currentPage: page,
      limit,
      availableSections,
      availableCourses,
      students: paginatedStudents,
    });
  } catch (error) {
    console.error("getStudentsDirectory error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/interview/students-directory/export
 * Allowed: trainer, admin
 * Supports format=xlsx and format=csv (Full dataset matching filters)
 */
export const exportStudentsDirectory = async (req, res) => {
  try {
    const institutionId = req.institutionId || "DEFAULT_COLLEGE";
    const format = (req.query.format || "csv").toLowerCase().trim();

    // Fetch the complete filtered dataset (ignoring page/limit)
    const exportQuery = { ...req.query };
    delete exportQuery.page;
    delete exportQuery.limit;

    const allMatchingStudents = await fetchAggregatedStudents(institutionId, exportQuery);

    const headers = [
      "Roll Number",
      "Student Name",
      "Email",
      "Course",
      "Year",
      "Semester",
      "Section",
      "Verification Status",
      "Class 10th (%)",
      "Class 12th (%)",
      "Current B.Tech CGPA",
      "Overall Avg Interview Score",
      "AI Interview Avg",
      "Live Interview Avg",
      "Completed Interviews",
    ];

    const dataRows = allMatchingStudents.map((s) => [
      sanitizeFormula(s.profile?.rollNumber || "N/A"),
      sanitizeFormula(s.name || "N/A"),
      sanitizeFormula(s.email || "N/A"),
      sanitizeFormula(s.profile?.course || "N/A"),
      s.profile?.year !== undefined ? s.profile.year : "N/A",
      s.profile?.semester !== undefined ? s.profile.semester : "N/A",
      sanitizeFormula(s.profile?.section || "N/A"),
      sanitizeFormula(s.profile?.academicVerificationStatus || "unsubmitted"),
      s.profile?.academics?.tenthPercentage !== undefined
        ? `${s.profile.academics.tenthPercentage}%`
        : "N/A",
      s.profile?.academics?.twelfthPercentage !== undefined
        ? `${s.profile.academics.twelfthPercentage}%`
        : "N/A",
      s.profile?.currentCGPA !== undefined ? `${s.profile.currentCGPA} / 10` : "N/A",
      s.overallAvgScore !== null ? `${s.overallAvgScore} / 100` : "N/A",
      s.aiAvgScore !== null ? `${s.aiAvgScore} / 100` : "N/A",
      s.liveAvgScore !== null ? `${s.liveAvgScore} / 100` : "N/A",
      s.totalCompleted,
    ]);

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
        actorId: req.userId,
        actorRole: req.userRole || "trainer",
        action: "REPORT_EXPORTED",
        details: {
          format,
          filters: exportQuery,
          rowCount: allMatchingStudents.length,
          exportedAt: new Date(),
        },
      }),
    }).catch((auditErr) => {
      console.error("Failed to log REPORT_EXPORTED to audit log:", auditErr.message);
    });

    if (format === "xlsx") {
      const aoa = [headers, ...dataRows];
      const wb = xlsx.utils.book_new();
      const ws = xlsx.utils.aoa_to_sheet(aoa);

      // Auto-compute column widths
      const colWidths = headers.map((h, i) => {
        let maxLen = h.length;
        dataRows.forEach((r) => {
          const cellStr = String(r[i] ?? "");
          if (cellStr.length > maxLen) maxLen = cellStr.length;
        });
        return { wch: Math.min(Math.max(maxLen + 3, 12), 40) };
      });
      ws["!cols"] = colWidths;

      xlsx.utils.book_append_sheet(wb, ws, "Student Performance");

      const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="Yugam_Student_Report.xlsx"'
      );
      return res.status(200).send(buffer);
    }

    // Default CSV
    const csvContent = generateCsvString([headers, ...dataRows]);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="Yugam_Student_Report.csv"'
    );
    return res.status(200).send(csvContent);
  } catch (error) {
    console.error("exportStudentsDirectory error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
