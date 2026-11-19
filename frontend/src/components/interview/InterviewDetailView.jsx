import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    FiArrowLeft,
    FiCheckCircle,
    FiClock,
    FiCode,
    FiUser,
    FiPlay,
    FiChevronDown,
    FiChevronUp,
    FiAlertCircle,
    FiFileText,
    FiAward,
    FiTrendingUp,
    FiTarget,
    FiVideo,
    FiLock
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { getInterview } from '../../apis/interview.api';

function InterviewDetailView({ interviewId, onBack }) {
    const navigate = useNavigate();
    const [interview, setInterview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedQuestions, setExpandedQuestions] = useState({});

    useEffect(() => {
        let isMounted = true;

        const fetchDetails = async () => {
            if (!interviewId) return;
            setLoading(true);
            setError(null);
            try {
                const response = await getInterview(interviewId);
                if (!isMounted) return;

                if (response && response.interview) {
                    setInterview(response.interview);

                    // Default all questions to expanded for immediate readability
                    const initialExpanded = {};
                    (response.interview.questions || []).forEach((_, idx) => {
                        initialExpanded[idx] = true;
                    });
                    setExpandedQuestions(initialExpanded);
                } else {
                    setError(response?.message || 'Failed to load interview details.');
                }
            } catch (err) {
                if (isMounted) {
                    console.error('Error fetching interview details:', err);
                    setError('An unexpected error occurred while loading the interview.');
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchDetails();

        return () => {
            isMounted = false;
        };
    }, [interviewId]);

    const toggleQuestion = (index) => {
        setExpandedQuestions((prev) => ({
            ...prev,
            [index]: !prev[index],
        }));
    };

    const toggleAll = (expand) => {
        if (!interview?.questions) return;
        const updated = {};
        interview.questions.forEach((_, idx) => {
            updated[idx] = expand;
        });
        setExpandedQuestions(updated);
    };

    const isAllExpanded =
        interview?.questions &&
        interview.questions.length > 0 &&
        interview.questions.every((_, idx) => Boolean(expandedQuestions[idx]));

    if (loading) {
        return (
            <div className="w-full py-16 flex flex-col items-center justify-center">
                <div className="w-10 h-10 rounded-full border-4 border-black/10 border-t-black animate-spin mb-3" />
                <p className="text-xs text-black/50 font-medium">Loading interview transcript and evaluation...</p>
            </div>
        );
    }

    if (error || !interview) {
        return (
            <div className="bg-[#0E1016] border border-white/10 rounded-2xl p-8 md:p-12 text-center shadow-xl max-w-xl mx-auto my-6">
                <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto mb-4">
                    <FiAlertCircle size={24} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Unable to Load Interview Session</h3>
                <p className="text-xs md:text-sm text-zinc-400 mb-6">{error || 'Interview session data is not available.'}</p>
                <button
                    onClick={onBack}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition inline-flex items-center gap-2"
                >
                    <FiArrowLeft size={14} />
                    <span>Return to Interview History</span>
                </button>
            </div>
        );
    }

    const isCompleted = interview.status === 'completed';
    const isLive = Boolean(
        interview?.isLive === true ||
        interview?.isLiveInterview === true ||
        String(interview?.mode).toUpperCase() === 'LIVE' ||
        String(interview?.type).toUpperCase() === 'LIVE'
    );
    const totalQuestions = interview.questions?.length || 0;
    const answeredCount = (interview.questions || []).filter(
        (q) => q.userAnswer && typeof q.userAnswer === 'string' && q.userAnswer.trim().length > 0
    ).length;

    const formattedDate = interview.createdAt
        ? new Date(interview.createdAt).toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
          })
        : 'Recent Session';

    const normalizeStringList = (input) => {
        if (!input) return [];
        if (Array.isArray(input)) return input.map((s) => String(s).trim()).filter(Boolean);
        if (typeof input === 'string' && input.trim()) {
            return input.split(/[\r\n,]+/).map((s) => s.trim()).filter(Boolean);
        }
        return [];
    };

    const resolvedStrengths =
        normalizeStringList(interview.strengths).length > 0
            ? normalizeStringList(interview.strengths)
            : normalizeStringList(interview.evaluation?.strengths).length > 0
            ? normalizeStringList(interview.evaluation?.strengths)
            : normalizeStringList(interview.candidateStrengths).length > 0
            ? normalizeStringList(interview.candidateStrengths)
            : normalizeStringList(interview.summary?.strengths);

    const resolvedImprovements =
        normalizeStringList(interview.improvements).length > 0
            ? normalizeStringList(interview.improvements)
            : normalizeStringList(interview.areasForImprovement).length > 0
            ? normalizeStringList(interview.areasForImprovement)
            : normalizeStringList(interview.weaknesses).length > 0
            ? normalizeStringList(interview.weaknesses)
            : normalizeStringList(interview.evaluation?.improvements).length > 0
            ? normalizeStringList(interview.evaluation?.improvements)
            : normalizeStringList(interview.evaluation?.areasForImprovement).length > 0
            ? normalizeStringList(interview.evaluation?.areasForImprovement)
            : normalizeStringList(interview.evaluation?.weaknesses).length > 0
            ? normalizeStringList(interview.evaluation?.weaknesses)
            : normalizeStringList(interview.summary?.improvements).length > 0
            ? normalizeStringList(interview.summary?.improvements)
            : normalizeStringList(interview.summary?.areasForImprovement).length > 0
            ? normalizeStringList(interview.summary?.areasForImprovement)
            : normalizeStringList(interview.summary?.weaknesses);

    const strengthsList = resolvedStrengths;
    const improvementsList = resolvedImprovements;

    const rubricCriteria = interview.criteria || interview.evaluation?.criteria || null;
    const hasRubric = Boolean(
        rubricCriteria &&
        (typeof rubricCriteria.correctness === 'number' ||
         typeof rubricCriteria.problemSolving === 'number' ||
         typeof rubricCriteria.efficiency === 'number' ||
         typeof rubricCriteria.clarity === 'number' ||
         typeof rubricCriteria.relevance === 'number' ||
         typeof rubricCriteria.communication === 'number')
    );

    const RUBRIC_CRITERIA_CONFIG = [
        {
            key: 'correctness',
            label: 'Correctness',
            weight: '25%',
            description: 'Technical accuracy of solutions, conceptual soundness, and handling of edge cases.',
        },
        {
            key: 'problemSolving',
            label: 'Problem Solving',
            weight: '25%',
            description: 'Analytical decomposition, methodical approach to algorithmic challenges, and troubleshooting.',
        },
        {
            key: 'efficiency',
            label: 'Efficiency & Complexity',
            weight: '15%',
            description: 'Optimal time and space complexity, scalable design, and resource-conscious implementation.',
        },
        {
            key: 'clarity',
            label: 'Clarity & Structure',
            weight: '15%',
            description: 'Clean code architecture, readability, naming conventions, and modular problem breakdown.',
        },
        {
            key: 'relevance',
            label: 'Technical Relevance',
            weight: '10%',
            description: 'Alignment with modern industry standards, domain conventions, and relevant frameworks.',
        },
        {
            key: 'communication',
            label: 'Communication',
            weight: '10%',
            description: 'Articulation of thoughts, collaborative responsiveness, and reasoning explanations.',
        },
    ];

    const getRubricTier = (score) => {
        if (score >= 85) {
            return {
                label: 'Strong Performance',
                badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
            };
        }
        if (score >= 70) {
            return {
                label: 'Proficient Competence',
                badgeClass: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
            };
        }
        if (score >= 50) {
            return {
                label: 'Moderate Competence',
                badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
            };
        }
        return {
            label: 'Needs Practice',
            badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        };
    };

    const rubricTier = getRubricTier(interview.overallScore || 0);

    return (
        <div className="w-full space-y-6">
            {/* Top Navigation Bar */}
            <div className="flex items-center justify-between gap-3">
                <button
                    onClick={onBack}
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white hover:bg-zinc-100 text-[#0A0A0A] text-xs font-semibold border border-black/10 transition shadow-sm"
                >
                    <FiArrowLeft size={14} />
                    <span>Back to Interview History</span>
                </button>

                {!isCompleted && !isLive && (
                    <button
                        onClick={() => navigate(`/interview/${interview._id}`)}
                        className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
                    >
                        <FiPlay size={12} />
                        <span>Resume Session Now</span>
                    </button>
                )}
            </div>

            {/* Top Executive Summary Banner (Dark Obsidian Card) */}
            <div className="bg-[#0E1016] border border-white/10 rounded-2xl p-6 sm:p-7 shadow-xl text-white">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                    {/* Left: Role, Type, Status, Date */}
                    <div className="flex-1 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                            {isLive ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40">
                                    <FiVideo size={13} /> Live Faculty Interview
                                </span>
                            ) : (
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                                    interview.type === 'technical'
                                        ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                                        : 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                                }`}>
                                    {interview.type === 'technical' ? <FiCode size={13} /> : <FiUser size={13} />}
                                    {interview.type === 'technical' ? 'Technical Evaluation' : 'HR & Behavioral Track'}
                                </span>
                            )}

                            {isCompleted ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                    <FiCheckCircle size={13} /> Completed Session
                                </span>
                            ) : isLive ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                    <span className="w-2 h-2 rounded-full bg-rose-400" /> Not Completed
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" /> In Progress ({answeredCount}/{totalQuestions} Solved)
                                </span>
                            )}

                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-zinc-300">
                                {isLive
                                    ? `Evaluated by ${interview.trainerName || 'Faculty Instructor'}`
                                    : (interview.useResume ? 'Tailored to Resume' : 'Standard Taxonomy')}
                            </span>
                        </div>

                        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                            {interview.role || 'Software Engineering Track'}
                        </h1>

                        {isLive && (
                            <div className="bg-[#17181E] border border-white/5 rounded-xl p-3 inline-flex flex-wrap items-center gap-4 text-xs">
                                <div>
                                    <span className="text-[10px] text-zinc-400 uppercase tracking-wider block font-semibold">Candidate</span>
                                    <span className="text-white font-bold">{interview.studentName || "Candidate"}</span>
                                    {(interview.studentRollNumber || interview.rollNumber || interview.candidateRollNumber) && (
                                        <span className="text-zinc-400 ml-1.5 font-mono">
                                            ({interview.studentRollNumber || interview.rollNumber || interview.candidateRollNumber})
                                        </span>
                                    )}
                                </div>
                                <div>
                                    <span className="text-[10px] text-zinc-400 uppercase tracking-wider block font-semibold">University Roll No.</span>
                                    <span className="text-zinc-300 font-mono text-[11px]">
                                        {interview.studentRollNumber || interview.rollNumber || interview.candidateRollNumber || interview.student?.rollNumber || "N/A"}
                                    </span>
                                </div>
                                {interview.trainerName && (
                                    <div>
                                        <span className="text-[10px] text-zinc-400 uppercase tracking-wider block font-semibold">Conducted By</span>
                                        <span className="text-purple-300 font-bold">{interview.trainerName}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        <p className="text-xs sm:text-sm text-zinc-400 flex items-center gap-2">
                            <FiClock size={13} />
                            <span>Conducted on {formattedDate}</span>
                            <span>•</span>
                            <span>{totalQuestions} Total Questions</span>
                        </p>
                    </div>

                    {/* Right: Score or Resume Action */}
                    <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end justify-between gap-4">
                        {isCompleted ? (
                            <div className="bg-[#17181E] border border-white/10 rounded-2xl px-6 py-4 text-center min-w-[160px]">
                                <span className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider block mb-1">
                                    Overall Score
                                </span>
                                <div className="text-3xl font-black text-white">
                                    {interview.overallScore ?? 0}
                                    <span className="text-sm font-normal text-zinc-500"> / 100</span>
                                </div>
                                <span className={`text-[11px] font-semibold mt-1 inline-block ${
                                    (interview.overallScore ?? 0) >= 75
                                        ? 'text-emerald-400'
                                        : (interview.overallScore ?? 0) >= 50
                                        ? 'text-amber-400'
                                        : 'text-red-400'
                                }`}>
                                    {(interview.overallScore ?? 0) >= 75
                                        ? 'Strong Performance'
                                        : (interview.overallScore ?? 0) >= 50
                                        ? 'Moderate Competence'
                                        : 'Needs Preparation'}
                                </span>
                            </div>
                        ) : isLive ? (
                            <div className="bg-[#17181E] border border-white/10 rounded-2xl p-4 min-w-[200px]">
                                <span className="text-xs text-rose-400 font-semibold block mb-1">
                                    Session Not Completed
                                </span>
                                <p className="text-xs text-zinc-300">
                                    Live session was concluded without final evaluation scoring.
                                </p>
                            </div>
                        ) : (
                            <div className="bg-[#17181E] border border-amber-500/20 rounded-2xl p-4 min-w-[200px]">
                                <span className="text-xs text-amber-400 font-semibold block mb-1">
                                    Session In Progress
                                </span>
                                <p className="text-xs text-zinc-300 mb-3">
                                    {totalQuestions - answeredCount} question(s) pending candidate response.
                                </p>
                                <button
                                    onClick={() => navigate(`/interview/${interview._id}`)}
                                    className="w-full px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                    <FiPlay size={12} />
                                    <span>Resume Session Now</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Executive Summary Details (if available) */}
                {interview.summary && (
                    <div className="mt-6 pt-6 border-t border-white/10">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center gap-1.5">
                            <FiFileText size={13} className="text-zinc-400" />
                            <span>Executive Summary</span>
                        </h4>
                        <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed bg-[#17181E] border border-white/5 p-4 rounded-xl">
                            {interview.summary}
                        </p>
                    </div>
                )}

                {/* Candidate Strengths & Areas for Improvement (Trainer Feedback for Student & Trainer) */}
                {(strengthsList.length > 0 || improvementsList.length > 0) && (
                    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${interview.summary ? 'pt-4' : 'mt-6 pt-6 border-t border-white/10'}`}>
                        {strengthsList.length > 0 && (
                            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 sm:p-5 shadow-sm">
                                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2.5">
                                    <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                                        <FiTrendingUp size={12} />
                                    </div>
                                    <span>Candidate Strengths</span>
                                </div>
                                <ul className="space-y-2 text-xs text-zinc-200">
                                    {strengthsList.map((str, idx) => (
                                        <li key={idx} className="flex items-start gap-2 leading-relaxed">
                                            <span className="text-emerald-400 font-bold mt-0.5">•</span>
                                            <span>{str}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {improvementsList.length > 0 && (
                            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 sm:p-5 shadow-sm">
                                <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider mb-2.5">
                                    <div className="w-5 h-5 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400">
                                        <FiTarget size={12} />
                                    </div>
                                    <span>Areas for Improvement</span>
                                </div>
                                <ul className="space-y-2 text-xs text-zinc-200">
                                    {improvementsList.map((weak, idx) => (
                                        <li key={idx} className="flex items-start gap-2 leading-relaxed">
                                            <span className="text-amber-400 font-bold mt-0.5">•</span>
                                            <span>{weak}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Confidential Trainer Evaluator Notes (Trainer / Admin Only) */}
            {interview.trainerPrivateNotes && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 sm:p-6 shadow-xl">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400 mb-2.5">
                        <FiLock size={15} />
                        <span>Confidential Evaluator Notes (Hidden from Student)</span>
                    </div>
                    <p className="text-xs sm:text-sm text-amber-100/90 whitespace-pre-wrap leading-relaxed bg-black/40 border border-amber-500/20 p-4 rounded-xl">
                        {interview.trainerPrivateNotes}
                    </p>
                </div>
            )}

            {/* Dedicated Session-Level Trainer Rubric Hero Card */}
            {hasRubric && isCompleted && (
                <div className="bg-[#111318] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5 text-white">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                <h3 className="text-base sm:text-lg font-bold tracking-tight text-white">
                                    Trainer Evaluation Rubric Breakdown
                                </h3>
                            </div>
                            <p className="text-xs text-zinc-400">
                                Standardized dimensional assessment graded by faculty instructor across 6 industry criteria.
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${rubricTier.badgeClass}`}>
                                {rubricTier.label}
                            </span>
                            <div className="bg-[#17181E] border border-white/10 px-3.5 py-1.5 rounded-xl text-center">
                                <span className="text-[10px] text-zinc-400 uppercase tracking-wider block font-semibold">Weighted Composite</span>
                                <span className="text-sm font-black text-white">{interview.overallScore ?? 0} / 100</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                        {RUBRIC_CRITERIA_CONFIG.map((metric) => {
                            const rawScore = rubricCriteria[metric.key];
                            const score = typeof rawScore === 'number' ? Math.max(0, Math.min(100, Math.round(rawScore))) : 0;
                            const isHigh = score >= 75;
                            const isMid = score >= 50;

                            return (
                                <div
                                    key={metric.key}
                                    className="bg-[#17181E] border border-white/5 hover:border-white/15 rounded-xl p-4 transition-all duration-200 group flex flex-col justify-between"
                                >
                                    <div>
                                        <div className="flex items-center justify-between gap-2 mb-1.5">
                                            <span className="text-xs font-bold text-white group-hover:text-emerald-300 transition">
                                                {metric.label}
                                            </span>
                                            <span className="text-[10px] font-semibold text-zinc-400 bg-white/5 px-2 py-0.5 rounded border border-white/5">
                                                {metric.weight}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-zinc-400 leading-snug mb-3">
                                            {metric.description}
                                        </p>
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-sans font-semibold">Criterion Score</span>
                                            <span className={`font-bold ${isHigh ? 'text-emerald-400' : isMid ? 'text-amber-400' : 'text-rose-400'}`}>
                                                {score} / 100
                                            </span>
                                        </div>
                                        <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-700 ease-out ${
                                                    isHigh
                                                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                                        : isMid
                                                        ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                                                        : 'bg-gradient-to-r from-rose-500 to-red-400'
                                                }`}
                                                style={{ width: `${score}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Question-by-Question Transcript & Evaluation Section */}
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h3 className="text-lg md:text-xl font-bold text-[#0A0A0A]">
                            Question Transcript & AI Feedback
                        </h3>
                        <p className="text-xs text-black/50">
                            Examine full candidate responses, submitted code solutions, and dimensional AI criteria scores.
                        </p>
                    </div>

                    <button
                        onClick={() => toggleAll(!isAllExpanded)}
                        className="self-start sm:self-auto px-3.5 py-1.5 rounded-xl bg-white hover:bg-zinc-100 text-[#0A0A0A] text-xs font-semibold border border-black/10 transition shadow-sm inline-flex items-center gap-1.5"
                    >
                        {isAllExpanded ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
                        <span>{isAllExpanded ? 'Collapse All' : 'Expand All'}</span>
                    </button>
                </div>

                {/* Questions List */}
                <div className="space-y-4">
                    {(interview.questions || []).map((q, idx) => {
                        const isExpanded = Boolean(expandedQuestions[idx]);
                        const rawAnswer = q.userAnswer || q.answer || q.studentAnswer || '';
                        const hasAnswer = Boolean(rawAnswer && typeof rawAnswer === 'string' && rawAnswer.trim().length > 0);

                        const qScore = typeof q.score === 'number'
                            ? q.score
                            : (typeof q.feedback?.score === 'number' ? q.feedback.score : null);

                        const feedbackText = q.aiFeedback || (typeof q.feedback === 'string' ? q.feedback : q.feedback?.feedback) || '';
                        const hasFeedback = Boolean(feedbackText || qScore !== null);

                        // Check if answer contains formatted code
                        const hasCodeBlock = (hasAnswer && rawAnswer.includes('--- Code ---')) || Boolean(q.code || q.submittedCode);
                        let textPart = rawAnswer;
                        let codePart = q.code || q.submittedCode || '';

                        if (rawAnswer.includes('--- Code ---')) {
                            const parts = rawAnswer.split('--- Code ---');
                            textPart = parts[0]?.trim() || '';
                            codePart = parts.slice(1).join('--- Code ---')?.trim() || q.code || q.submittedCode || '';
                        }

                        return (
                            <div
                                key={idx}
                                className="bg-[#0E1016] border border-white/10 rounded-2xl overflow-hidden shadow-md transition-all duration-200"
                            >
                                {/* Clickable Question Header */}
                                <button
                                    onClick={() => toggleQuestion(idx)}
                                    className="w-full p-4 sm:p-5 text-left flex items-start justify-between gap-3 hover:bg-white/[0.02] transition"
                                >
                                    <div className="flex items-start gap-3 flex-1">
                                        <span className="px-2.5 py-1 rounded-lg bg-white/10 text-white font-mono text-xs font-bold shrink-0 mt-0.5">
                                            Q{idx + 1}
                                        </span>

                                        <div className="flex-1">
                                            <p className="text-sm sm:text-base font-bold text-white leading-snug">
                                                {q.question}
                                            </p>

                                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-white/5 text-zinc-400 border border-white/10">
                                                    {q.difficulty || 'medium'}
                                                </span>

                                                {hasAnswer ? (
                                                    <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                                                        <FiCheckCircle size={10} /> Answered
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                                                        Unanswered
                                                    </span>
                                                )}

                                                {qScore !== null && qScore !== undefined && (
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                                        qScore >= 75
                                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                            : qScore >= 50
                                                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                                    }`}>
                                                        Score: {qScore}/100
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-white/40 hover:text-white mt-1 shrink-0">
                                        {isExpanded ? <FiChevronUp size={18} /> : <FiChevronDown size={18} />}
                                    </div>
                                </button>

                                {/* Collapsible Details Body */}
                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{ duration: 0.25 }}
                                            className="px-4 sm:px-5 pb-5 pt-2 border-t border-white/5 space-y-4"
                                        >
                                            {/* Candidate's Answer Block */}
                                            <div>
                                                <h5 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
                                                    Candidate's Submitted Answer
                                                </h5>

                                                {hasAnswer ? (
                                                    <div className="space-y-3">
                                                        {textPart && (
                                                            <div className="bg-[#17181E] border border-white/5 p-4 rounded-xl text-xs sm:text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed">
                                                                {textPart}
                                                            </div>
                                                        )}

                                                        {hasCodeBlock && codePart && (
                                                            <div>
                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block mb-1">
                                                                    Submitted Code
                                                                </span>
                                                                <pre className="bg-black/80 border border-white/10 p-4 rounded-xl text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed">
                                                                    {codePart}
                                                                </pre>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-zinc-500 italic bg-[#17181E] border border-white/5 p-4 rounded-xl">
                                                        Candidate has not submitted an answer for this question yet.
                                                    </p>
                                                )}
                                            </div>

                                            {/* AI Feedback & Score Breakdown (if available) */}
                                            {hasFeedback && (
                                                <div className="bg-[#17181E] border border-white/5 rounded-xl p-4 sm:p-5 space-y-3">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <h5 className="text-[11px] font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                                                            <FiAward size={13} />
                                                            <span>AI Evaluation Feedback</span>
                                                        </h5>

                                                        {qScore !== null && qScore !== undefined && (
                                                            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                                                                qScore >= 75
                                                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                                                    : qScore >= 50
                                                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                                                    : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                                            }`}>
                                                                {qScore} / 100
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Feedback Text */}
                                                    {feedbackText && (
                                                        <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed pt-1">
                                                            {feedbackText}
                                                        </p>
                                                    )}

                                                    {/* Improvements */}
                                                    {Array.isArray(q.feedback?.improvements) && q.feedback.improvements.length > 0 && (
                                                        <div className="pt-2">
                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block mb-1">
                                                                Constructive Suggestions
                                                            </span>
                                                            <ul className="list-disc list-inside space-y-1 text-xs text-zinc-300">
                                                                {q.feedback.improvements.map((imp, impIdx) => (
                                                                    <li key={impIdx}>{imp}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export default InterviewDetailView;
