import React from 'react'
import { AnimatePresence, motion } from "motion/react"
import { FiCheck, FiChevronDown, FiClock, FiFileText, FiRefreshCw, FiSend, FiUploadCloud, FiX, FiZap } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { BsRocketTakeoff } from "react-icons/bs";
import api from '../utils/axios'
import { useDispatch, useSelector } from 'react-redux'
import { setResume } from '../redux/resumeSlice'
import RoadmapResult from '../components/roadmap/RoadmapResult'

const PACKAGE_OPTIONS = ["10 LPA", "15 LPA", "20 LPA", "30 LPA", "40 LPA"];

export const ROADMAP_TRACKS = [
    "MERN Stack Developer",
    "Full-Stack Software Engineer",
    "Java Backend Developer",
    "Frontend Developer",
    "Backend Developer",
    "Python Backend Developer",
    "QA Automation Engineer",
    "DevOps Engineer",
    "Data Analyst",
    "ML Engineer",
];

function Roadmap({ user, setUser }) {
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const [historyOpen, setHistoryOpen] = useState(false);
    const [roadmap, setRoadmap] = useState(null);
    const [role, setRole] = useState("");
    const [targetPackage, setTargetPackage] = useState(PACKAGE_OPTIONS[2]); // default "20 LPA"
    const [packageOpen, setPackageOpen] = useState(false);
    const [useResume, setUseResume] = useState(false);
    const [loading, setLoading] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [history, setHistory] = useState([]);
    const [error, setError] = useState("");

    // Modal state for uploading / replacing resume
    const [showResumeModal, setShowResumeModal] = useState(false);
    const [modalFile, setModalFile] = useState(null);
    const [modalUploading, setModalUploading] = useState(false);
    const [modalError, setModalError] = useState("");

    const { resume } = useSelector((state) => state.resume)

    useEffect(() => {
        getAllRoadmaps()
    }, [])

    const getAllRoadmaps = async () => {
        setHistoryLoading(true)
        try {
            const response = await api.get("/api/roadmap/all")
            setHistory(response.data.data || [])
            setHistoryLoading(false)
        } catch (error) {
            console.error("Failed to load roadmaps:", error)
            setHistoryLoading(false)
        }
    }

    const getRoadmapById = async (id) => {
        try {
            const response = await api.get(`/api/roadmap/${id}`)
            setRoadmap(response.data.data)
        } catch (error) {
            console.error("Failed to load roadmap by id:", error)
        }
    }

    // Toggle resume attachment
    const handleResumeToggle = () => {
        if (useResume) {
            setUseResume(false);
            return;
        }

        if (resume && (resume.skills?.length || resume._id)) {
            setUseResume(true);
            return;
        }

        // If no resume in Redux, prompt to upload
        setModalFile(null);
        setModalError("");
        setShowResumeModal(true);
    };

    const handleModalUpload = async () => {
        if (!modalFile) {
            setModalError("Please select a PDF file.");
            return;
        }

        try {
            setModalUploading(true);
            setModalError("");

            const formData = new FormData();
            formData.append("resume", modalFile);
            if (role && role.trim()) {
                formData.append("targetRole", role.trim());
            }

            const response = await api.post("/api/resume/upload", formData);
            if (response?.data?.data) {
                const uploadedResume = response.data.data;
                if (typeof response?.data?.interviewCoin === "number") {
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
                throw new Error("No resume data returned");
            }
        } catch (err) {
            console.error("Roadmap resume modal upload error:", err);
            if (err.response?.status === 402) {
                setModalError(`Insufficient interview coins! You need ${err.response.data?.required || 10} coins to analyze a resume.`);
            } else {
                setModalError(err.response?.data?.message || "Failed to analyze resume. Please try again.");
            }
        } finally {
            setModalUploading(false);
        }
    };

    const handleGenerate = async () => {
        if (!role.trim() || loading) return;
        setLoading(true);
        setError("");
        try {
            const payload = {
                role: role.trim(),
                targetPackage,
                useResume,
                resume: useResume ? resume : null,
            };

            const response = await api.post("/api/roadmap/generate", payload);
            if (typeof response.data?.interviewCoin === "number") {
                setUser((prev) => ({
                    ...prev,
                    interviewCoin: response.data.interviewCoin,
                }));
            }
            setRoadmap(response.data.data);
            getAllRoadmaps();
            setLoading(false);

        } catch (error) {
            console.error("Failed to generate roadmap:", error);
            if (error.response?.status === 402) {
                setError(`Insufficient interview coins! You need ${error.response.data?.required || 20} coins to generate a roadmap. Please recharge your balance.`);
            } else {
                const errMsg = error.response?.data?.message || "Something went wrong while generating your roadmap. Please try again.";
                setError(errMsg);
            }
            setLoading(false);
        }
    };

    return (
        <div className='min-h-screen bg-white text-[#0A0A0A] flex flex-col'>
            <motion.nav
                initial={{ y: -60, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className='sticky top-0 z-20 border-b border-black/8 bg-white/80 backdrop-blur-xl'>
                <div className='mx-auto flex h-12 max-w-7xl items-center justify-between px-3 sm:px-5'>
                    <div onClick={() => navigate("/dashboard")}
                        className='flex cursor-pointer items-center gap-1.5'>
                        <span className='text-sm font-extrabold sm:text-base text-[#0A0A0A]'>Yugam</span>
                        <span className='hidden rounded bg-black/5 px-1.5 py-0.5 text-[10px] text-black/50 sm:block'>Roadmap Builder</span>
                    </div>

                    <button onClick={() => setHistoryOpen(!historyOpen)} className='flex h-8 items-center justify-center gap-1 rounded-lg border border-black/15 text-black/60 transition px-2 hover:border-[#0A0A0A] hover:text-[#0A0A0A] text-[10px]'>
                        <FiClock />
                        <span className="hidden sm:inline">History</span>
                    </button>
                </div>
            </motion.nav>

            <main className='flex-1 overflow-y-auto pb-28 sm:pb-32 pt-16 sm:pt-20'>
                <div className='max-w-3xl mx-auto px-3 sm:px-4 pt-5 sm:pt-6'>
                    <AnimatePresence mode='wait'>
                        {!roadmap ? (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.97 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.97 }}
                                transition={{ duration: 0.4 }}
                                className='flex flex-col items-center justify-center min-h-[60vh] text-center px-2 sm:px-4'>
                                <div className='text-4xl sm:text-5xl mb-4 sm:mb-5'>
                                    <BsRocketTakeoff className='text-gray-700' />
                                </div>

                                <h3 className='text-xl sm:text-2xl font-bold text-[#0A0A0A] mb-2'>AI Roadmap Generator</h3>

                                <p className='text-black/45 text-sm max-w-xs sm:max-w-md mb-1'>Generate a personalised roadmap for your dream job.</p>

                                <p className='text-black/35 text-xs sm:text-sm max-w-xs sm:max-w-md'>
                                    Choose a role and let AI build a complete learning path.
                                </p>

                                {error && <p className="mt-4 text-xs text-red-500 max-w-xs sm:max-w-md">{error}</p>}

                                <div className='mt-6 sm:mt-8 flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 w-full max-w-2xl px-2'>
                                    {ROADMAP_TRACKS.map((track) => {
                                        const isSelected = role.trim().toLowerCase() === track.toLowerCase();
                                        return (
                                            <motion.button
                                                key={track}
                                                type="button"
                                                onClick={() => setRole(track)}
                                                whileHover={{ y: -2, scale: 1.02 }}
                                                whileTap={{ scale: 0.97 }}
                                                className={`relative overflow-hidden text-xs py-2 sm:py-2.5 px-3.5 sm:px-4 rounded-xl border transition-all ${
                                                    isSelected
                                                        ? "bg-white text-black font-semibold border-white shadow-[0_0_20px_rgba(255,255,255,0.25)]"
                                                        : "bg-[#000000]/80 backdrop-blur-2xl border-white/10 text-white/65 hover:text-white hover:border-white/25 shadow-[0_4px_14px_rgba(0,0,0,0.18)]"
                                                }`}
                                            >
                                                <div className='absolute inset-0 bg-gradient-to-br from-white/[0.07] via-transparent to-transparent pointer-events-none' />
                                                <span className='relative'>{track}</span>
                                            </motion.button>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        ) : (
                            <RoadmapResult
                                roadmap={roadmap}
                                onClear={() => setRoadmap(null)}
                            />
                        )}
                    </AnimatePresence>
                </div>
            </main>

            {/* Bottom Bar */}
            <div className='fixed bottom-0 left-0 right-0 z-30 pb-3 sm:pb-4 pt-3 px-3 sm:px-4 bg-gradient-to-t from-white via-white/95 to-transparent'>
                <div className='max-w-3xl mx-auto'>
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className='relative overflow-visible flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-xl sm:rounded-2xl bg-[#000000]/90 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.25)]'>

                        <input
                            type='text'
                            list='roadmap-roles'
                            placeholder='Choose or type a target role (e.g. MERN Stack Developer)'
                            onChange={(e) => setRole(e.target.value)}
                            value={role}
                            className='relative flex-1 min-w-0 bg-transparent text-xs sm:text-sm text-white placeholder-white/30 outline-none px-2 py-1.5' 
                        />
                        <datalist id='roadmap-roles'>
                            {ROADMAP_TRACKS.map((track) => (
                                <option key={track} value={track} />
                            ))}
                        </datalist>

                        <div className='relative'>
                            <motion.button
                                type='button'
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => setPackageOpen(!packageOpen)}
                                className='relative flex items-center gap-1 text-xs px-2.5 py-2 rounded-xl border border-white/10 text-white/60 hover:text-white/90 hover:border-white/20 transition-all whitespace-nowrap bg-white/5'>
                                {targetPackage}
                                <FiChevronDown size={11} className={`transition-transform ${packageOpen ? "rotate-180" : ""}`} />
                            </motion.button>

                            <AnimatePresence>
                                {packageOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 6, scale: 0.97 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 6, scale: 0.97 }}
                                        transition={{ duration: 0.15 }}
                                        className='absolute bottom-full mb-4 right-0 w-28 rounded-xl overflow-hidden border border-white/10 bg-[#0A0A0A] shadow-[0_8px_24px_rgba(0,0,0,0.35)] z-10'>
                                        {
                                            PACKAGE_OPTIONS.map((pkg) => (
                                                <button key={pkg}
                                                    onClick={() => {
                                                        setTargetPackage(pkg);
                                                        setPackageOpen(false)
                                                    }}
                                                    className={`w-full text-left text-xs px-3 py-2 transition-colors ${pkg === targetPackage
                                                        ? "bg-white/10 text-white"
                                                        : "text-white/55 hover:bg-white/5 hover:text-white/90"
                                                        }`}>
                                                    {pkg}
                                                </button>
                                            ))
                                        }
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Resume Management / Replacement Option */}
                        {resume ? (
                            <div className={`flex items-center rounded-xl border transition-all ${
                                useResume
                                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-medium"
                                    : "bg-white/5 border-white/10 text-white/60"
                            }`}>
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    type='button'
                                    onClick={handleResumeToggle}
                                    title={useResume ? "Click to disable resume for this roadmap" : "Click to enable resume"}
                                    className='flex items-center text-xs gap-1.5 px-2.5 sm:px-3 py-2 hover:text-white transition-colors whitespace-nowrap'>
                                    {useResume ? (
                                        <>
                                            <FiCheck size={12} className="text-emerald-400" />
                                            <span>✓ Resume Attached</span>
                                        </>
                                    ) : (
                                        <>
                                            <FiFileText size={12} />
                                            <span>Attach Resume</span>
                                        </>
                                    )}
                                </motion.button>

                                <div className={`h-4 w-[1px] ${useResume ? "bg-emerald-500/25" : "bg-white/10"}`} />

                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    type='button'
                                    onClick={() => {
                                        setModalFile(null);
                                        setModalError("");
                                        setShowResumeModal(true);
                                    }}
                                    title='Upload and replace with a newer resume'
                                    className='flex items-center gap-1 text-[11px] px-2 py-2 text-zinc-400 hover:text-white transition-colors whitespace-nowrap'>
                                    <FiRefreshCw size={11} />
                                    <span>Change</span>
                                </motion.button>
                            </div>
                        ) : (
                            <motion.button
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                                type='button'
                                onClick={handleResumeToggle}
                                className='flex items-center text-xs gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-white/60 hover:text-white hover:border-white/20 transition-all whitespace-nowrap'>
                                <FiUploadCloud size={12} />
                                <span>Attach Resume</span>
                            </motion.button>
                        )}

                        <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            disabled={loading || !role.trim()}
                            onClick={handleGenerate}
                            className='relative flex items-center gap-1.5 text-xs px-3 sm:px-4 py-2 rounded-xl font-semibold text-[#0A0A0A] bg-white hover:bg-white/90 shadow-[0_2px_10px_rgba(255,255,255,0.12)] transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap'>
                            {loading ? (
                                <>
                                    <motion.span
                                        animate={{ rotate: 360 }}
                                        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                                        className="inline-block"
                                    >
                                        <FiZap size={12} />
                                    </motion.span>
                                    <span className="hidden sm:inline">Generating…</span>
                                </>
                            ) : (
                                <>
                                    <FiSend size={12} />
                                    <span className="hidden sm:inline">Generate</span>
                                </>
                            )}
                        </motion.button>
                    </motion.div>
                </div>
            </div>

            {/* History Drawer */}
            <AnimatePresence>
                {
                    historyOpen && (
                        <>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setHistoryOpen(false)}
                                className='fixed inset-0 z-40 bg-black/20 backdrop-blur-sm' />

                            <motion.aside
                                initial={{ x: 320 }}
                                animate={{ x: 0 }}
                                exit={{ x: 320 }}
                                transition={{ type: "spring", stiffness: 320, damping: 32 }}
                                className='fixed right-0 top-0 bottom-0 z-50 w-[280px] sm:w-[300px] max-w-[85vw] bg-white border-l border-black/8 flex flex-col overflow-y-auto shadow-[0_0_40px_rgba(0,0,0,0.1)]'>
                                <div className='flex items-center justify-between px-4 py-3 sm:py-4 border-b border-black/8 sticky top-0 bg-white/90 backdrop-blur-xl'>
                                    <span className='text-sm font-semibold text-[#0A0A0A]'>Previous Roadmaps</span>
                                    <button onClick={() => setHistoryOpen(false)} className='text-black/35 hover:text-[#0A0A0A] transition-colors'><FiX size={16} /></button>
                                </div>

                                <div className='flex flex-col gap-2 p-3'>
                                    {historyLoading ? (
                                        <p className="text-xs text-black/35 text-center py-6">Loading…</p>
                                    )
                                        : history.length === 0 ?
                                            (
                                                <p className="text-xs text-black/35 text-center py-6">No roadmaps yet.</p>
                                            ) :
                                            (
                                                history.map((h, i) => (
                                                    <button key={i} onClick={()=>{
                                                        getRoadmapById(h._id);
                                                        setHistoryOpen(false)
                                                    }} className='relative overflow-hidden text-left p-4 rounded-xl bg-[#000]/90 border border-white/10'>
                                                        <h3 className='text-white font-semibold'>{h.title}</h3>
                                                        <div className='flex justify-between items-center my-1'>
                                                            <span className='text-violet-400 text-xs'>{h.targetPackage}</span>
                                                            <p className='text-xs text-white/40'>{h.duration}</p>
                                                        </div>

                                                        <p className='text-xs text-white/30 mt-1'>
                                                        {new Date(h.createdAt).toLocaleDateString()}</p>
                                                    </button>
                                                ))
                                            )}
                                </div>
                            </motion.aside>
                        </>
                    )
                }
            </AnimatePresence>

            {/* Resume Upload / Replacement Modal */}
            <AnimatePresence>
                {showResumeModal && (
                    <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm'>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 15 }}
                            transition={{ duration: 0.2 }}
                            className='w-full max-w-md rounded-2xl bg-[#0E1016] border border-white/10 p-5 sm:p-6 shadow-[0_10px_40px_rgba(0,0,0,0.5)] flex flex-col gap-4 text-white'>
                            
                            <div className='flex items-center justify-between border-b border-white/10 pb-3'>
                                <div className='flex items-center gap-2.5'>
                                    <div className='w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center'>
                                        {resume ? <FiRefreshCw className='text-emerald-400' size={16} /> : <FiUploadCloud className='text-emerald-400' size={16} />}
                                    </div>
                                    <h3 className='text-sm font-semibold text-white'>
                                        {resume ? "Replace / Update Resume" : "Attach Resume for Roadmap"}
                                    </h3>
                                </div>
                                <button 
                                    onClick={() => { setShowResumeModal(false); setModalFile(null); setModalError(""); }} 
                                    className='p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition'>
                                    <FiX size={16} />
                                </button>
                            </div>

                            <p className='text-xs text-zinc-400 leading-relaxed'>
                                {resume 
                                    ? `Upload a newer resume PDF to replace your current resume (${resume.suggestedRole || "Stored Resume"}) and personalize upcoming roadmaps with updated skills.`
                                    : "Upload your resume PDF to personalize this roadmap based on your current skills, projects, and detected gaps."}
                            </p>

                            <label className='cursor-pointer flex flex-col items-center justify-center border-2 border-dashed border-white/15 hover:border-white/30 rounded-xl p-6 transition-all bg-white/[0.02] hover:bg-white/[0.04]'>
                                <FiUploadCloud size={28} className={modalFile ? 'text-emerald-400' : 'text-zinc-500'} />
                                <span className='mt-2.5 text-xs font-medium text-zinc-200 text-center max-w-[280px] truncate'>
                                    {modalFile ? modalFile.name : (resume ? "Click to select a new resume (PDF)" : "Click to select your resume (PDF)")}
                                </span>
                                <span className='text-[10px] text-zinc-500 mt-1'>Max size: 5MB • Costs 10 Coins</span>
                                <input 
                                    type='file' 
                                    accept='.pdf' 
                                    className='hidden' 
                                    onChange={(e) => {
                                        if (e.target.files?.[0]) {
                                            setModalFile(e.target.files[0]);
                                            setModalError("");
                                        }
                                    }} 
                                />
                            </label>

                            {modalError && (
                                <p className='text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2.5'>
                                    {modalError}
                                </p>
                            )}

                            <div className='flex items-center justify-end gap-2.5 pt-2 border-t border-white/5'>
                                <button
                                    type='button'
                                    onClick={() => { setShowResumeModal(false); setModalFile(null); setModalError(""); }}
                                    className='px-3.5 py-2 rounded-xl text-xs text-zinc-400 hover:text-white transition'>
                                    Cancel
                                </button>
                                <button
                                    type='button'
                                    onClick={handleModalUpload}
                                    disabled={!modalFile || modalUploading}
                                    className='px-4 py-2 rounded-xl text-xs font-semibold bg-white text-black hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition'>
                                    {modalUploading ? "Analyzing Resume..." : (resume ? "Analyze & Replace" : "Upload & Attach")}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}

export default Roadmap
