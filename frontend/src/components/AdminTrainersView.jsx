import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FiUsers,
  FiSearch,
  FiMail,
  FiPhone,
  FiBriefcase,
  FiAward,
  FiBook,
  FiCheckCircle,
  FiAlertCircle,
  FiChevronDown,
  FiChevronUp,
  FiTag,
  FiShield,
  FiCalendar,
} from 'react-icons/fi';

function AdminTrainersView({ trainers = [], onScheduleTrainer }) {
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [expandedTrainers, setExpandedTrainers] = useState({});

  // Dynamic departments extracted from trainer list
  const availableDepartments = useMemo(() => {
    const set = new Set();
    trainers.forEach((t) => {
      if (t.profile?.department?.trim()) {
        set.add(t.profile.department.trim());
      }
    });
    return Array.from(set);
  }, [trainers]);

  // Toggle card expansion
  const toggleExpand = (id) => {
    setExpandedTrainers((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Filtered trainers
  const filteredTrainers = useMemo(() => {
    return trainers.filter((t) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        t.name?.toLowerCase().includes(q) ||
        t.email?.toLowerCase().includes(q) ||
        t.profile?.department?.toLowerCase().includes(q) ||
        t.profile?.designation?.toLowerCase().includes(q) ||
        t.profile?.employeeId?.toLowerCase().includes(q) ||
        t.profile?.specializations?.some((s) => s.toLowerCase().includes(q));

      const matchesDept =
        departmentFilter === 'all' ||
        t.profile?.department?.toLowerCase().trim() === departmentFilter.toLowerCase().trim();

      return matchesSearch && matchesDept;
    });
  }, [trainers, search, departmentFilter]);

  return (
    <div className="space-y-6">
      {/* 1. Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-[#0A0A0A] flex items-center gap-2">
            <FiUsers className="text-purple-600" size={20} />
            <span>Faculty & Technical Trainers Directory ({trainers.length})</span>
          </h3>
          <p className="text-xs text-black/50 mt-0.5">
            Manage appointed instructors, verify coaching specializations, and review academic performance tracking.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Box */}
          <div className="relative min-w-[220px]">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={13} />
            <input
              type="text"
              placeholder="Search by name, email, skill..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-zinc-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-black outline-none focus:border-purple-500 transition shadow-xs"
            />
          </div>

          {/* Department Filter */}
          {availableDepartments.length > 0 && (
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="bg-white border border-zinc-200 rounded-xl px-3 py-1.5 text-xs text-black font-semibold outline-none focus:border-purple-500 transition shadow-xs cursor-pointer"
            >
              <option value="all">All Departments ({trainers.length})</option>
              {availableDepartments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* 2. Responsive Trainers Grid */}
      {filteredTrainers.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-2xl p-10 text-center text-zinc-500 space-y-2">
          <FiUsers size={32} className="mx-auto text-zinc-300" />
          <p className="text-sm font-semibold text-zinc-700">No trainers found</p>
          <p className="text-xs text-zinc-400">
            {search || departmentFilter !== 'all'
              ? 'Try adjusting your search criteria or department filter.'
              : 'No faculty trainers registered in this institution yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTrainers.map((t) => {
            const isExpanded = Boolean(expandedTrainers[t._id]);
            const specializations = Array.isArray(t.profile?.specializations) && t.profile.specializations.length > 0
              ? t.profile.specializations
              : ['Algorithms & DSA', 'System Architecture', 'Technical Interview Prep'];

            return (
              <div
                key={t._id}
                className="bg-[#0E1016] border border-white/10 rounded-2xl p-5 text-white shadow-xl flex flex-col justify-between space-y-4 hover:border-purple-500/30 transition duration-200 group"
              >
                {/* Header: Avatar, Name, Email, Status */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center text-white text-base font-black shadow-md shrink-0">
                        {t.name?.charAt(0).toUpperCase() || 'T'}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white group-hover:text-purple-300 transition">
                          {t.name}
                        </h4>
                        <p className="text-xs text-zinc-400 truncate max-w-[160px] sm:max-w-[190px]">
                          {t.email}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                        t.status === 'suspended'
                          ? 'bg-red-500/15 text-red-400 border-red-500/30'
                          : t.status === 'pending'
                          ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      }`}
                    >
                      {t.status || 'active'}
                    </span>
                  </div>

                  {/* Department & Designation Cards */}
                  <div className="bg-[#17181E] border border-white/5 rounded-xl p-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase font-semibold block flex items-center gap-1">
                        <FiBook size={10} className="text-purple-400" />
                        <span>Department</span>
                      </span>
                      <span className="text-zinc-200 font-semibold truncate block mt-0.5">
                        {t.profile?.department || 'Computer Science'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase font-semibold block flex items-center gap-1">
                        <FiBriefcase size={10} className="text-blue-400" />
                        <span>Designation</span>
                      </span>
                      <span className="text-zinc-200 font-semibold truncate block mt-0.5">
                        {t.profile?.designation || 'Technical Trainer'}
                      </span>
                    </div>

                    <div className="col-span-2 pt-2 border-t border-white/5 flex items-center justify-between text-[11px]">
                      <span className="text-zinc-400 flex items-center gap-1">
                        <FiAward size={12} className="text-yellow-400" />
                        <span>Experience:</span>
                      </span>
                      <span className="font-bold text-white">
                        {t.profile?.yearsOfExperience
                          ? `${t.profile.yearsOfExperience} Years Coaching`
                          : 'Professional Instructor'}
                      </span>
                    </div>
                  </div>

                  {/* Specialization Tags */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-zinc-500 uppercase font-semibold flex items-center gap-1">
                      <FiTag size={10} className="text-purple-400" />
                      <span>Specializations & Focus Areas</span>
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {specializations.map((skill, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2 py-0.5 rounded-md font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 3. Expandable Contact & Profile Details */}
                <div className="pt-2 border-t border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => toggleExpand(t._id)}
                      className="text-xs font-semibold text-zinc-400 hover:text-white transition flex items-center gap-1"
                    >
                      <span>{isExpanded ? 'Hide Details' : 'View Contact & Details'}</span>
                      {isExpanded ? <FiChevronUp size={13} /> : <FiChevronDown size={13} />}
                    </button>

                    {onScheduleTrainer && (
                      <button
                        type="button"
                        onClick={() => onScheduleTrainer(t)}
                        className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold transition flex items-center gap-1"
                      >
                        <FiCalendar size={11} />
                        <span>Schedule</span>
                      </button>
                    )}
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden space-y-2 pt-2 text-xs"
                      >
                        {t.profile?.bio && (
                          <div className="bg-black/30 p-2.5 rounded-lg border border-white/5 text-zinc-300 text-[11px] leading-relaxed">
                            {t.profile.bio}
                          </div>
                        )}

                        <div className="space-y-1 bg-black/40 p-2.5 rounded-lg border border-white/5 text-[11px]">
                          <div className="flex items-center justify-between text-zinc-400">
                            <span className="flex items-center gap-1.5">
                              <FiMail size={11} className="text-zinc-500" />
                              <span>Email:</span>
                            </span>
                            <a
                              href={`mailto:${t.email}`}
                              className="text-purple-400 hover:underline font-mono"
                            >
                              {t.email}
                            </a>
                          </div>

                          {t.profile?.contactNumber && (
                            <div className="flex items-center justify-between text-zinc-400 pt-1 border-t border-white/5">
                              <span className="flex items-center gap-1.5">
                                <FiPhone size={11} className="text-zinc-500" />
                                <span>Phone:</span>
                              </span>
                              <span className="text-zinc-200 font-mono">
                                {t.profile.contactNumber}
                              </span>
                            </div>
                          )}

                          {t.profile?.employeeId && (
                            <div className="flex items-center justify-between text-zinc-400 pt-1 border-t border-white/5">
                              <span>Employee ID:</span>
                              <span className="text-zinc-200 font-mono">
                                {t.profile.employeeId}
                              </span>
                            </div>
                          )}
                        </div>

                        {Array.isArray(t.permissions) && t.permissions.length > 0 && (
                          <div className="pt-1">
                            <span className="text-[10px] text-zinc-500 block mb-1">
                              Granted System Permissions:
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {t.permissions.map((perm, idx) => (
                                <span
                                  key={idx}
                                  className="text-[9px] bg-white/5 text-zinc-400 px-1.5 py-0.5 rounded border border-white/5 font-mono"
                                >
                                  {perm}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default AdminTrainersView;
