import React, { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import Statbox from "../components/Statbox";
import InterviewGraph from "../components/InterviewGraph";
import InterviewArchive from "../components/interview/InterviewArchive";
import InterviewDetailView from "../components/interview/InterviewDetailView";
import EditProfileModal from "../components/EditProfileModal";
import StudentDirectory from "../components/StudentDirectory";
import ScheduleInterviewModal from "../components/ScheduleInterviewModal";
import {
  getAllInterviews,
  getScheduledInterviews,
} from "../apis/interview.api";
import {
  getCurrentUser,
  getTasks,
  createTask,
  submitTask,
  getTaskSubmissions,
  reviewSubmission,
  getInstitutionUsers,
  getPendingVerifications,
  verifyStudentAcademics,
  updateUserRole,
  provisionUsers,
} from "../apis/user.api";
import {
  FiClock,
  FiArrowLeft,
  FiArrowRight,
  FiSidebar,
  FiEdit2,
  FiCheckCircle,
  FiXCircle,
  FiAlertCircle,
  FiPlus,
  FiSearch,
  FiSend,
  FiUsers,
  FiCheckSquare,
  FiShield,
  FiUploadCloud,
  FiLayers,
  FiGrid,
  FiExternalLink,
  FiCalendar,
  FiPlay,
} from "react-icons/fi";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../utils/axios";

function Dashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [moblieOpen, setMoblieOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);

  // Workspace View State: "overview" | "history" | "detail"
  const [activeView, setActiveView] = useState("overview");
  const [selectedInterviewId, setSelectedInterviewId] = useState(null);

  // Active Tab inside Dashboard ("overview" | "tasks" | "students" | "trainers" | "governance")
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "overview");

  // Interview Stats & History
  const [stats, setStats] = useState({
    totalInterviews: 0,
    totalQuestions: 0,
    completed: 0,
    averageScore: 0,
  });
  const [interviews, setInterviews] = useState([]);
  const [technicalData, setTechnicalData] = useState([]);
  const [hrData, setHrData] = useState([]);
  const [technicalCount, setTechnicalCount] = useState(0);
  const [hrCount, setHrCount] = useState(0);

  // Institutional Data States
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [submitModalTask, setSubmitModalTask] = useState(null);
  const [reviewTaskSubmissions, setReviewTaskSubmissions] = useState(null);

  // Scheduling State
  const [scheduledInterviews, setScheduledInterviews] = useState([]);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedStudentForSchedule, setSelectedStudentForSchedule] = useState(null);

  // Directory & Governance Data
  const [students, setStudents] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [pendingVerifications, setPendingVerifications] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [governanceLoading, setGovernanceLoading] = useState(false);
  const [provisionModalOpen, setProvisionModalOpen] = useState(false);

  // Task Form State
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    targetType: "ALL_STUDENTS",
    targetSection: "",
    dueDate: "",
    priority: "medium",
  });

  // Task Submission State
  const [submissionForm, setSubmissionForm] = useState({
    submissionText: "",
    submissionLink: "",
  });

  // Provisioning Form State
  const [provisionInput, setProvisionInput] = useState("");

  const role = user?.role || "student";

  // Load User Data
  const fetchUser = async () => {
    try {
      const data = await getCurrentUser();
      if (data?.user) {
        setUser(data.user);
      }
    } catch (e) {
      console.error("Dashboard fetchUser error:", e);
    }
  };

  // Load Interviews Data
  const fetchInterviews = async () => {
    try {
      const response = await getAllInterviews();
      if (response) {
        if (response.stats) {
          setStats(response.stats);
          setTechnicalData(response.technicalData || []);
          setHrData(response.hrData || []);
          setTechnicalCount(response.technicalCount || 0);
          setHrCount(response.hrCount || 0);
        }
        if (response.interviews) {
          setInterviews(response.interviews);
        }
      }
    } catch (err) {
      console.error("Dashboard fetchInterviews error:", err);
    }
  };

  // Load Tasks
  const fetchTasksList = async () => {
    setLoadingTasks(true);
    try {
      const res = await getTasks();
      if (res?.success) {
        setTasks(res.tasks || []);
      }
    } catch (e) {
      console.error("fetchTasksList error:", e);
    } finally {
      setLoadingTasks(false);
    }
  };

  // Load Scheduled Interviews
  const fetchScheduledList = async () => {
    try {
      const res = await getScheduledInterviews();
      if (res?.scheduledInterviews) {
        setScheduledInterviews(res.scheduledInterviews);
      }
    } catch (e) {
      console.error("fetchScheduledList error:", e);
    }
  };

  // Load Institution Directory & Pending Verifications (For Admin & Trainer)
  const fetchInstitutionalData = async () => {
    if (role !== "admin" && role !== "trainer") return;
    setGovernanceLoading(true);
    try {
      const [studentsRes, trainersRes, pendingRes] = await Promise.all([
        getInstitutionUsers({ role: "student" }),
        role === "admin" ? getInstitutionUsers({ role: "trainer" }) : Promise.resolve({ users: [] }),
        getPendingVerifications(),
      ]);

      if (studentsRes?.users) setStudents(studentsRes.users);
      if (trainersRes?.users) setTrainers(trainersRes.users);
      if (pendingRes?.students) setPendingVerifications(pendingRes.students);
    } catch (e) {
      console.error("fetchInstitutionalData error:", e);
    } finally {
      setGovernanceLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
    fetchInterviews();
    fetchTasksList();
    fetchScheduledList();
  }, []);

  useEffect(() => {
    if (user?.role === "admin" || user?.role === "trainer") {
      fetchInstitutionalData();
    }
  }, [user]);

  const handleLogout = async () => {
    try {
      const response = await api.get("/api/auth/logout");
      if (response.data?.success) {
        setUser(null);
        navigate("/");
      }
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleSelectInterview = (id) => {
    setSelectedInterviewId(id);
    setActiveView("detail");
  };

  // Task Creation Handler
  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      const res = await createTask(taskForm);
      if (res?.success) {
        setTaskModalOpen(false);
        setTaskForm({
          title: "",
          description: "",
          targetType: "ALL_STUDENTS",
          targetSection: "",
          dueDate: "",
          priority: "medium",
        });
        fetchTasksList();
      }
    } catch (e) {
      alert(e.response?.data?.message || "Failed to create task");
    }
  };

  // Task Submission Handler
  const handleSubmitTask = async (e) => {
    e.preventDefault();
    if (!submitModalTask) return;
    try {
      const res = await submitTask(submitModalTask._id, {
        ...submissionForm,
        studentRollNumber: user?.profile?.rollNumber || "",
      });
      if (res?.success) {
        setSubmitModalTask(null);
        setSubmissionForm({ submissionText: "", submissionLink: "" });
        fetchTasksList();
      }
    } catch (e) {
      alert(e.response?.data?.message || "Failed to submit task");
    }
  };

  // Academic Verification Handler
  const handleVerifyStudent = async (studentId, status) => {
    try {
      const res = await verifyStudentAcademics(studentId, { status });
      if (res?.success) {
        fetchInstitutionalData();
      }
    } catch (e) {
      alert(e.response?.data?.message || "Action failed");
    }
  };

  // User Role Promotion/Demotion Handler (Admin Only)
  const handleRoleChange = async (targetUserId, newRole) => {
    try {
      const res = await updateUserRole(targetUserId, { role: newRole });
      if (res?.success) {
        fetchInstitutionalData();
      }
    } catch (e) {
      alert(e.response?.data?.message || "Role change rejected");
    }
  };

  // Bulk Provisioning Handler
  const handleProvisionSubmit = async (e) => {
    e.preventDefault();
    try {
      let usersArray = [];
      try {
        usersArray = JSON.parse(provisionInput);
      } catch {
        const lines = provisionInput.trim().split("\n");
        usersArray = lines.map((line) => {
          const parts = line.split(",").map((p) => p.trim());
          return {
            email: parts[0],
            name: parts[1],
            role: parts[2] || "student",
            rollNumber: parts[3],
            section: parts[4],
            course: parts[5],
            currentCGPA: parts[6] ? Number(parts[6]) : undefined,
          };
        });
      }

      const res = await provisionUsers({ users: usersArray });
      if (res?.success) {
        alert(`Successfully provisioned ${res.count} users!`);
        setProvisionModalOpen(false);
        setProvisionInput("");
        fetchInstitutionalData();
      }
    } catch (e) {
      alert(e.response?.data?.message || "Bulk import failed. Please verify format.");
    }
  };

  return (
    <div className="bg-white min-h-screen text-[#0A0A0A] font-sans flex">
      {/* Sidebar with Role awareness */}
      <Sidebar
        user={user}
        onNewInterview={() => navigate("/interview")}
        onLogout={handleLogout}
        onOpenEditProfile={() => setEditProfileOpen(true)}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setActiveView("overview");
        }}
        activeTab={activeTab}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        moblieOpen={moblieOpen}
        setMoblieOpen={setMoblieOpen}
      />

      <motion.main
        className={`flex-1 min-h-screen px-3 sm:px-4 md:px-6 py-4 md:py-6 transition-all duration-300 ${
          sidebarOpen ? "md:ml-[260px]" : "md:ml-[72px]"
        }`}
      >
        {/* Top Header Area */}
        <div className="flex items-center justify-between mb-5 md:mb-6">
          <div className="flex items-center gap-2.5">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setMoblieOpen(true)}
              className="md:hidden text-black/40 hover:text-[#0A0A0A] transition-colors p-1"
            >
              <FiSidebar size={18} />
            </motion.button>

            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {activeView === "overview" && (
                <>
                  <div className="flex items-center gap-2">
                    <p className="text-black/40 text-[11px] md:text-xs font-semibold uppercase tracking-wider">
                      {role} Workspace • {user?.institutionId || "College Portal"}
                    </p>
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                        role === "admin"
                          ? "bg-emerald-500/15 text-emerald-700 border border-emerald-500/30"
                          : role === "trainer"
                          ? "bg-purple-500/15 text-purple-700 border border-purple-500/30"
                          : "bg-blue-500/15 text-blue-700 border border-blue-500/30"
                      }`}
                    >
                      {role}
                    </span>
                  </div>
                  <h2 className="text-lg md:text-2xl font-black text-[#0A0A0A] tracking-tight">
                    Welcome back, {user?.name?.split(" ")[0]} 👋
                  </h2>
                </>
              )}

              {activeView === "history" && (
                <>
                  <p className="text-black/40 text-[11px] md:text-xs font-medium mb-0.5">
                    Workspace Archive
                  </p>
                  <h2 className="text-lg md:text-xl font-bold text-[#0A0A0A]">
                    Interview History 📂
                  </h2>
                </>
              )}

              {activeView === "detail" && (
                <>
                  <p className="text-black/40 text-[11px] md:text-xs font-medium mb-0.5">
                    Session Explorer
                  </p>
                  <h2 className="text-lg md:text-xl font-bold text-[#0A0A0A]">
                    Interview Transcript & Report 📝
                  </h2>
                </>
              )}
            </motion.div>
          </div>

          {/* Top-Right Header Actions */}
          <div className="flex items-center gap-2">
            {(role === "admin" || role === "trainer") && (
              <button
                onClick={() => {
                  setSelectedStudentForSchedule(null);
                  setScheduleModalOpen(true);
                }}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black text-white text-xs font-semibold hover:bg-zinc-800 transition shadow-sm"
              >
                <FiCalendar size={13} />
                <span>Schedule Interview</span>
              </button>
            )}

            <button
              onClick={() => setEditProfileOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold transition border border-black/5"
            >
              <FiEdit2 size={13} />
              <span>Edit Profile</span>
            </button>

            {activeView === "overview" && (
              <button
                onClick={() => setActiveView("history")}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-black text-white text-xs font-semibold hover:bg-zinc-800 transition shadow-sm border border-black/10"
              >
                <FiClock size={14} className="text-zinc-400" />
                <span className="hidden sm:inline">Interview History</span>
                <span className="sm:hidden">History</span>
                <span className="ml-0.5 px-2 py-0.5 rounded-full bg-white/20 text-[11px] font-bold">
                  {interviews.length}
                </span>
              </button>
            )}

            {activeView === "history" && (
              <button
                onClick={() => setActiveView("overview")}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold transition border border-black/5 shadow-sm"
              >
                <FiArrowLeft size={14} />
                <span>Back to Overview</span>
              </button>
            )}

            {activeView === "detail" && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveView("history")}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold transition border border-black/5 shadow-sm"
                >
                  <FiArrowLeft size={13} />
                  <span>Back to History</span>
                </button>
                <button
                  onClick={() => setActiveView("overview")}
                  className="px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-medium transition border border-black/5"
                >
                  Overview
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Workspace Body: Dynamic View Switching */}
        <AnimatePresence mode="wait">
          {activeView === "overview" && (
            <motion.div
              key="overview-wrapper"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              {/* Tab Navigation Bar for Trainer / Admin / Student */}
              <div className="flex items-center gap-1 sm:gap-2 border-b border-black/8 pb-3 overflow-x-auto">
                <button
                  onClick={() => setActiveTab("overview")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                    activeTab === "overview"
                      ? "bg-black text-white shadow-sm"
                      : "text-zinc-600 hover:text-black hover:bg-zinc-100"
                  }`}
                >
                  <FiGrid className="inline mr-1.5" size={13} />
                  Overview
                </button>

                <button
                  onClick={() => setActiveTab("tasks")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                    activeTab === "tasks"
                      ? "bg-black text-white shadow-sm"
                      : "text-zinc-600 hover:text-black hover:bg-zinc-100"
                  }`}
                >
                  <FiCheckSquare className="inline mr-1.5" size={13} />
                  Tasks & Deadlines ({tasks.length})
                </button>

                {(role === "admin" || role === "trainer") && (
                  <button
                    onClick={() => setActiveTab("students")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                      activeTab === "students"
                        ? "bg-black text-white shadow-sm"
                        : "text-zinc-600 hover:text-black hover:bg-zinc-100"
                    }`}
                  >
                    <FiUsers className="inline mr-1.5" size={13} />
                    Students Directory
                  </button>
                )}

                {role === "admin" && (
                  <>
                    <button
                      onClick={() => setActiveTab("trainers")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                        activeTab === "trainers"
                          ? "bg-black text-white shadow-sm"
                          : "text-zinc-600 hover:text-black hover:bg-zinc-100"
                      }`}
                    >
                      <FiLayers className="inline mr-1.5" size={13} />
                      Trainers Directory ({trainers.length})
                    </button>

                    <button
                      onClick={() => setActiveTab("governance")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                        activeTab === "governance"
                          ? "bg-black text-white shadow-sm"
                          : "text-zinc-600 hover:text-black hover:bg-zinc-100"
                      }`}
                    >
                      <FiShield className="inline mr-1.5" size={13} />
                      Permissions & Academic Verification ({pendingVerifications.length} Pending)
                    </button>
                  </>
                )}
              </div>

              {/* TAB 1: OVERVIEW */}
              {activeTab === "overview" && (
                <div className="space-y-6">
                  {/* Upcoming Scheduled Interviews Strip for Students */}
                  {role === "student" && scheduledInterviews.length > 0 && (
                    <div className="bg-[#0E1016] border border-white/10 rounded-2xl p-5 text-white shadow-xl">
                      <div className="flex items-center justify-between mb-3.5">
                        <div className="flex items-center gap-2">
                          <FiCalendar className="text-blue-400" size={17} />
                          <h4 className="text-sm font-bold text-white">
                            Upcoming Scheduled Interviews
                          </h4>
                        </div>
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-bold border border-blue-500/30">
                          {scheduledInterviews.length} Scheduled
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {scheduledInterviews.map((item) => (
                          <div
                            key={item._id}
                            className="bg-[#17181E] border border-white/5 rounded-xl p-4 flex flex-col justify-between space-y-3"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span
                                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                                    item.mode === "ai"
                                      ? "bg-blue-500/20 text-blue-400"
                                      : "bg-purple-500/20 text-purple-400"
                                  }`}
                                >
                                  {item.mode === "ai"
                                    ? "AI Mock Interview"
                                    : "Live Trainer Interview"}
                                </span>
                                <h5 className="text-sm font-bold text-white mt-1.5">
                                  {item.role}
                                </h5>
                                <p className="text-xs text-zinc-400">
                                  Scheduled by: {item.trainerName}
                                </p>
                              </div>

                              <div className="text-right">
                                <span className="text-xs text-zinc-300 block font-semibold">
                                  {new Date(item.scheduledAt).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                                <span className="text-[10px] text-zinc-500">
                                  {item.durationMinutes} Mins
                                </span>
                              </div>
                            </div>

                            {item.instructions && (
                              <p className="text-xs text-zinc-400 bg-black/40 p-2.5 rounded-lg border border-white/5 line-clamp-2">
                                Note: {item.instructions}
                              </p>
                            )}

                            <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                              <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                <span>Free / College Sponsored</span>
                              </span>

                              {item.mode === "ai" ? (
                                <button
                                  onClick={() => navigate("/interview")}
                                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition inline-flex items-center gap-1.5 shadow-sm"
                                >
                                  <FiPlay size={11} />
                                  <span>Start AI Interview</span>
                                </button>
                              ) : (
                                <span className="text-xs font-bold text-purple-400">
                                  Video Link Provided by Trainer
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Statbox Metric Counters */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 md:gap-3">
                    <Statbox
                      label="Total Interviews"
                      value={stats?.totalInterviews}
                      subHighlight="All Time"
                      sub="Interviews Created"
                      index={0}
                    />

                    <Statbox
                      label="Questions Solved"
                      value={stats?.totalQuestions}
                      subHighlight="Answered"
                      sub="Across All Interviews"
                      index={1}
                    />

                    <Statbox
                      label="Completed"
                      value={stats?.completed}
                      subHighlight={`${stats?.totalInterviews || 0} Total`}
                      sub="Interviews Finished"
                      index={2}
                    />

                    <Statbox
                      label="Average Score"
                      value={`${Math.round(stats?.averageScore || 0)}/100`}
                      subHighlight="Completed Only"
                      sub="Average Performance"
                      index={3}
                    />
                  </div>

                  {/* Performance Radar Graph */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-3 md:mb-4">
                      <div>
                        <p className="text-black/40 text-[10px] font-semibold uppercase tracking-widest">
                          Performance
                        </p>
                        <h3 className="text-[#0A0A0A] font-bold text-sm md:text-base">
                          Skill Analytics & Benchmark Radar
                        </h3>
                      </div>

                      {interviews.length > 0 && (
                        <button
                          onClick={() => setActiveView("history")}
                          className="text-xs font-semibold text-black/60 hover:text-black flex items-center gap-1 transition"
                        >
                          <span>Explore Archive ({interviews.length})</span>
                          <FiArrowRight size={12} />
                        </button>
                      )}
                    </div>

                    <InterviewGraph
                      technicalData={technicalData}
                      technicalCount={technicalCount}
                      hrData={hrData}
                      hrCount={hrCount}
                    />
                  </div>

                  {/* Recent Sessions Teaser Strip */}
                  {interviews.length > 0 && (
                    <div className="pt-4 border-t border-black/8">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="text-sm font-bold text-[#0A0A0A]">
                            Recent Mock Interviews
                          </h4>
                          <p className="text-xs text-black/40">
                            Quickly reopen recent transcripts or resume active sessions.
                          </p>
                        </div>

                        <button
                          onClick={() => setActiveView("history")}
                          className="text-xs font-semibold text-black/70 hover:text-black flex items-center gap-1 transition"
                        >
                          <span>View All Sessions →</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {interviews.slice(0, 3).map((item, idx) => (
                          <div
                            key={item._id || idx}
                            onClick={() => handleSelectInterview(item._id)}
                            className="bg-[#0E1016] border border-white/10 hover:border-white/20 rounded-xl p-4 text-white cursor-pointer transition shadow-sm hover:shadow-md flex flex-col justify-between"
                          >
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span
                                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                                  item.type === "technical"
                                    ? "bg-blue-500/20 text-blue-400"
                                    : "bg-purple-500/20 text-purple-400"
                                }`}
                              >
                                {item.type}
                              </span>
                              <span
                                className={`text-[10px] font-semibold ${
                                  item.status === "completed"
                                    ? "text-emerald-400"
                                    : "text-amber-400"
                                }`}
                              >
                                {item.status === "completed"
                                  ? "Score: " + (item.overallScore || 0)
                                  : "In Progress"}
                              </span>
                            </div>
                            <h5 className="text-sm font-bold truncate text-white mb-1">
                              {item.role}
                            </h5>
                            <p className="text-[11px] text-zinc-400">
                              {item.createdAt
                                ? new Date(item.createdAt).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })
                                : "Recent"}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: TASKS & ASSIGNMENTS */}
              {activeTab === "tasks" && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-[#0A0A0A]">
                        Institutional Tasks & Assignments
                      </h3>
                      <p className="text-xs text-black/50">
                        {role === "student"
                          ? "Complete hands-on assignments and submit problem links for faculty review."
                          : "Create and assign curriculum tasks, code challenges, and interview preparation exercises."}
                      </p>
                    </div>

                    {(role === "admin" || role === "trainer") && (
                      <button
                        onClick={() => setTaskModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-black text-white text-xs font-semibold hover:bg-zinc-800 transition shadow-sm"
                      >
                        <FiPlus size={14} />
                        <span>Create New Task</span>
                      </button>
                    )}
                  </div>

                  {/* Tasks List */}
                  {tasks.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {tasks.map((task) => (
                        <div
                          key={task._id}
                          className="bg-[#0E1016] border border-white/10 rounded-2xl p-5 text-white flex flex-col justify-between shadow-lg group hover:border-white/20 transition"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-3">
                              <span
                                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                                  task.priority === "high"
                                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                    : task.priority === "medium"
                                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                    : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                }`}
                              >
                                {task.priority} Priority
                              </span>

                              <span className="text-[11px] text-zinc-400">
                                {task.targetType === "ALL_STUDENTS"
                                  ? "All Students"
                                  : task.targetSection || "Targeted"}
                              </span>
                            </div>

                            <h4 className="text-base font-bold text-white mb-1.5">
                              {task.title}
                            </h4>
                            <p className="text-xs text-zinc-400 line-clamp-3 mb-4 leading-relaxed">
                              {task.description || "No description provided."}
                            </p>
                          </div>

                          <div className="pt-3 border-t border-white/10">
                            <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-3">
                              <span>By: {task.assignedByName}</span>
                              {task.dueDate && (
                                <span>
                                  Due: {new Date(task.dueDate).toLocaleDateString()}
                                </span>
                              )}
                            </div>

                            {/* Role Actions */}
                            {role === "student" ? (
                              <div className="flex items-center justify-between">
                                {task.isSubmitted ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
                                    <FiCheckCircle size={13} />
                                    <span>
                                      {task.submission?.status === "reviewed"
                                        ? `Reviewed (${task.submission.score}/100)`
                                        : "Submitted"}
                                    </span>
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => setSubmitModalTask(task)}
                                    className="px-3.5 py-1.5 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-bold transition inline-flex items-center gap-1.5"
                                  >
                                    <FiSend size={12} />
                                    <span>Submit Solution</span>
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-zinc-300">
                                  {task.submissionCount || 0} Submissions
                                </span>
                                <button
                                  onClick={async () => {
                                    const res = await getTaskSubmissions(task._id);
                                    if (res?.submissions) {
                                      setReviewTaskSubmissions({
                                        task,
                                        submissions: res.submissions,
                                      });
                                    }
                                  }}
                                  className="text-xs font-bold text-blue-400 hover:text-blue-300 transition"
                                >
                                  View Submissions →
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-[#0E1016] border border-white/10 rounded-2xl p-10 text-center shadow-lg text-white">
                      <FiCheckSquare size={32} className="mx-auto text-zinc-500 mb-3" />
                      <h4 className="text-base font-bold mb-1">No Active Tasks</h4>
                      <p className="text-xs text-zinc-400">
                        There are currently no tasks assigned to your section or department.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: FULL-WIDTH EXPANDABLE STUDENT PERFORMANCE DIRECTORY */}
              {activeTab === "students" && (role === "admin" || role === "trainer") && (
                <StudentDirectory
                  onScheduleStudent={(student) => {
                    setSelectedStudentForSchedule(student);
                    setScheduleModalOpen(true);
                  }}
                />
              )}

              {/* TAB 4: TRAINERS DIRECTORY (Admin Only) */}
              {activeTab === "trainers" && role === "admin" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-[#0A0A0A]">
                        Trainers & Faculty Directory ({trainers.length})
                      </h3>
                      <p className="text-xs text-black/50">
                        Review appointed technical instructors, specializations, and coaching experience.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {trainers.map((t) => (
                      <div
                        key={t._id}
                        className="bg-[#0E1016] border border-white/10 rounded-2xl p-5 text-white shadow-lg space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="text-base font-bold text-white">{t.name}</h4>
                            <p className="text-xs text-zinc-400">{t.email}</p>
                          </div>
                          <span className="bg-purple-500/15 text-purple-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-purple-500/30">
                            TRAINER
                          </span>
                        </div>

                        <div className="bg-[#17181E] border border-white/5 rounded-xl p-3 text-xs space-y-1">
                          <p className="text-zinc-300">
                            <span className="text-zinc-500 font-medium">Department: </span>
                            {t.profile?.department || "Computer Science"}
                          </p>
                          <p className="text-zinc-300">
                            <span className="text-zinc-500 font-medium">Designation: </span>
                            {t.profile?.designation || "Technical Trainer"}
                          </p>
                          <p className="text-zinc-300">
                            <span className="text-zinc-500 font-medium">Experience: </span>
                            {t.profile?.yearsOfExperience ? `${t.profile.yearsOfExperience} Years` : "—"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 5: PERMISSIONS, ACADEMIC VERIFICATION & HYBRID PROVISIONING (Admin Only) */}
              {activeTab === "governance" && role === "admin" && (
                <div className="space-y-6">
                  {/* Action Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-[#0A0A0A]">
                        Institutional Permissions & Academic Governance
                      </h3>
                      <p className="text-xs text-black/50">
                        Manage user roles, verify pending academic updates, and pre-provision college batches.
                      </p>
                    </div>

                    <button
                      onClick={() => setProvisionModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-black text-white text-xs font-semibold hover:bg-zinc-800 transition shadow-sm"
                    >
                      <FiUploadCloud size={14} />
                      <span>Bulk Provision Users</span>
                    </button>
                  </div>

                  {/* Pending Academic Updates Queue */}
                  <div className="bg-[#0E1016] border border-white/10 rounded-2xl p-5 text-white shadow-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold flex items-center gap-2">
                        <FiAlertCircle className="text-amber-400" />
                        <span>Pending Academic Verification Queue ({pendingVerifications.length})</span>
                      </h4>
                    </div>

                    {pendingVerifications.length > 0 ? (
                      <div className="divide-y divide-white/10">
                        {pendingVerifications.map((student) => {
                          const update = student.profile?.pendingAcademicUpdate || {};
                          return (
                            <div key={student._id} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                              <div>
                                <div className="font-bold text-white text-sm">
                                  {student.name} ({student.profile?.rollNumber || "No Roll"})
                                </div>
                                <div className="text-xs text-zinc-400">
                                  {student.email} • {student.profile?.course || "B.Tech"} - {student.profile?.section || "A"}
                                </div>
                                <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-zinc-300">
                                  <span className="bg-[#17181E] px-2 py-0.5 rounded border border-white/5">
                                    Current CGPA: <b>{student.profile?.currentCGPA || "—"}</b> → Submitted: <b className="text-amber-400">{update.currentCGPA || "—"}</b>
                                  </span>
                                  <span className="bg-[#17181E] px-2 py-0.5 rounded border border-white/5">
                                    10th: <b>{update.tenthPercentage ? `${update.tenthPercentage}%` : "—"}</b>
                                  </span>
                                  <span className="bg-[#17181E] px-2 py-0.5 rounded border border-white/5">
                                    12th: <b>{update.twelfthPercentage ? `${update.twelfthPercentage}%` : "—"}</b>
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleVerifyStudent(student._id, "verified")}
                                  className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition shadow-sm"
                                >
                                  Approve & Commit
                                </button>
                                <button
                                  onClick={() => handleVerifyStudent(student._id, "rejected")}
                                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition"
                                >
                                  Reject
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-400">
                        No pending student academic submissions. All records are up to date.
                      </p>
                    )}
                  </div>

                  {/* Role Assignment Table */}
                  <div className="bg-[#0E1016] border border-white/10 rounded-2xl p-5 text-white shadow-xl space-y-4">
                    <h4 className="text-sm font-bold">Role Assignment & Security Scoping</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#17181E] border-b border-white/10 text-zinc-400 uppercase font-semibold">
                          <tr>
                            <th className="py-2.5 px-3">User</th>
                            <th className="py-2.5 px-3">Email</th>
                            <th className="py-2.5 px-3">Current Role</th>
                            <th className="py-2.5 px-3">Assign New Role</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {[...trainers, ...students].slice(0, 15).map((u) => (
                            <tr key={u._id}>
                              <td className="py-2.5 px-3 font-semibold text-white">{u.name}</td>
                              <td className="py-2.5 px-3 text-zinc-400">{u.email}</td>
                              <td className="py-2.5 px-3">
                                <span className="font-bold uppercase text-[10px] px-2 py-0.5 rounded bg-white/10">
                                  {u.role}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <select
                                  value={u.role}
                                  onChange={(e) => handleRoleChange(u._id, e.target.value)}
                                  className="bg-[#17181E] border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white outline-none"
                                >
                                  <option value="student">Student</option>
                                  <option value="trainer">Trainer</option>
                                  <option value="admin">Admin</option>
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* WORKSPACE VIEW: HISTORY ARCHIVE */}
          {activeView === "history" && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              <InterviewArchive
                interviews={interviews}
                onSelectInterview={handleSelectInterview}
                onNewInterview={() => navigate("/interview")}
              />
            </motion.div>
          )}

          {/* WORKSPACE VIEW: DETAIL EXPLORER */}
          {activeView === "detail" && (
            <motion.div
              key="detail"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              <InterviewDetailView
                interviewId={selectedInterviewId}
                onBack={() => setActiveView("history")}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.main>

      {/* Shared Edit Profile Modal */}
      <EditProfileModal
        isOpen={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
        user={user}
        onProfileUpdated={(updatedUser) => {
          setUser(updatedUser);
        }}
      />

      {/* Schedule Interview Modal */}
      <ScheduleInterviewModal
        isOpen={scheduleModalOpen}
        onClose={() => {
          setScheduleModalOpen(false);
          setSelectedStudentForSchedule(null);
        }}
        initialStudent={selectedStudentForSchedule}
        onScheduled={() => {
          fetchScheduledList();
        }}
      />

      {/* Task Creation Modal (Admin / Trainer) */}
      <AnimatePresence>
        {taskModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0E1016] border border-white/10 rounded-2xl w-full max-w-lg p-6 shadow-2xl text-white"
            >
              <h3 className="text-lg font-bold mb-4">Create New Task / Assignment</h3>
              <form onSubmit={handleCreateTask} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">
                    Task Title
                  </label>
                  <input
                    type="text"
                    required
                    value={taskForm.title}
                    onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                    placeholder="e.g. Implement Binary Search Tree & LCA"
                    className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-white/30"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">
                    Description & Problem Statement
                  </label>
                  <textarea
                    rows={3}
                    value={taskForm.description}
                    onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                    placeholder="Enter instructions, constraints, and submission criteria..."
                    className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-white/30"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1">
                      Target Audience
                    </label>
                    <select
                      value={taskForm.targetType}
                      onChange={(e) => setTaskForm({ ...taskForm, targetType: e.target.value })}
                      className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none"
                    >
                      <option value="ALL_STUDENTS">All College Students</option>
                      <option value="SECTION">Specific Section</option>
                    </select>
                  </div>

                  {taskForm.targetType === "SECTION" && (
                    <div>
                      <label className="text-xs font-semibold text-zinc-300 block mb-1">
                        Section
                      </label>
                      <input
                        type="text"
                        value={taskForm.targetSection}
                        onChange={(e) => setTaskForm({ ...taskForm, targetSection: e.target.value })}
                        placeholder="e.g. CSE-A"
                        className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none"
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1">
                      Priority
                    </label>
                    <select
                      value={taskForm.priority}
                      onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                      className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={taskForm.dueDate}
                    onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                    className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white outline-none"
                  />
                </div>

                <div className="pt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setTaskModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-white/5 text-xs font-semibold hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-white text-black text-xs font-bold hover:bg-zinc-200"
                  >
                    Assign Task
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Student Submit Task Modal */}
      <AnimatePresence>
        {submitModalTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0E1016] border border-white/10 rounded-2xl w-full max-w-lg p-6 shadow-2xl text-white"
            >
              <h3 className="text-lg font-bold mb-1">Submit Task Solution</h3>
              <p className="text-xs text-zinc-400 mb-4">{submitModalTask.title}</p>

              <form onSubmit={handleSubmitTask} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">
                    GitHub / Code / Portfolio URL
                  </label>
                  <input
                    type="url"
                    value={submissionForm.submissionLink}
                    onChange={(e) =>
                      setSubmissionForm({ ...submissionForm, submissionLink: e.target.value })
                    }
                    placeholder="https://github.com/..."
                    className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-white/30"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">
                    Remarks / Solution Explanation
                  </label>
                  <textarea
                    rows={4}
                    value={submissionForm.submissionText}
                    onChange={(e) =>
                      setSubmissionForm({ ...submissionForm, submissionText: e.target.value })
                    }
                    placeholder="Describe your design decisions, time complexity, and edge cases handled..."
                    className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-white/30"
                  />
                </div>

                <div className="pt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSubmitModalTask(null)}
                    className="px-4 py-2 rounded-xl bg-white/5 text-xs font-semibold hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-white text-black text-xs font-bold hover:bg-zinc-200"
                  >
                    Submit Assignment
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Review Task Submissions Modal (Trainer / Admin) */}
      <AnimatePresence>
        {reviewTaskSubmissions && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0E1016] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col p-6 shadow-2xl text-white overflow-hidden"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div>
                  <h3 className="text-base font-bold">
                    Submissions: {reviewTaskSubmissions.task?.title}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {reviewTaskSubmissions.submissions?.length || 0} Student Submissions
                  </p>
                </div>
                <button
                  onClick={() => setReviewTaskSubmissions(null)}
                  className="text-zinc-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="overflow-y-auto divide-y divide-white/10 py-3 space-y-3">
                {reviewTaskSubmissions.submissions?.length > 0 ? (
                  reviewTaskSubmissions.submissions.map((sub) => (
                    <div key={sub._id} className="pt-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-white">{sub.studentName}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            sub.status === "reviewed"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-amber-500/20 text-amber-400"
                          }`}
                        >
                          {sub.status === "reviewed" ? `Reviewed (${sub.score}/100)` : "Pending Review"}
                        </span>
                      </div>
                      {sub.submissionLink && (
                        <a
                          href={sub.submissionLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                        >
                          <FiExternalLink size={11} /> {sub.submissionLink}
                        </a>
                      )}
                      {sub.submissionText && (
                        <p className="text-xs text-zinc-300 bg-[#17181E] p-2.5 rounded-xl whitespace-pre-wrap">
                          {sub.submissionText}
                        </p>
                      )}

                      {/* Grading Action */}
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          defaultValue={sub.score || ""}
                          id={`score-${sub._id}`}
                          placeholder="Score (0-100)"
                          className="bg-[#17181E] border border-white/10 rounded-lg px-2 py-1 text-xs text-white w-28 outline-none"
                        />
                        <button
                          onClick={async () => {
                            const val = document.getElementById(`score-${sub._id}`)?.value;
                            if (val !== undefined && val !== "") {
                              await reviewSubmission(reviewTaskSubmissions.task._id, sub._id, {
                                score: Number(val),
                                trainerRemarks: "Evaluated by Instructor",
                              });
                              const res = await getTaskSubmissions(reviewTaskSubmissions.task._id);
                              setReviewTaskSubmissions({
                                ...reviewTaskSubmissions,
                                submissions: res.submissions || [],
                              });
                            }
                          }}
                          className="px-3 py-1 rounded-lg bg-white text-black font-bold text-xs hover:bg-zinc-200 transition"
                        >
                          Save Grade
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-zinc-400 py-6 text-center">
                    No submissions received yet for this task.
                  </p>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bulk User Provisioning Modal (Admin Only) */}
      <AnimatePresence>
        {provisionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0E1016] border border-white/10 rounded-2xl w-full max-w-lg p-6 shadow-2xl text-white"
            >
              <h3 className="text-lg font-bold mb-1">Bulk Provision Students & Trainers</h3>
              <p className="text-xs text-zinc-400 mb-4">
                Paste JSON array or CSV lines: <code>email, name, role, rollNumber, section, course, currentCGPA</code>
              </p>

              <form onSubmit={handleProvisionSubmit} className="space-y-4">
                <textarea
                  rows={6}
                  required
                  value={provisionInput}
                  onChange={(e) => setProvisionInput(e.target.value)}
                  placeholder={`rahul@college.edu, Rahul Verma, student, 21CSE101, CSE-A, B.Tech CSE, 8.9\npriya@college.edu, Priya Singh, student, 21CSE102, CSE-A, B.Tech CSE, 9.2\nsunil@college.edu, Dr. Sunil Rao, trainer, EMP-20, CSE, Senior Trainer`}
                  className="w-full bg-[#17181E] border border-white/10 rounded-xl p-3 text-xs font-mono text-zinc-200 outline-none focus:border-white/30"
                />

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setProvisionModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-white/5 text-xs font-semibold hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-white text-black text-xs font-bold hover:bg-zinc-200"
                  >
                    Import & Provision
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Dashboard;
