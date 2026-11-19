import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  FiArrowLeft,
  FiBookOpen,
  FiCheck,
  FiChevronDown,
  FiClock,
  FiCode,
  FiCpu,
  FiDatabase,
  FiFileText,
  FiLayers,
  FiRefreshCw,
  FiSend,
  FiServer,
  FiShield,
  FiTarget,
  FiTerminal,
  FiUploadCloud,
  FiX,
  FiZap,
} from 'react-icons/fi';
import { BsRocketTakeoff } from 'react-icons/bs';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import api from '../utils/axios';
import { setResume } from '../redux/resumeSlice';
import RoadmapResult from '../components/roadmap/RoadmapResult';

const PACKAGE_OPTIONS = ['10 LPA', '15 LPA', '20 LPA', '30 LPA', '40 LPA'];

// Categorized role tracks for interactive launchpad
const CATEGORIZED_ROLE_TRACKS = [
  {
    category: 'Full-Stack & Frontend',
    roles: [
      {
        name: 'MERN Stack Developer',
        duration: '12 Weeks',
        comp: '15-25 LPA',
        icon: FiCode,
        badge: 'High Demand',
      },
      {
        name: 'Full-Stack Software Engineer',
        duration: '16 Weeks',
        comp: '20-35 LPA',
        icon: FiLayers,
        badge: 'Enterprise',
      },
      {
        name: 'Frontend Developer',
        duration: '10 Weeks',
        comp: '12-20 LPA',
        icon: FiTerminal,
        badge: 'UI/UX Focus',
      },
    ],
  },
  {
    category: 'Backend & Cloud / DevOps',
    roles: [
      {
        name: 'Java Backend Developer',
        duration: '14 Weeks',
        comp: '18-30 LPA',
        icon: FiServer,
        badge: 'Enterprise Core',
      },
      {
        name: 'Python Backend Developer',
        duration: '12 Weeks',
        comp: '15-28 LPA',
        icon: FiCode,
        badge: 'API & Microservices',
      },
      {
        name: 'Backend Developer',
        duration: '12 Weeks',
        comp: '16-30 LPA',
        icon: FiDatabase,
        badge: 'Distributed Systems',
      },
      {
        name: 'DevOps Engineer',
        duration: '16 Weeks',
        comp: '20-35 LPA',
        icon: FiCpu,
        badge: 'Cloud & Kubernetes',
      },
    ],
  },
  {
    category: 'AI/ML & Data / QA',
    roles: [
      {
        name: 'Data Analyst',
        duration: '10 Weeks',
        comp: '10-18 LPA',
        icon: FiDatabase,
        badge: 'SQL & Analytics',
      },
      {
        name: 'ML Engineer',
        duration: '18 Weeks',
        comp: '25-45 LPA',
        icon: FiCpu,
        badge: 'Deep Learning',
      },
      {
        name: 'QA Automation Engineer',
        duration: '10 Weeks',
        comp: '10-18 LPA',
        icon: FiCheck,
        badge: 'Test Architecture',
      },
    ],
  },
];

export const ROADMAP_TRACKS = [
  'MERN Stack Developer',
  'Full-Stack Software Engineer',
  'Java Backend Developer',
  'Frontend Developer',
  'Backend Developer',
  'Python Backend Developer',
  'QA Automation Engineer',
  'DevOps Engineer',
  'Data Analyst',
  'ML Engineer',
];

