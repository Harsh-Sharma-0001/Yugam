import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FiX,
  FiCalendar,
  FiClock,
  FiUser,
  FiVideo,
  FiCpu,
  FiCheckCircle,
  FiAlertCircle,
} from 'react-icons/fi';
import { scheduleInterview } from '../apis/interview.api';

function ScheduleInterviewModal({ isOpen, onClose, initialStudent, onScheduled }) {
  const [mode, setMode] = useState('ai'); // 'ai' | 'live'
  const [targetType, setTargetType] = useState(initialStudent ? 'individual' : 'individual');
  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentRollNumber, setStudentRollNumber] = useState('');
  const [section, setSection] = useState('');
  const [targetSection, setTargetSection] = useState('');

  const [role, setRole] = useState('Software Engineer');
  const [interviewType, setInterviewType] = useState('technical');
  const [experience, setExperience] = useState('Fresher / Campus');
  const [scheduledAt, setScheduledAt] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [instructions, setInstructions] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    if (initialStudent) {
      setTargetType('individual');
      setStudentId(initialStudent._id);
      setStudentName(initialStudent.name || 'Student');
      setStudentRollNumber(initialStudent.profile?.rollNumber || '');
      setSection(initialStudent.profile?.section || '');
    } else {
      setStudentId('');
      setStudentName('');
      setStudentRollNumber('');
      setSection('');
    }

    // Default to tomorrow 10:00 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const localIso = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setScheduledAt(localIso);

    setError(null);
    setSuccessMsg(null);
  }, [initialStudent, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const payload = {
        mode,
        role: role.trim(),
        interviewType,
        experience,
        scheduledAt: new Date(scheduledAt).toISOString(),
        durationMinutes: Number(durationMinutes),
        instructions: instructions.trim(),
      };

      if (targetType === 'individual') {
        if (!studentId && !initialStudent) {
          setError('Please provide a valid Student ID or select a student.');
          setLoading(false);
          return;
        }
        payload.studentId = studentId || initialStudent?._id;
        payload.studentName = studentName || initialStudent?.name;
        payload.studentRollNumber = studentRollNumber || initialStudent?.profile?.rollNumber;
        payload.section = section || initialStudent?.profile?.section;
      } else {
        if (!targetSection.trim()) {
          setError('Please provide target section (e.g. CSE-A).');
          setLoading(false);
          return;
        }
        payload.targetSection = targetSection.trim();
      }

      const res = await scheduleInterview(payload);
      if (res?.success) {
        setSuccessMsg(res.message || 'Interview scheduled successfully!');
        if (onScheduled) onScheduled();
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setError(res?.message || 'Failed to schedule interview.');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Scheduling failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-[#0E1016] border border-white/10 rounded-2xl w-full max-w-xl shadow-2xl text-white overflow-hidden my-auto"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white">
                <FiCalendar size={18} />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold">Schedule Student Interview</h3>
                <p className="text-xs text-zinc-400">
                  {initialStudent
                    ? `Scheduling for ${initialStudent.name} (${initialStudent.profile?.rollNumber || 'Student'})`
                    : 'Target an individual student or an entire batch section'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-white transition p-1.5 rounded-lg hover:bg-white/5"
            >
              <FiX size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-xl flex items-center gap-2">
                <FiAlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs p-3 rounded-xl flex items-center gap-2">
                <FiCheckCircle size={15} />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Mode Switcher: AI Mock Interview vs Live Trainer Video */}
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-2">
                Interview Format & Mode
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMode('ai')}
                  className={`p-3 rounded-xl border flex items-center gap-3 transition text-left ${
                    mode === 'ai'
                      ? 'bg-blue-500/10 border-blue-500/40 text-blue-400'
                      : 'bg-[#17181E] border-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  <FiCpu size={20} className={mode === 'ai' ? 'text-blue-400' : 'text-zinc-500'} />
                  <div>
                    <span className="text-xs font-bold block">AI Mock Interview</span>
                    <span className="text-[10px] text-zinc-400 block">Autonomous LLM Evaluation</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('live')}
                  className={`p-3 rounded-xl border flex items-center gap-3 transition text-left ${
                    mode === 'live'
                      ? 'bg-purple-500/10 border-purple-500/40 text-purple-400'
                      : 'bg-[#17181E] border-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  <FiVideo size={20} className={mode === 'live' ? 'text-purple-400' : 'text-zinc-500'} />
                  <div>
                    <span className="text-xs font-bold block">Live Trainer Session</span>
                    <span className="text-[10px] text-zinc-400 block">1-on-1 Faculty Video Room</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Target Audience */}
            {!initialStudent && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">
                    Audience Type
                  </label>
                  <select
                    value={targetType}
                    onChange={(e) => setTargetType(e.target.value)}
                    className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  >
                    <option value="individual">Individual Student</option>
                    <option value="section">Entire Section</option>
                  </select>
                </div>

                {targetType === 'section' ? (
                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1">
                      Section Code
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. CSE-A"
                      value={targetSection}
                      onChange={(e) => setTargetSection(e.target.value)}
                      className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-white/30"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1">
                      Student Roll / ID
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Enter Student Roll or ID"
                      value={studentRollNumber}
                      onChange={(e) => setStudentRollNumber(e.target.value)}
                      className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-white/30"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Role & Track */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">
                  Target Role / Domain
                </label>
                <input
                  type="text"
                  required
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. Full-Stack Developer, DevOps"
                  className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-white/30"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">
                  Interview Category
                </label>
                <select
                  value={interviewType}
                  onChange={(e) => setInterviewType(e.target.value)}
                  className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none"
                >
                  <option value="technical">Technical Evaluation</option>
                  <option value="hr">HR & Behavioral Round</option>
                </select>
              </div>
            </div>

            {/* Date, Time & Duration */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">
                  Scheduled Date & Time
                </label>
                <input
                  type="datetime-local"
                  required
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-white/30"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">
                  Duration (Minutes)
                </label>
                <select
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none"
                >
                  <option value={30}>30 Minutes</option>
                  <option value={45}>45 Minutes</option>
                  <option value={60}>60 Minutes</option>
                </select>
              </div>
            </div>

            {/* Instructions */}
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">
                Instructions / Topics for Student
              </label>
              <textarea
                rows={3}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="e.g. Focus on Trees, Graphs, System Design fundamentals, and project architecture..."
                className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-white/30"
              />
            </div>

            {/* Footer Buttons */}
            <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-zinc-300 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-bold transition shadow-sm"
              >
                {loading ? 'Scheduling...' : 'Confirm Schedule'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default ScheduleInterviewModal;
