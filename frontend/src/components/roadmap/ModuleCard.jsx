import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  FiBookOpen,
  FiCheck,
  FiChevronDown,
  FiChevronUp,
  FiClock,
  FiExternalLink,
  FiPlayCircle,
  FiYoutube,
} from 'react-icons/fi';

const DIFFICULTY_CONFIG = {
  Easy: {
    color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    dot: 'bg-emerald-500',
    badge: 'Easy',
  },
  Medium: {
    color: 'text-indigo-700 bg-indigo-50 border-indigo-200',
    dot: 'bg-indigo-500',
    badge: 'Medium',
  },
  Hard: {
    color: 'text-rose-700 bg-rose-50 border-rose-200',
    dot: 'bg-rose-500',
    badge: 'Hard',
  },
};

function ModuleCard({ mod, index, isCompleted = false, onToggleComplete }) {
  const [open, setOpen] = useState(false);

  const diff = DIFFICULTY_CONFIG[mod.difficulty] || DIFFICULTY_CONFIG.Medium;
  const stepNum = String(index + 1).padStart(2, '0');

  return (
    <div className="relative pl-8 sm:pl-10">
      {/* Timeline Node Icon / Checkbox */}
      <div className="absolute left-0 top-5 -ml-[13px] sm:-ml-[15px] z-10">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (onToggleComplete) onToggleComplete(index);
          }}
          title={isCompleted ? 'Mark as incomplete' : 'Mark module as completed'}
          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer shadow-xs ${
            isCompleted
              ? 'bg-emerald-600 border-emerald-600 text-white shadow-emerald-500/20'
              : 'bg-white border-gray-300 text-gray-400 hover:border-gray-500 hover:text-gray-600'
          }`}
        >
          {isCompleted ? (
            <FiCheck className="w-4 h-4 font-bold" />
          ) : (
            <span className="text-[10px] font-bold font-mono text-gray-500">{stepNum}</span>
          )}
        </button>
      </div>

      {/* Elevated White Card */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05, duration: 0.3 }}
        className={`rounded-2xl border transition-all cursor-pointer select-none bg-white shadow-sm hover:shadow-md ${
          isCompleted
            ? 'border-emerald-200 bg-emerald-50/20'
            : 'border-gray-200 hover:border-gray-300'
        }`}
        onClick={() => setOpen(!open)}
      >
        {/* Module Header Bar */}
        <div className="flex items-center justify-between gap-3 p-4 sm:p-5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${diff.color}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${diff.dot}`} />
                {diff.badge}
              </span>

              <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 font-medium">
                <FiClock className="w-3 h-3 text-gray-400" />
                {mod.duration}
              </span>

              {isCompleted && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  <FiCheck className="w-3 h-3" /> Completed
                </span>
              )}
            </div>

            <h3
              className={`text-sm sm:text-base font-bold text-gray-900 truncate ${
                isCompleted ? 'text-gray-700 line-through decoration-emerald-500/40' : ''
              }`}
            >
              {mod.title}
            </h3>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
              aria-label={open ? 'Collapse module' : 'Expand module'}
            >
              {open ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
            </button>
          </div>
        </div>

        {/* Expandable Accordion Body */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-gray-100"
            >
              <div className="p-4 sm:p-5 pt-3 bg-gray-50/50">
                <p className="text-xs sm:text-sm text-gray-600 leading-relaxed mb-4">
                  {mod.description}
                </p>

                {/* Resource Links Suite */}
                <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-gray-200/60">
                  {mod.youtube && (
                    <a
                      href={mod.youtube}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition shadow-2xs"
                    >
                      <FiYoutube className="w-3.5 h-3.5 text-rose-600" />
                      <span>YouTube Masterclass</span>
                      <FiExternalLink className="w-3 h-3 opacity-60 ml-0.5" />
                    </a>
                  )}

                  {mod.article && (
                    <a
                      href={mod.article}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition shadow-2xs"
                    >
                      <FiBookOpen className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Official Documentation</span>
                      <FiExternalLink className="w-3 h-3 opacity-60 ml-0.5" />
                    </a>
                  )}

                  {/* Toggle Complete button inside body */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onToggleComplete) onToggleComplete(index);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ml-auto cursor-pointer ${
                      isCompleted
                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <FiCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{isCompleted ? 'Completed' : 'Mark Complete'}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

export default ModuleCard;
