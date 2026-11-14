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
    FiTarget
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

                {!isCompleted && (
                    <button
                        onClick={() => navigate(`/interview/${interview._id}`)}
                        className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition shadow-sm inline-flex items-center gap-1.5"
                    >
                        <FiPlay size={12} />
                        <span>Resume Live Interview</span>
                    </button>
                )}
            </div>

            {/* Top Executive Summary Banner (Dark Obsidian Card) */}
            <div className="bg-[#0E1016] border border-white/10 rounded-2xl p-6 sm:p-7 shadow-xl text-white">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                    {/* Left: Role, Type, Status, Date */}
                    <div className="flex-1 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                                interview.type === 'technical'
                                    ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                                    : 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                            }`}>
                                {interview.type === 'technical' ? <FiCode size={13} /> : <FiUser size={13} />}
                                {interview.type === 'technical' ? 'Technical Evaluation' : 'HR & Behavioral Track'}
                            </span>

                            {isCompleted ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                    <FiCheckCircle size={13} /> Completed Session
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" /> In Progress ({answeredCount}/{totalQuestions} Solved)
                                </span>
                            )}

                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-zinc-300">
                                {interview.useResume ? 'Tailored to Resume' : 'Standard Taxonomy'}
                            </span>
                        </div>

                        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                            {interview.role || 'Software Engineering Track'}
                        </h1>

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
                                    {interview.overallScore || 0}
                                    <span className="text-sm font-normal text-zinc-500"> / 100</span>
                                </div>
                                <span className={`text-[11px] font-semibold mt-1 inline-block ${
                                    (interview.overallScore || 0) >= 75
                                        ? 'text-emerald-400'
                                        : (interview.overallScore || 0) >= 50
                                        ? 'text-amber-400'
                                        : 'text-red-400'
                                }`}>
                                    {(interview.overallScore || 0) >= 75
                                        ? 'Strong Performance'
                                        : (interview.overallScore || 0) >= 50
                                        ? 'Moderate Competence'
                                        : 'Needs Preparation'}
                                </span>
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
                                    className="w-full px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition shadow-sm flex items-center justify-center gap-1.5"
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
                    <div className="mt-6 pt-6 border-t border-white/10 space-y-4">
                        <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                                Executive Summary
                            </h4>
                            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed bg-[#17181E] border border-white/5 p-4 rounded-xl">
                                {interview.summary}
                            </p>
                        </div>

                        {/* Strengths & Weaknesses Grids */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                            {interview.strengths && interview.strengths.length > 0 && (
                                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">
                                        <FiTrendingUp size={14} />
                                        <span>Candidate Strengths</span>
                                    </div>
                                    <ul className="space-y-1 text-xs text-zinc-300 list-disc list-inside">
                                        {interview.strengths.map((str, idx) => (
                                            <li key={idx} className="leading-relaxed">{str}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {interview.weaknesses && interview.weaknesses.length > 0 && (
                                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">
                                        <FiTarget size={14} />
                                        <span>Areas for Improvement</span>
                                    </div>
                                    <ul className="space-y-1 text-xs text-zinc-300 list-disc list-inside">
                                        {interview.weaknesses.map((weak, idx) => (
                                            <li key={idx} className="leading-relaxed">{weak}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Question-by-Question Transcript & AI Evaluation Section */}
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
                        const hasAnswer = Boolean(q.userAnswer && typeof q.userAnswer === 'string' && q.userAnswer.trim().length > 0);
                        const hasFeedback = Boolean(q.feedback && (q.feedback.feedback || q.feedback.score));

                        // Check if answer contains formatted code
                        const hasCodeBlock = hasAnswer && q.userAnswer.includes('--- Code ---');
                        let textPart = q.userAnswer || '';
                        let codePart = '';

                        if (hasCodeBlock) {
                            const parts = q.userAnswer.split('--- Code ---');
                            textPart = parts[0]?.trim() || '';
                            codePart = parts.slice(1).join('--- Code ---')?.trim() || '';
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

                                                {q.feedback?.score !== undefined && (
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                        Score: {q.feedback.score}/100
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

                                                        {q.feedback.score !== undefined && (
                                                            <span className="text-xs font-bold text-white bg-blue-500/20 px-2.5 py-0.5 rounded-full border border-blue-500/30">
                                                                {q.feedback.score} / 100
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Metric Criteria Badges */}
                                                    <div className="flex flex-wrap gap-2 text-[10px] text-zinc-300">
                                                        {q.feedback.correctness !== undefined && (
                                                            <span className="bg-white/5 px-2 py-0.5 rounded border border-white/5">
                                                                Correctness: <b>{q.feedback.correctness}</b>
                                                            </span>
                                                        )}
                                                        {q.feedback.clarity !== undefined && (
                                                            <span className="bg-white/5 px-2 py-0.5 rounded border border-white/5">
                                                                Clarity: <b>{q.feedback.clarity}</b>
                                                            </span>
                                                        )}
                                                        {q.feedback.relevance !== undefined && (
                                                            <span className="bg-white/5 px-2 py-0.5 rounded border border-white/5">
                                                                Relevance: <b>{q.feedback.relevance}</b>
                                                            </span>
                                                        )}
                                                        {q.feedback.detail !== undefined && (
                                                            <span className="bg-white/5 px-2 py-0.5 rounded border border-white/5">
                                                                Detail: <b>{q.feedback.detail}</b>
                                                            </span>
                                                        )}
                                                        {q.feedback.efficiency !== undefined && (
                                                            <span className="bg-white/5 px-2 py-0.5 rounded border border-white/5">
                                                                Efficiency: <b>{q.feedback.efficiency}</b>
                                                            </span>
                                                        )}
                                                        {q.feedback.communication !== undefined && (
                                                            <span className="bg-white/5 px-2 py-0.5 rounded border border-white/5">
                                                                Communication: <b>{q.feedback.communication}</b>
                                                            </span>
                                                        )}
                                                        {q.feedback.problemSolving !== undefined && (
                                                            <span className="bg-white/5 px-2 py-0.5 rounded border border-white/5">
                                                                Problem Solving: <b>{q.feedback.problemSolving}</b>
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Feedback Text */}
                                                    {q.feedback.feedback && (
                                                        <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed pt-1">
                                                            {q.feedback.feedback}
                                                        </p>
                                                    )}

                                                    {/* Improvements */}
                                                    {q.feedback.improvements && q.feedback.improvements.length > 0 && (
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
