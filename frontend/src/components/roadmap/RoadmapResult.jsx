import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  FiCheckCircle,
  FiClock,
  FiCompass,
  FiMap,
  FiRefreshCw,
  FiShare2,
  FiTarget,
  FiTrendingUp,
  FiX,
  FiZap,
} from 'react-icons/fi';
import ModuleCard from './ModuleCard';

function RoadmapResult({ roadmap, onClear }) {
  const roadmapKey = `roadmap_progress_${roadmap._id || roadmap.title}`;

  // Local storage persistence for module completion checkmarks
  const [completedIndices, setCompletedIndices] = useState(() => {
    try {
      const saved = localStorage.getItem(roadmapKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(roadmapKey, JSON.stringify(completedIndices));
    } catch {
      // ignore storage write errors
    }
  }, [completedIndices, roadmapKey]);

  const toggleComplete = (idx) => {
    setCompletedIndices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const totalModules = roadmap.modules?.length || 0;
  const completedCount = completedIndices.length;
  const progressPercent = totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* 1. OBSIDIAN ROADMAP SUMMARY BANNER */}
      <div className="bg-[#111318] text-white rounded-3xl p-6 sm:p-8 shadow-md border border-gray-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          {/* Header Row */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-0.5 rounded-full">
                  Verified Curriculum
                </span>
                <span className="text-xs text-gray-300 font-medium">
                  Target: <strong className="text-white">{roadmap.targetPackage}</strong>
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                {roadmap.title}
              </h1>
            </div>

            <button
              onClick={onClear}
              className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              title="Close and create a new roadmap"
            >
              <FiX size={18} />
            </button>
          </div>

          {/* 3 Metric Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-5">
            <div className="rounded-xl p-3.5 bg-white/5 border border-white/10 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-emerald-400 shrink-0">
                <FiTarget className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">
                  Difficulty Level
                </span>
                <span className="text-sm font-bold text-white">{roadmap.level || 'Intermediate'}</span>
              </div>
            </div>

            <div className="rounded-xl p-3.5 bg-white/5 border border-white/10 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-indigo-400 shrink-0">
                <FiClock className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">
                  Total Duration
                </span>
                <span className="text-sm font-bold text-white">{roadmap.duration || '12 Weeks'}</span>
              </div>
            </div>

            <div className="rounded-xl p-3.5 bg-white/5 border border-white/10 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-amber-400 shrink-0">
                <FiCheckCircle className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">
                  Curriculum Scope
                </span>
                <span className="text-sm font-bold text-white">{totalModules} Learning Modules</span>
              </div>
            </div>
          </div>

          {/* Interactive Live Progress Bar */}
          <div className="pt-4 border-t border-white/10">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-gray-300 font-medium flex items-center gap-1.5">
                <FiZap className="w-3.5 h-3.5 text-amber-400" />
                Live Learning Progress
              </span>
              <span className="text-emerald-400 font-semibold font-mono">
                {completedCount} / {totalModules} Modules ({progressPercent}%)
              </span>
            </div>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden p-[1px]">
              <motion.div
                className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-gray-400 mt-2">
              <span>Check off modules as you master each milestone</span>
              {progressPercent === 100 && (
                <span className="text-emerald-400 font-bold">🎉 Roadmap Completed!</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. TIMELINE LEARNING MODULES */}
      <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-sm">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-100 flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FiMap className="w-5 h-5 text-indigo-600" />
              Milestone Learning Timeline
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Step-by-step engineering curriculum with curated tutorials and documentation.
            </p>
          </div>

          <button
            onClick={onClear}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-800 transition cursor-pointer"
          >
            <FiRefreshCw className="w-3.5 h-3.5" />
            <span>New Roadmap</span>
          </button>
        </div>

        {/* Vertical Timeline Container */}
        <div className="relative">
          {/* Vertical Continuous Line */}
          <div className="absolute left-4 sm:left-5 top-5 bottom-5 w-0.5 bg-gray-200 pointer-events-none" />

          {/* Module Cards Stack */}
          <div className="space-y-6">
            {roadmap.modules?.map((m, i) => (
              <ModuleCard
                key={`${m.title}-${i}`}
                mod={m}
                index={i}
                isCompleted={completedIndices.includes(i)}
                onToggleComplete={toggleComplete}
              />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default RoadmapResult;