function Roadmap({ user, setUser }) {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [historyOpen, setHistoryOpen] = useState(false);
  const [roadmap, setRoadmap] = useState(null);
  const [role, setRole] = useState('');
  const [targetPackage, setTargetPackage] = useState(PACKAGE_OPTIONS[2]); // default "20 LPA"
  const [useResume, setUseResume] = useState(false);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');

  // Modal state for uploading / replacing resume
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [modalFile, setModalFile] = useState(null);
  const [modalUploading, setModalUploading] = useState(false);
  const [modalError, setModalError] = useState('');

  const { resume } = useSelector((state) => state.resume);

  useEffect(() => {
    getAllRoadmaps();
  }, []);

  const getAllRoadmaps = async () => {
    setHistoryLoading(true);
    try {
      const response = await api.get('/api/roadmap/all');
      setHistory(response.data.data || []);
      setHistoryLoading(false);
    } catch (err) {
      console.error('Failed to load roadmaps:', err);
      setHistoryLoading(false);
    }
  };

  const getRoadmapById = async (id) => {
    try {
      const response = await api.get(`/api/roadmap/${id}`);
      setRoadmap(response.data.data);
    } catch (err) {
      console.error('Failed to load roadmap by id:', err);
    }
  };

  const handleResumeToggle = () => {
    if (useResume) {
      setUseResume(false);
      return;
    }

    if (resume && (resume.skills?.length || resume._id)) {
      setUseResume(true);
      return;
    }

    setModalFile(null);
    setModalError('');
    setShowResumeModal(true);
  };

  const handleModalUpload = async () => {
    if (!modalFile) {
      setModalError('Please select a PDF file.');
      return;
    }

    try {
      setModalUploading(true);
      setModalError('');

      const formData = new FormData();
      formData.append('resume', modalFile);
      if (role && role.trim()) {
        formData.append('targetRole', role.trim());
      }

      const response = await api.post('/api/resume/upload', formData);
      if (response?.data?.data) {
        const uploadedResume = response.data.data;
        if (typeof response?.data?.interviewCoin === 'number') {
          setUser((prev) => ({
            ...prev,
            interviewCoin: response.data.interviewCoin,
          }));
        }
        dispatch(setResume(uploadedResume));
        setUseResume(true);
        setShowResumeModal(false);
        setModalFile(null);

        const detectedTitle =
          uploadedResume?.suggestedRole ||
          uploadedResume?.roleSkillAnalysis?.targetRoleLabel ||
          uploadedResume?.targetRole;
        if (!role.trim() && detectedTitle) {
          setRole(detectedTitle);
        }
      } else {
        throw new Error('No resume data returned');
      }
    } catch (err) {
      console.error('Roadmap resume modal upload error:', err);
      if (err.response?.status === 402) {
        setModalError(
          `Insufficient interview coins! You need ${err.response.data?.required || 10} coins to analyze a resume.`
        );
      } else {
        setModalError(
          err.response?.data?.message || 'Failed to analyze resume. Please try again.'
        );
      }
    } finally {
      setModalUploading(false);
    }
  };

  const handleGenerate = async () => {
    if (!role.trim() || loading) return;
    setLoading(true);
    setError('');
    try {
      const payload = {
        role: role.trim(),
        targetPackage,
        useResume,
        resume: useResume ? resume : null,
      };

      const response = await api.post('/api/roadmap/generate', payload);
      if (typeof response.data?.interviewCoin === 'number') {
        setUser((prev) => ({
          ...prev,
          interviewCoin: response.data.interviewCoin,
        }));
      }
      setRoadmap(response.data.data);
      getAllRoadmaps();
      setLoading(false);
    } catch (err) {
      console.error('Failed to generate roadmap:', err);
      if (err.response?.status === 402) {
        setError(
          `Insufficient interview coins! You need ${
            err.response.data?.required || 20
          } coins to generate a roadmap. Please recharge your balance.`
        );
      } else {
        const errMsg =
          err.response?.data?.message ||
          'Something went wrong while generating your roadmap. Please try again.';
        setError(errMsg);
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-gray-900 flex flex-col font-sans">
      {/* 1. STICKY TOP STUDIO HEADER */}
      <motion.nav
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand Mark + Studio Badge */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 group cursor-pointer text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-[#111318] flex items-center justify-center text-white font-black text-sm shadow-sm group-hover:scale-105 transition-transform">
                Y
              </div>
              <span className="font-extrabold text-base tracking-tight text-gray-900 hidden sm:inline">
                Yugam
              </span>
            </button>
            <span className="bg-[#111318] text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
              Career Roadmap Studio
            </span>
          </div>

          {/* Center Badge if Roadmap Active */}
          {roadmap && (
            <div className="hidden md:flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 px-3 py-1 rounded-full truncate max-w-sm">
                Active: {roadmap.title} ({roadmap.targetPackage})
              </span>
            </div>
          )}

          {/* Right Action Suite */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Back to Overview */}
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-200 rounded-full px-3.5 py-1.5 text-xs font-medium inline-flex items-center gap-1.5 transition cursor-pointer"
            >
              <FiArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Back to Overview</span>
            </button>

            {/* Saved Roadmaps (History) Button */}
            <button
              onClick={() => setHistoryOpen(!historyOpen)}
              className="bg-white hover:bg-gray-50 text-gray-800 border border-gray-300 rounded-full px-3.5 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <FiClock className="w-3.5 h-3.5 text-indigo-600" />
              <span>Saved Roadmaps</span>
              {history.length > 0 && (
                <span className="bg-[#111318] text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                  {history.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </motion.nav>

      {/* 2. MAIN CONTENT AREA */}
      <main className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 flex-1">
        <AnimatePresence mode="wait">
          {!roadmap ? (
            /* ======================================================== */
            /* EMPTY / GENERATOR LAUNCHPAD HERO STATE                    */
            /* ======================================================== */
            <motion.div
              key="launchpad"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              {/* Obsidian Hero Command Center */}
              <div className="bg-[#111318] text-white rounded-3xl p-6 sm:p-9 shadow-lg border border-gray-800 relative overflow-hidden">
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-56 h-56 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 space-y-6">
                  {/* Headline & Badges */}
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-3 py-1 rounded-full inline-flex items-center gap-1.5">
                      <FiZap className="w-3 h-3" />
                      AI-Powered Learning Pathways
                    </span>
                    <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white mt-3">
                      Architect Your Engineering Roadmap
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-300 mt-2 max-w-2xl leading-relaxed">
                      Generate a personalized, milestone-driven curriculum tailored to target compensation tiers, complete with curated YouTube masterclasses, verified documentation, and completion tracking.
                    </p>
                  </div>

                  {/* Integrated Command Center Controls */}
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4">
                    {/* Role Input Bar */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5 flex items-center gap-1.5">
                        <FiTarget className="text-emerald-400" />
                        Target Career Role
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          list="roadmap-roles-list"
                          placeholder="Type or select a target role (e.g. Full-Stack Software Engineer)"
                          value={role}
                          onChange={(e) => {
                            setRole(e.target.value);
                            setError('');
                          }}
                          className="w-full h-12 bg-white/10 border border-white/15 rounded-xl px-4 text-xs sm:text-sm text-white placeholder-gray-400 outline-none focus:border-emerald-400 transition"
                        />
                        <datalist id="roadmap-roles-list">
                          {ROADMAP_TRACKS.map((track) => (
                            <option key={track} value={track} />
                          ))}
                        </datalist>
                      </div>
                    </div>

                    {/* Bottom Row: LPA Selector + Resume Status + Generate Button */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                      {/* Target Package Selector */}
                      <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                        <span className="text-[11px] uppercase font-bold text-gray-400 mr-1 hidden sm:inline">
                          Package:
                        </span>
                        {PACKAGE_OPTIONS.map((pkg) => (
                          <button
                            key={pkg}
                            type="button"
                            onClick={() => setTargetPackage(pkg)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                              targetPackage === pkg
                                ? 'bg-white text-black shadow-xs'
                                : 'bg-white/10 text-gray-300 hover:bg-white/15'
                            }`}
                          >
                            {pkg}
                          </button>
                        ))}
                      </div>

                      {/* Right Cluster: Attach Resume Pill + CTA Button */}
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        {/* Attach Resume Button */}
                        {resume ? (
                          <div
                            className={`flex items-center rounded-xl border text-xs transition ${
                              useResume
                                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                                : 'bg-white/10 border-white/15 text-gray-300'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={handleResumeToggle}
                              className="px-3 py-2 flex items-center gap-1.5 hover:text-white transition cursor-pointer"
                            >
                              <FiCheck className="w-3.5 h-3.5" />
                              <span>{useResume ? 'Resume Linked' : 'Link Resume'}</span>
                            </button>
                            <span className="h-4 w-[1px] bg-white/15" />
                            <button
                              type="button"
                              onClick={() => {
                                setModalFile(null);
                                setModalError('');
                                setShowResumeModal(true);
                              }}
                              className="p-2 text-gray-400 hover:text-white transition cursor-pointer"
                              title="Replace resume"
                            >
                              <FiRefreshCw className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={handleResumeToggle}
                            className="px-3 py-2 rounded-xl border border-white/15 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 text-xs font-medium inline-flex items-center gap-1.5 transition cursor-pointer"
                          >
                            <FiUploadCloud className="w-3.5 h-3.5" />
                            <span>Attach Resume</span>
                          </button>
                        )}

                        {/* Primary Generate Button */}
                        <button
                          type="button"
                          onClick={handleGenerate}
                          disabled={loading || !role.trim()}
                          className="h-10 px-5 rounded-xl font-bold text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                        >
                          {loading ? (
                            <>
                              <FiRefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Architecting...</span>
                            </>
                          ) : (
                            <>
                              <FiZap className="w-3.5 h-3.5 text-amber-300" />
                              <span>Generate Roadmap</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Error Banner inside Hero */}
                    {error && (
                      <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-xl text-xs text-red-200 flex items-center gap-2">
                        <FiAlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Categorized Role Preset Grid */}
              <div className="space-y-6">
                <div className="text-center sm:text-left">
                  <h2 className="text-lg font-bold text-gray-900">
                    Explore High-Growth Engineering Pathways
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Select a specialization below to auto-populate curriculum parameters.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {CATEGORIZED_ROLE_TRACKS.map((category) => (
                    <div
                      key={category.category}
                      className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs flex flex-col gap-3"
                    >
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 pb-2 border-b border-gray-100">
                        {category.category}
                      </h3>

                      <div className="space-y-2">
                        {category.roles.map((r) => {
                          const Icon = r.icon;
                          const isSelected = role.trim().toLowerCase() === r.name.toLowerCase();

                          return (
                            <button
                              key={r.name}
                              type="button"
                              onClick={() => {
                                setRole(r.name);
                                setError('');
                              }}
                              className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                                isSelected
                                  ? 'bg-[#111318] text-white border-[#111318] shadow-sm'
                                  : 'bg-gray-50/70 hover:bg-gray-100 text-gray-800 border-gray-200/80'
                              }`}
                            >
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                  isSelected ? 'bg-white/10 text-emerald-400' : 'bg-white text-indigo-600 shadow-2xs'
                                }`}
                              >
                                <Icon className="w-4 h-4" />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1">
                                  <p className="text-xs font-bold truncate">{r.name}</p>
                                  {isSelected && <FiCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                                </div>
                                <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                                  <span>{r.duration}</span>
                                  <span>•</span>
                                  <span className={isSelected ? 'text-emerald-300' : 'text-gray-600 font-semibold'}>
                                    {r.comp}
                                  </span>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            /* ======================================================== */
            /* ACTIVE ROADMAP VIEW                                       */
            /* ======================================================== */
            <motion.div
              key="roadmap-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
            >
              <RoadmapResult roadmap={roadmap} onClear={() => setRoadmap(null)} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* 3. HISTORY DRAWER */}
      <AnimatePresence>
        {historyOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setHistoryOpen(false)}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs"
            />

            <motion.aside
              initial={{ x: 360 }}
              animate={{ x: 0 }}
              exit={{ x: 360 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-[320px] sm:w-[360px] max-w-[90vw] bg-white border-l border-gray-200 flex flex-col overflow-y-auto shadow-2xl"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white/95 backdrop-blur-md z-10">
                <div>
                  <span className="text-sm font-bold text-gray-900 block">Saved Roadmaps</span>
                  <span className="text-[11px] text-gray-500">Your generated learning tracks</span>
                </div>
                <button
                  onClick={() => setHistoryOpen(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
                >
                  <FiX size={18} />
                </button>
              </div>

              <div className="flex flex-col gap-3 p-4 flex-1">
                {historyLoading ? (
                  <div className="text-center py-12 text-gray-400 text-xs flex items-center justify-center gap-2">
                    <FiRefreshCw className="animate-spin" />
                    <span>Loading saved roadmaps...</span>
                  </div>
                ) : history.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-xs">
                    No roadmaps generated yet. Generate your first one above!
                  </div>
                ) : (
                  history.map((h, i) => (
                    <button
                      key={h._id || i}
                      onClick={() => {
                        getRoadmapById(h._id);
                        setHistoryOpen(false);
                      }}
                      className="text-left p-4 rounded-2xl bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 transition-all cursor-pointer group shadow-2xs"
                    >
                      <h4 className="text-sm font-bold text-gray-900 group-hover:text-black">
                        {h.title}
                      </h4>
                      <div className="flex justify-between items-center my-1.5">
                        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                          {h.targetPackage}
                        </span>
                        <span className="text-xs text-gray-500">{h.duration}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">
                        Generated on {new Date(h.createdAt).toLocaleDateString()}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* 4. RESUME UPLOAD / REPLACEMENT MODAL */}
      <AnimatePresence>
        {showResumeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md rounded-3xl bg-white border border-gray-200 p-6 shadow-2xl flex flex-col gap-4 text-gray-900"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                    <FiUploadCloud size={16} />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900">
                    {resume ? 'Replace Stored Resume' : 'Attach Resume for Personalized Roadmap'}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setShowResumeModal(false);
                    setModalFile(null);
                    setModalError('');
                  }}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition cursor-pointer"
                >
                  <FiX size={16} />
                </button>
              </div>

              <p className="text-xs text-gray-500 leading-relaxed">
                {resume
                  ? `Upload a newer resume PDF to replace your current resume (${
                      resume.suggestedRole || 'Stored Profile'
                    }) and calibrate upcoming curriculum modules to your updated skills.`
                  : 'Upload your resume PDF so our AI engine can assess your current proficiencies and identify targeted skill gaps.'}
              </p>

              <label className="cursor-pointer flex flex-col items-center justify-center border-2 border-dashed border-gray-300 hover:border-gray-500 rounded-2xl p-6 transition-all bg-gray-50/60 hover:bg-gray-50">
                <FiUploadCloud size={28} className={modalFile ? 'text-emerald-600' : 'text-gray-400'} />
                <span className="mt-2 text-xs font-semibold text-gray-800 text-center max-w-[280px] truncate">
                  {modalFile ? modalFile.name : 'Click to select resume PDF'}
                </span>
                <span className="text-[11px] text-gray-400 mt-1">PDF format • Costs 10 Coins</span>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      setModalFile(e.target.files[0]);
                      setModalError('');
                    }
                  }}
                />
              </label>

              {modalError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
                  {modalError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowResumeModal(false);
                    setModalFile(null);
                    setModalError('');
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleModalUpload}
                  disabled={!modalFile || modalUploading}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#111318] text-white hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                >
                  {modalUploading ? 'Analyzing Resume...' : 'Analyze & Link'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Roadmap;
