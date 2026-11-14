import React, { useState, useEffect, useRef } from 'react';
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
  FiSearch,
} from 'react-icons/fi';
import { scheduleInterview, getStudentsPerformanceDirectory } from '../apis/interview.api';

function ScheduleInterviewModal({
  isOpen,
  onClose,
  initialStudent,
  preselectedStudent,
  onScheduled,
}) {
  const preselected = initialStudent || preselectedStudent || null;

  const [mode, setMode] = useState('ai'); // 'ai' | 'live'
  const [targetType, setTargetType] = useState('individual'); // 'individual' | 'section'

  // Student Selection State
  const [studentsList, setStudentsList] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentSearchInput, setStudentSearchInput] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const [targetSection, setTargetSection] = useState('');

  // Interview Configuration State
  const [role, setRole] = useState('Software Engineer');
  const [interviewType, setInterviewType] = useState('technical');
  const [experience, setExperience] = useState('Fresher / Campus');
  const [scheduledAt, setScheduledAt] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [instructions, setInstructions] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Initialize or reset form state on open / initialStudent change
  useEffect(() => {
    if (preselected) {
      setTargetType('individual');
      setSelectedStudent(preselected);
      setStudentSearchInput(preselected.name || preselected.email || '');
    } else {
      setSelectedStudent(null);
      setStudentSearchInput('');
      setTargetType('individual');
    }

    setTargetSection('');

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
    setDropdownOpen(false);
  }, [preselected, isOpen]);

  // Fetch institution's student list when modal opens without a preselected student
  useEffect(() => {
    if (isOpen && !preselected) {
      const loadStudents = async () => {
        setLoadingStudents(true);
        try {
          const res = await getStudentsPerformanceDirectory({ limit: 200 });
          if (res?.success && Array.isArray(res.students)) {
            setStudentsList(res.students);
          }
        } catch (err) {
          console.warn('Failed to load students directory for schedule selector:', err);
        } finally {
          setLoadingStudents(false);
        }
      };
      loadStudents();
    }
  }, [isOpen, preselected]);

  // Handle outside click to close student dropdown popover
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen) return null;

  // Filter students by name, roll number, or email
  const filteredStudents = studentsList.filter((s) => {
    if (!studentSearchInput.trim()) return true;
    const q = studentSearchInput.toLowerCase().trim();
    const nameMatch = s.name?.toLowerCase().includes(q);
    const rollMatch = s.profile?.rollNumber?.toLowerCase().includes(q);
    const emailMatch = s.email?.toLowerCase().includes(q);
    return Boolean(nameMatch || rollMatch || emailMatch);
  });

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
        targetType,
      };

      if (targetType === 'individual') {
        const activeStudentId = selectedStudent?._id || preselected?._id;
        const activeIdentifier = activeStudentId || studentSearchInput.trim();

        if (!activeIdentifier) {
          setError('Please select a student or enter an Email, Roll Number, or Student ID.');
          setLoading(false);
          return;
        }

        payload.studentIdentifier = activeIdentifier;
        payload.studentId = activeStudentId || activeIdentifier;
        payload.studentName = selectedStudent?.name || preselected?.name || '';
        payload.studentRollNumber =
          selectedStudent?.profile?.rollNumber || preselected?.profile?.rollNumber || '';
        payload.section = selectedStudent?.profile?.section || preselected?.profile?.section || '';
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
                  {preselected
                    ? `Scheduling for ${preselected.name} (${preselected.profile?.rollNumber || 'Student'})`
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

          <form onSubmit={handleSubmit} className="p-6 pb-6 space-y-4 max-h-[82vh] overflow-y-auto">
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

            {/* Target Audience Switcher & Student Selector */}
            {!preselected && (
              <div className="space-y-3">
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
                  ) : null}
                </div>

                {/* Individual Student Searchable Dropdown / Manual Identifier */}
                {targetType === 'individual' && (
                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1">
                      Select Student or Enter Email / Roll Number
                    </label>

                    {selectedStudent ? (
                      <div className="bg-[#17181E] border border-purple-500/30 rounded-xl p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-300 font-bold flex items-center justify-center text-xs">
                            {selectedStudent.name?.charAt(0) || 'S'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">
                                {selectedStudent.name}
                              </span>
                              {selectedStudent.profile?.section && (
                                <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-zinc-300 font-semibold">
                                  {selectedStudent.profile.section}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-zinc-400">
                              {selectedStudent.profile?.rollNumber
                                ? `Roll: ${selectedStudent.profile.rollNumber} • `
                                : ''}
                              {selectedStudent.email}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStudent(null);
                            setStudentSearchInput('');
                          }}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition"
                          title="Change Student"
                        >
                          <FiX size={15} />
                        </button>
                      </div>
                    ) : (
                      <div className="relative" ref={dropdownRef}>
                        <div className="relative">
                          <FiSearch
                            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500"
                            size={14}
                          />
                          <input
                            type="text"
                            required
                            placeholder="Search by name, roll number, or enter email..."
                            value={studentSearchInput}
                            onChange={(e) => {
                              setStudentSearchInput(e.target.value);
                              setDropdownOpen(true);
                            }}
                            onFocus={() => setDropdownOpen(true)}
                            className="w-full bg-[#17181E] border border-white/10 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white outline-none focus:border-white/30"
                          />
                        </div>

                        {dropdownOpen && (
                          <div className="absolute left-0 right-0 top-full mt-1.5 z-30 max-h-56 overflow-y-auto bg-[#13151D] border border-white/10 rounded-xl shadow-2xl p-1.5 space-y-1">
                            {loadingStudents ? (
                              <div className="p-3 text-center text-xs text-zinc-500">
                                Loading enrolled students...
                              </div>
                            ) : filteredStudents.length > 0 ? (
                              filteredStudents.map((s) => (
                                <button
                                  key={s._id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedStudent(s);
                                    setStudentSearchInput(s.name || s.email || '');
                                    setDropdownOpen(false);
                                  }}
                                  className="w-full text-left p-2.5 rounded-lg hover:bg-white/10 transition flex items-center justify-between group"
                                >
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-white group-hover:text-purple-300">
                                        {s.name}
                                      </span>
                                      {s.profile?.section && (
                                        <span className="text-[10px] bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-zinc-400">
                                          {s.profile.section}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-zinc-400">
                                      {s.profile?.rollNumber ? `${s.profile.rollNumber} — ` : ''}
                                      {s.email}
                                    </p>
                                  </div>
                                  <span className="text-[10px] text-purple-400 font-semibold opacity-0 group-hover:opacity-100 transition">
                                    Select
                                  </span>
                                </button>
                              ))
                            ) : (
                              <div className="p-2.5 text-center text-xs text-zinc-500">
                                {studentSearchInput.trim() ? (
                                  <div>
                                    <p>No student matching '{studentSearchInput.trim()}'.</p>
                                    <button
                                      type="button"
                                      onClick={() => setDropdownOpen(false)}
                                      className="mt-1 text-purple-400 hover:underline text-[11px] font-medium"
                                    >
                                      Use identifier: "{studentSearchInput.trim()}"
                                    </button>
                                  </div>
                                ) : (
                                  'No students found in institution directory.'
                                )}
                              </div>
                            )}

                            {studentSearchInput.trim() && filteredStudents.length > 0 && (
                              <div className="border-t border-white/5 pt-1 mt-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedStudent(null);
                                    setDropdownOpen(false);
                                  }}
                                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/5 text-[11px] text-zinc-400 hover:text-zinc-200"
                                >
                                  Use identifier directly:{' '}
                                  <strong className="text-purple-400">
                                    {studentSearchInput.trim()}
                                  </strong>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Target Role & Track */}
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
                className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-white/30 resize-none"
              />
            </div>

            {/* Footer Buttons with pb-6 protection */}
            <div className="pt-4 pb-2 border-t border-white/10 flex items-center justify-end gap-3 sticky bottom-0 bg-[#0E1016]/95 backdrop-blur-sm">
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
