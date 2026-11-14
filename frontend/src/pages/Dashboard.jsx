import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { useNavigate } from 'react-router-dom';
import api from '../utils/axios';
import { motion, AnimatePresence } from 'motion/react';
import { FiSidebar, FiClock, FiArrowLeft, FiArrowRight, FiFileText, FiPlus, FiCheckCircle } from 'react-icons/fi';
import { getAllInterviews } from '../apis/interview.api';
import Statbox from '../components/Statbox';
import InterviewGraph from '../components/InterviewGraph';
import InterviewArchive from '../components/interview/InterviewArchive';
import InterviewDetailView from '../components/interview/InterviewDetailView';

function Dashboard({ user, setUser }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [moblieOpen, setMoblieOpen] = useState(false);

  // 3-State Workspace View: "overview" | "history" | "detail"
  const [activeView, setActiveView] = useState("overview");
  const [selectedInterviewId, setSelectedInterviewId] = useState(null);

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

  const navigate = useNavigate();

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

  useEffect(() => {
    fetchInterviews();
  }, []);

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

  return (
    <div className='bg-white min-h-screen text-[#0A0A0A] font-sans flex'>
      <Sidebar
        user={user}
        onNewInterview={() => navigate("/interview")}
        onLogout={handleLogout}
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
        <div className='flex items-center justify-between mb-5 md:mb-6'>
          <div className='flex items-center gap-2.5'>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setMoblieOpen(true)}
              className='md:hidden text-black/40 hover:text-[#0A0A0A] transition-colors p-1'
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
                  <p className='text-black/40 text-[11px] md:text-xs font-medium mb-0.5'>Overview</p>
                  <h2 className='text-lg md:text-xl font-bold text-[#0A0A0A]'>
                    Hello, {user?.name?.split(" ")[0]} 👋
                  </h2>
                </>
              )}

              {activeView === "history" && (
                <>
                  <p className='text-black/40 text-[11px] md:text-xs font-medium mb-0.5'>Workspace Archive</p>
                  <h2 className='text-lg md:text-xl font-bold text-[#0A0A0A]'>
                    Interview History 📂
                  </h2>
                </>
              )}

              {activeView === "detail" && (
                <>
                  <p className='text-black/40 text-[11px] md:text-xs font-medium mb-0.5'>Session Explorer</p>
                  <h2 className='text-lg md:text-xl font-bold text-[#0A0A0A]'>
                    Interview Transcript & Report 📝
                  </h2>
                </>
              )}
            </motion.div>
          </div>

          {/* Top-Right Header Actions & View Toggle */}
          <div className='flex items-center gap-2'>
            {activeView === "overview" && (
              <button
                onClick={() => setActiveView("history")}
                className='flex items-center gap-2 px-3.5 py-2 rounded-xl bg-black text-white text-xs font-semibold hover:bg-zinc-800 transition shadow-sm border border-black/10'
              >
                <FiClock size={14} className='text-zinc-400' />
                <span className='hidden sm:inline'>Interview History</span>
                <span className='sm:hidden'>History</span>
                <span className='ml-0.5 px-2 py-0.5 rounded-full bg-white/20 text-[11px] font-bold'>
                  {interviews.length}
                </span>
              </button>
            )}

            {activeView === "history" && (
              <button
                onClick={() => setActiveView("overview")}
                className='flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold transition border border-black/5 shadow-sm'
              >
                <FiArrowLeft size={14} />
                <span>Back to Overview</span>
              </button>
            )}

            {activeView === "detail" && (
              <div className='flex items-center gap-2'>
                <button
                  onClick={() => setActiveView("history")}
                  className='flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold transition border border-black/5 shadow-sm'
                >
                  <FiArrowLeft size={13} />
                  <span>Back to History</span>
                </button>
                <button
                  onClick={() => setActiveView("overview")}
                  className='px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-medium transition border border-black/5'
                >
                  Overview
                </button>
              </div>
            )}
          </div>
        </div>

        <div className='h-px bg-black/8 mb-5 md:mb-6' />

        {/* Workspace Body: Dynamic View Switching */}
        <AnimatePresence mode="wait">
          {activeView === "overview" && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              {/* Statbox Metric Counters */}
              <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 md:gap-3'>
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

              {/* Performance Charts */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <div>
                    <p className='text-black/40 text-[10px] font-semibold uppercase tracking-widest'>
                      Performance
                    </p>
                    <h3 className='text-[#0A0A0A] font-bold text-sm md:text-base'>
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
                      <h4 className="text-sm font-bold text-[#0A0A0A]">Recent Mock Interviews</h4>
                      <p className="text-xs text-black/40">Quickly reopen recent transcripts or resume active sessions.</p>
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
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                            item.type === 'technical' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                          }`}>
                            {item.type}
                          </span>
                          <span className={`text-[10px] font-semibold ${
                            item.status === 'completed' ? 'text-emerald-400' : 'text-amber-400'
                          }`}>
                            {item.status === 'completed' ? 'Score: ' + (item.overallScore || 0) : 'In Progress'}
                          </span>
                        </div>
                        <h5 className="text-sm font-bold truncate text-white mb-1">{item.role}</h5>
                        <p className="text-[11px] text-zinc-400">
                          {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

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
    </div>
  );
}

export default Dashboard;
