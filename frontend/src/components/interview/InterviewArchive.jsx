import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    FiSearch,
    FiCheckCircle,
    FiClock,
    FiCode,
    FiUser,
    FiArrowRight,
    FiPlay,
    FiFileText,
    FiX,
    FiPlus,
    FiFilter
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

function InterviewArchive({ interviews = [], onSelectInterview, onNewInterview }) {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'completed' | 'in-progress'
    const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'technical' | 'hr'

    // Compute live filter badge counts
    const completedCount = interviews.filter((i) => i.status === 'completed').length;
    const inProgressCount = interviews.filter((i) => i.status === 'in-progress').length;
    const techCount = interviews.filter((i) => i.type === 'technical').length;
    const hrCount = interviews.filter((i) => i.type === 'hr').length;

    // Filter interviews
    const filteredInterviews = interviews.filter((interview) => {
        const query = searchQuery.trim().toLowerCase();
        const matchesSearch =
            !query ||
            interview.role?.toLowerCase().includes(query) ||
            interview.summary?.toLowerCase().includes(query);

        const matchesStatus =
            statusFilter === 'all' || interview.status === statusFilter;

        const matchesType =
            typeFilter === 'all' || interview.type === typeFilter;

        return matchesSearch && matchesStatus && matchesType;
    });

    const resetFilters = () => {
        setSearchQuery('');
        setStatusFilter('all');
        setTypeFilter('all');
    };

    return (
        <div className="w-full">
            {/* Header Title & Subtitle */}
            <div className="mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h2 className="text-xl md:text-2xl font-bold text-[#0A0A0A] tracking-tight">
                            Interview Archive & Sessions
                        </h2>
                        <p className="text-xs md:text-sm text-black/50 mt-1">
                            Browse, search, and inspect detailed question transcripts, code submissions, and AI evaluation feedback.
                        </p>
                    </div>

                    <button
                        onClick={onNewInterview}
                        className="inline-flex items-center gap-2 self-start sm:self-auto px-4 py-2 rounded-xl bg-black text-white text-xs font-semibold hover:bg-zinc-800 transition shadow-sm"
                    >
                        <FiPlus size={14} />
                        <span>New Interview</span>
                    </button>
                </div>
            </div>

            {/* Search and Filters Bar */}
            <div className="bg-[#0E1016] border border-white/10 rounded-2xl p-4 md:p-5 shadow-lg mb-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Search Input */}
                    <div className="relative flex-1 max-w-lg">
                        <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" size={16} />
                        <input
                            type="text"
                            placeholder="Search by target role or domain (e.g. Backend, Frontend)..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-[#17181E] border border-white/10 rounded-xl pl-10 pr-9 py-2.5 text-xs sm:text-sm text-white placeholder-white/30 outline-none focus:border-white/30 transition"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition"
                            >
                                <FiX size={14} />
                            </button>
                        )}
                    </div>

                    {/* Filter Pills */}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        {/* Status Filters */}
                        <div className="flex items-center bg-[#17181E] border border-white/10 rounded-xl p-1 gap-1">
                            <button
                                onClick={() => setStatusFilter('all')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                                    statusFilter === 'all'
                                        ? 'bg-white text-black font-semibold shadow-sm'
                                        : 'text-zinc-400 hover:text-white'
                                }`}
                            >
                                All ({interviews.length})
                            </button>
                            <button
                                onClick={() => setStatusFilter('completed')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                                    statusFilter === 'completed'
                                        ? 'bg-emerald-500 text-white font-semibold shadow-sm'
                                        : 'text-zinc-400 hover:text-white'
                                }`}
                            >
                                Completed ({completedCount})
                            </button>
                            <button
                                onClick={() => setStatusFilter('in-progress')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                                    statusFilter === 'in-progress'
                                        ? 'bg-amber-500 text-black font-semibold shadow-sm'
                                        : 'text-zinc-400 hover:text-white'
                                }`}
                            >
                                In Progress ({inProgressCount})
                            </button>
                        </div>

                        {/* Type Filters */}
                        <div className="flex items-center bg-[#17181E] border border-white/10 rounded-xl p-1 gap-1">
                            <button
                                onClick={() => setTypeFilter('all')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                                    typeFilter === 'all'
                                        ? 'bg-white/20 text-white font-semibold'
                                        : 'text-zinc-400 hover:text-white'
                                }`}
                            >
                                All Types
                            </button>
                            <button
                                onClick={() => setTypeFilter('technical')}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                                    typeFilter === 'technical'
                                        ? 'bg-blue-600 text-white font-semibold'
                                        : 'text-zinc-400 hover:text-white'
                                }`}
                            >
                                <FiCode size={11} /> Technical ({techCount})
                            </button>
                            <button
                                onClick={() => setTypeFilter('hr')}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                                    typeFilter === 'hr'
                                        ? 'bg-purple-600 text-white font-semibold'
                                        : 'text-zinc-400 hover:text-white'
                                }`}
                            >
                                <FiUser size={11} /> HR ({hrCount})
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Scorecard Grid */}
            {filteredInterviews.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredInterviews.map((interview, index) => {
                        const isCompleted = interview.status === 'completed';
                        const totalQuestions = interview.questions?.length || 0;
                        const answeredQuestions = (interview.questions || []).filter(
                            (q) => q.userAnswer && typeof q.userAnswer === 'string' && q.userAnswer.trim().length > 0
                        ).length;

                        const progressPercent = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;
                        const score = interview.overallScore || 0;

                        const formattedDate = interview.createdAt
                            ? new Date(interview.createdAt).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                              })
                            : 'Recent';

                        return (
                            <motion.div
                                key={interview._id || index}
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, delay: index * 0.04 }}
                                className="bg-[#0E1016] border border-white/10 hover:border-white/25 rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all duration-300 hover:shadow-2xl group"
                            >
                                <div>
                                    {/* Header Row: Type pill + Status pill */}
                                    <div className="flex items-center justify-between gap-2 mb-3.5">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
                                            interview.type === 'technical'
                                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                                : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                        }`}>
                                            {interview.type === 'technical' ? <FiCode size={11} /> : <FiUser size={11} />}
                                            {interview.type === 'technical' ? 'Technical' : 'HR Track'}
                                        </span>

                                        {isCompleted ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                <FiCheckCircle size={11} /> Completed
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> In Progress
                                            </span>
                                        )}
                                    </div>

                                    {/* Target Role & Date */}
                                    <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-blue-300 transition-colors line-clamp-1 mb-1">
                                        {interview.role || 'Software Engineer'}
                                    </h3>

                                    <div className="flex items-center gap-2 text-xs text-zinc-400 mb-4">
                                        <span>{formattedDate}</span>
                                        <span>•</span>
                                        <span>{interview.useResume ? 'Resume Context' : 'Standard Track'}</span>
                                    </div>

                                    {/* Score / Progress Indicator */}
                                    <div className="bg-[#17181E] border border-white/5 rounded-xl p-3.5 mb-4">
                                        {isCompleted ? (
                                            <div>
                                                <div className="flex items-baseline justify-between mb-1.5">
                                                    <span className="text-xs text-zinc-400 font-medium">Evaluation Score</span>
                                                    <span className="text-lg font-bold text-white">
                                                        {score}
                                                        <span className="text-xs text-zinc-500 font-normal"> / 100</span>
                                                    </span>
                                                </div>
                                                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-500 ${
                                                            score >= 75
                                                                ? 'bg-emerald-400'
                                                                : score >= 50
                                                                ? 'bg-amber-400'
                                                                : 'bg-red-400'
                                                        }`}
                                                        style={{ width: `${Math.min(score, 100)}%` }}
                                                    />
                                                </div>
                                                {interview.strengths && interview.strengths.length > 0 && (
                                                    <p className="text-[11px] text-zinc-400 mt-2 truncate">
                                                        Highlights: {interview.strengths[0]}
                                                    </p>
                                                )}
                                            </div>
                                        ) : (
                                            <div>
                                                <div className="flex items-baseline justify-between mb-1.5">
                                                    <span className="text-xs text-amber-400 font-medium">Session Progress</span>
                                                    <span className="text-xs font-semibold text-white">
                                                        {answeredQuestions} / {totalQuestions} Solved
                                                    </span>
                                                </div>
                                                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-amber-400 rounded-full transition-all duration-500"
                                                        style={{ width: `${progressPercent}%` }}
                                                    />
                                                </div>
                                                <p className="text-[11px] text-zinc-400 mt-2">
                                                    Current: Question {(interview.currentQuestion || 0) + 1} Pending
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Card Footer CTA Actions */}
                                <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                                    <button
                                        onClick={() => onSelectInterview(interview._id)}
                                        className="text-xs font-semibold text-white/80 hover:text-white flex items-center gap-1.5 transition group-hover:translate-x-0.5 duration-200"
                                    >
                                        <span>{isCompleted ? 'Open Transcript & Report' : 'Inspect Session'}</span>
                                        <FiArrowRight size={13} />
                                    </button>

                                    {!isCompleted && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/interview/${interview._id}`);
                                            }}
                                            className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-[11px] font-bold flex items-center gap-1 transition shadow-sm"
                                        >
                                            <FiPlay size={10} />
                                            <span>Resume</span>
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            ) : (
                /* Empty / No Match State */
                <div className="bg-[#0E1016] border border-white/10 rounded-2xl p-10 md:p-14 text-center shadow-lg">
                    <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4 text-white/50">
                        {interviews.length === 0 ? <FiFileText size={26} /> : <FiSearch size={26} />}
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">
                        {interviews.length === 0
                            ? 'No Mock Interviews Yet'
                            : 'No Interviews Match Your Filters'}
                    </h3>
                    <p className="text-xs md:text-sm text-zinc-400 max-w-md mx-auto mb-6">
                        {interviews.length === 0
                            ? 'Start your first autonomous AI mock interview to practice role-specific technical and behavioral questions.'
                            : `We couldn't find any sessions matching your query "${searchQuery}" with the selected filters.`}
                    </p>

                    {interviews.length === 0 ? (
                        <button
                            onClick={onNewInterview}
                            className="px-5 py-2.5 rounded-xl bg-white text-black text-xs md:text-sm font-semibold hover:bg-zinc-200 transition shadow-sm inline-flex items-center gap-2"
                        >
                            <FiPlus size={15} />
                            <span>Start First Interview</span>
                        </button>
                    ) : (
                        <button
                            onClick={resetFilters}
                            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition inline-flex items-center gap-2"
                        >
                            <FiFilter size={13} />
                            <span>Reset Filters</span>
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

export default InterviewArchive;
