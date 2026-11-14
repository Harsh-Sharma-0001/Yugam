import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FiSearch,
  FiFilter,
  FiDownload,
  FiCalendar,
  FiChevronDown,
  FiChevronUp,
  FiCheckCircle,
  FiClock,
  FiAlertCircle,
  FiUser,
  FiAward,
  FiBook,
  FiExternalLink,
  FiPlay,
  FiFileText,
  FiRefreshCw,
} from 'react-icons/fi';
import {
  getStudentsPerformanceDirectory,
  exportStudentsDirectoryFile,
} from '../apis/interview.api';

function StudentDirectory({ onScheduleStudent }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);

  // Available filter choices dynamically fetched from server
  const [availableSections, setAvailableSections] = useState([]);

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [scoreFilter, setScoreFilter] = useState('all'); // 'all' | 'high' (>=75) | 'mid' (50-74) | 'low' (<50)
  const [cgpaFilter, setCgpaFilter] = useState('all'); // 'all' | 'high' (>=8.5) | 'mid' (7.5-8.49) | 'low' (<7.5)
  const [sortBy, setSortBy] = useState('overallAvgScore'); // 'overallAvgScore' | 'currentCGPA' | 'name' | 'rollNumber'
  const [sortOrder, setSortOrder] = useState('desc');

  // Expanded student row IDs
  const [expandedRows, setExpandedRows] = useState({});
  const [exportingFormat, setExportingFormat] = useState(null);

  const fetchDirectory = async () => {
    setLoading(true);
    try {
      const queryParams = {
        page,
        limit,
        search: search.trim(),
        section: sectionFilter,
        sortBy,
        sortOrder,
      };

      if (scoreFilter === 'high') queryParams.minScore = 75;
      if (scoreFilter === 'mid') {
        queryParams.minScore = 50;
        queryParams.maxScore = 74.9;
      }
      if (scoreFilter === 'low') queryParams.maxScore = 49.9;

      if (cgpaFilter === 'high') queryParams.minCgpa = 8.5;
      if (cgpaFilter === 'mid') {
        queryParams.minCgpa = 7.5;
        queryParams.maxCgpa = 8.49;
      }
      if (cgpaFilter === 'low') queryParams.maxCgpa = 7.49;

      const res = await getStudentsPerformanceDirectory(queryParams);
      if (res?.success) {
        setStudents(res.students || []);
        setTotalCount(res.count || 0);
        setTotalPages(res.totalPages || 1);
        if (res.availableSections) {
          setAvailableSections(res.availableSections);
        }
      }
    } catch (err) {
      console.error('Failed to load student directory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDirectory();
  }, [page, sectionFilter, scoreFilter, cgpaFilter, sortBy, sortOrder]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchDirectory();
  };

  const handleExport = async (format) => {
    setExportingFormat(format);
    try {
      const queryParams = {
        search: search.trim(),
        section: sectionFilter,
        sortBy,
        sortOrder,
      };

      if (scoreFilter === 'high') queryParams.minScore = 75;
      if (scoreFilter === 'mid') {
        queryParams.minScore = 50;
        queryParams.maxScore = 74.9;
      }
      if (scoreFilter === 'low') queryParams.maxScore = 49.9;

      if (cgpaFilter === 'high') queryParams.minCgpa = 8.5;
      if (cgpaFilter === 'mid') {
        queryParams.minCgpa = 7.5;
        queryParams.maxCgpa = 8.49;
      }
      if (cgpaFilter === 'low') queryParams.maxCgpa = 7.49;

      await exportStudentsDirectoryFile(format, queryParams);
    } finally {
      setExportingFormat(null);
    }
  };

  const toggleRow = (id) => {
    setExpandedRows((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <div className="space-y-5">
      {/* Top Header & Export Action Bar */}
      <div className="bg-[#0E1016] border border-white/10 rounded-2xl p-5 shadow-xl text-white">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
              <span>Student Performance & Placement Directory</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/10 font-mono text-zinc-300">
                {totalCount} Enrolled
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Cross-service performance scorecard, verified 3-tier academic records, and institutional interview scheduling.
            </p>
          </div>

          {/* Export Buttons */}
          <div className="flex items-center gap-2 self-start lg:self-auto">
            <button
              onClick={() => handleExport('xlsx')}
              disabled={exportingFormat !== null}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition shadow-sm disabled:opacity-50"
            >
              <FiDownload size={14} />
              <span>{exportingFormat === 'xlsx' ? 'Exporting...' : 'Export Excel (.xlsx)'}</span>
            </button>

            <button
              onClick={() => handleExport('csv')}
              disabled={exportingFormat !== null}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition border border-white/10 disabled:opacity-50"
            >
              <FiDownload size={14} />
              <span>{exportingFormat === 'csv' ? 'Exporting...' : 'Export CSV (.csv)'}</span>
            </button>
          </div>
        </div>

        {/* Real-time Search & Multi-Criteria Filter Bar */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 pt-3 border-t border-white/10">
          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} className="relative lg:col-span-2">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={15} />
            <input
              type="text"
              placeholder="Search by student name or roll number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#17181E] border border-white/10 rounded-xl pl-10 pr-3 py-2 text-xs text-white placeholder-zinc-500 outline-none focus:border-white/30"
            />
          </form>

          {/* Section Filter */}
          <div>
            <select
              value={sectionFilter}
              onChange={(e) => {
                setSectionFilter(e.target.value);
                setPage(1);
              }}
              className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-white/30"
            >
              <option value="all">All Sections</option>
              {availableSections.map((sec) => (
                <option key={sec} value={sec}>
                  Section {sec}
                </option>
              ))}
            </select>
          </div>

          {/* Score Range Filter */}
          <div>
            <select
              value={scoreFilter}
              onChange={(e) => {
                setScoreFilter(e.target.value);
                setPage(1);
              }}
              className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-white/30"
            >
              <option value="all">All Interview Scores</option>
              <option value="high">75+ (Strong Competence)</option>
              <option value="mid">50 – 74 (Average)</option>
              <option value="low">Below 50 (Needs Focus)</option>
            </select>
          </div>

          {/* CGPA Range Filter */}
          <div>
            <select
              value={cgpaFilter}
              onChange={(e) => {
                setCgpaFilter(e.target.value);
                setPage(1);
              }}
              className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-white/30"
            >
              <option value="all">All CGPA</option>
              <option value="high">8.5+ CGPA</option>
              <option value="mid">7.5 – 8.49 CGPA</option>
              <option value="low">Below 7.5 CGPA</option>
            </select>
          </div>
        </div>

        {/* Sort Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-3 border-t border-white/5 text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <span>Sort by:</span>
            <button
              onClick={() => {
                if (sortBy === 'overallAvgScore') {
                  setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                } else {
                  setSortBy('overallAvgScore');
                  setSortOrder('desc');
                }
              }}
              className={`px-2.5 py-1 rounded-lg transition ${
                sortBy === 'overallAvgScore'
                  ? 'bg-white text-black font-bold'
                  : 'bg-white/5 hover:bg-white/10 text-white'
              }`}
            >
              Avg. Interview Score {sortBy === 'overallAvgScore' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>

            <button
              onClick={() => {
                if (sortBy === 'currentCGPA') {
                  setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                } else {
                  setSortBy('currentCGPA');
                  setSortOrder('desc');
                }
              }}
              className={`px-2.5 py-1 rounded-lg transition ${
                sortBy === 'currentCGPA'
                  ? 'bg-white text-black font-bold'
                  : 'bg-white/5 hover:bg-white/10 text-white'
              }`}
            >
              Current CGPA {sortBy === 'currentCGPA' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>

            <button
              onClick={() => {
                if (sortBy === 'name') {
                  setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                } else {
                  setSortBy('name');
                  setSortOrder('asc');
                }
              }}
              className={`px-2.5 py-1 rounded-lg transition ${
                sortBy === 'name'
                  ? 'bg-white text-black font-bold'
                  : 'bg-white/5 hover:bg-white/10 text-white'
              }`}
            >
              Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>

            <button
              onClick={() => {
                if (sortBy === 'rollNumber') {
                  setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                } else {
                  setSortBy('rollNumber');
                  setSortOrder('asc');
                }
              }}
              className={`px-2.5 py-1 rounded-lg transition ${
                sortBy === 'rollNumber'
                  ? 'bg-white text-black font-bold'
                  : 'bg-white/5 hover:bg-white/10 text-white'
              }`}
            >
              Roll Number {sortBy === 'rollNumber' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={fetchDirectory}
              title="Refresh"
              className="p-1 rounded hover:bg-white/10 transition"
            >
              <FiRefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Directory Table */}
      <div className="bg-[#0E1016] border border-white/10 rounded-2xl overflow-hidden shadow-xl text-white">
        {loading ? (
          <div className="py-20 text-center text-zinc-400 space-y-3">
            <div className="w-8 h-8 rounded-full border-4 border-white/20 border-t-white animate-spin mx-auto" />
            <p className="text-xs">Loading student performance records...</p>
          </div>
        ) : students.length > 0 ? (
          <div className="divide-y divide-white/5">
            {students.map((student) => {
              const isExpanded = Boolean(expandedRows[student._id]);
              const p = student.profile || {};
              const verification = p.academicVerificationStatus || 'unsubmitted';

              return (
                <div key={student._id} className="transition-colors hover:bg-white/[0.015]">
                  {/* Collapsed Main Row */}
                  <div
                    onClick={() => toggleRow(student._id)}
                    className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
                  >
                    {/* Left: Student Identity */}
                    <div className="flex items-start sm:items-center gap-3 min-w-[240px]">
                      <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center font-bold text-xs text-white shrink-0">
                        {student.name ? student.name[0].toUpperCase() : 'S'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-white group-hover:text-blue-400 transition">
                            {student.name}
                          </h4>
                          {verification === 'verified' && (
                            <span title="Verified Academic Record" className="text-emerald-400">
                              <FiCheckCircle size={13} />
                            </span>
                          )}
                          {verification === 'pending' && (
                            <span title="Pending Admin Review" className="text-amber-400">
                              <FiClock size={13} />
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-400">
                          {student.email} • {p.course || 'B.Tech CSE'}
                        </p>
                      </div>
                    </div>

                    {/* Middle: Roll & Section */}
                    <div className="flex items-center gap-3 text-xs">
                      <div className="bg-[#17181E] border border-white/5 px-2.5 py-1 rounded-lg">
                        <span className="text-[10px] text-zinc-500 uppercase block font-semibold">
                          Roll Number
                        </span>
                        <span className="font-mono text-zinc-200 font-bold">
                          {p.rollNumber || '—'}
                        </span>
                      </div>

                      <div className="bg-[#17181E] border border-white/5 px-2.5 py-1 rounded-lg">
                        <span className="text-[10px] text-zinc-500 uppercase block font-semibold">
                          Section
                        </span>
                        <span className="text-zinc-200 font-bold">{p.section || 'Sec A'}</span>
                      </div>
                    </div>

                    {/* Performance & Academia Previews */}
                    <div className="flex items-center gap-4">
                      {/* Overall Avg Score Pill */}
                      <div className="text-right min-w-[100px]">
                        <span className="text-[10px] text-zinc-500 uppercase block font-semibold">
                          Interview Avg
                        </span>
                        {student.overallAvgScore !== null ? (
                          <span
                            className={`inline-block font-extrabold text-sm px-2.5 py-0.5 rounded-full ${
                              student.overallAvgScore >= 75
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : student.overallAvgScore >= 50
                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                : 'bg-red-500/15 text-red-400 border border-red-500/30'
                            }`}
                          >
                            {student.overallAvgScore} / 100
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-500 italic">No Interviews</span>
                        )}
                      </div>

                      {/* Current CGPA */}
                      <div className="text-right min-w-[90px]">
                        <span className="text-[10px] text-zinc-500 uppercase block font-semibold">
                          Current CGPA
                        </span>
                        <span className="font-extrabold text-sm text-white">
                          {p.currentCGPA !== undefined && p.currentCGPA !== null
                            ? `${p.currentCGPA} / 10`
                            : '—'}
                        </span>
                      </div>

                      {/* Expand Chevron */}
                      <div className="text-zinc-400 hover:text-white p-1">
                        {isExpanded ? <FiChevronUp size={18} /> : <FiChevronDown size={18} />}
                      </div>
                    </div>
                  </div>

                  {/* Full-Width Expandable Detail Card */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-[#14151D] border-t border-white/5 p-5 sm:p-6 space-y-5"
                      >
                        {/* 1. Overall Academia — 3 Separate Verified Academic Indicators */}
                        <div>
                          <div className="flex items-center justify-between mb-2.5">
                            <h5 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                              <FiBook size={13} className="text-blue-400" />
                              <span>Verified Academic Background (3-Tier Academia)</span>
                            </h5>
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                verification === 'verified'
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                  : verification === 'pending'
                                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                  : 'bg-zinc-500/15 text-zinc-400'
                              }`}
                            >
                              {verification === 'verified'
                                ? 'Institutionally Verified'
                                : verification === 'pending'
                                ? 'Marks Under Review'
                                : 'Unverified Record'}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {/* Class 10th */}
                            <div className="bg-[#1B1C26] border border-white/5 rounded-xl p-3.5">
                              <span className="text-[10px] text-zinc-500 uppercase font-semibold block mb-0.5">
                                Class 10th (Secondary)
                              </span>
                              <div className="text-lg font-black text-white">
                                {p.academics?.tenthPercentage !== undefined
                                  ? `${p.academics.tenthPercentage}%`
                                  : '—'}
                              </div>
                              <span className="text-[10px] text-zinc-400">Board Examination</span>
                            </div>

                            {/* Class 12th */}
                            <div className="bg-[#1B1C26] border border-white/5 rounded-xl p-3.5">
                              <span className="text-[10px] text-zinc-500 uppercase font-semibold block mb-0.5">
                                Class 12th (Higher Secondary)
                              </span>
                              <div className="text-lg font-black text-white">
                                {p.academics?.twelfthPercentage !== undefined
                                  ? `${p.academics.twelfthPercentage}%`
                                  : '—'}
                              </div>
                              <span className="text-[10px] text-zinc-400">Pre-University Examination</span>
                            </div>

                            {/* Ongoing B.Tech CGPA */}
                            <div className="bg-[#1B1C26] border border-white/5 rounded-xl p-3.5">
                              <span className="text-[10px] text-zinc-500 uppercase font-semibold block mb-0.5">
                                Current B.Tech CGPA
                              </span>
                              <div className="text-lg font-black text-white">
                                {p.currentCGPA !== undefined && p.currentCGPA !== null
                                  ? `${p.currentCGPA} / 10`
                                  : '—'}
                              </div>
                              <span className="text-[10px] text-zinc-400">
                                Sem {p.semester || '5'} • Year {p.year || '3'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* 2. Interview Performance Breakdown */}
                        <div>
                          <h5 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 mb-2.5">
                            <FiAward size={13} className="text-yellow-400" />
                            <span>Interview Performance Breakdown</span>
                          </h5>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-[#1B1C26] border border-white/5 rounded-xl p-3 text-center">
                              <span className="text-[10px] text-zinc-500 uppercase block mb-1">
                                Overall Average
                              </span>
                              <span className="text-base font-bold text-white">
                                {student.overallAvgScore !== null
                                  ? `${student.overallAvgScore}/100`
                                  : '—'}
                              </span>
                            </div>

                            <div className="bg-[#1B1C26] border border-white/5 rounded-xl p-3 text-center">
                              <span className="text-[10px] text-zinc-500 uppercase block mb-1">
                                AI Mock Avg
                              </span>
                              <span className="text-base font-bold text-blue-400">
                                {student.aiAvgScore !== null ? `${student.aiAvgScore}/100` : '—'}
                              </span>
                              <span className="text-[10px] text-zinc-500 block">
                                ({student.aiCompletedCount} completed)
                              </span>
                            </div>

                            <div className="bg-[#1B1C26] border border-white/5 rounded-xl p-3 text-center">
                              <span className="text-[10px] text-zinc-500 uppercase block mb-1">
                                Live Trainer Avg
                              </span>
                              <span className="text-base font-bold text-purple-400">
                                {student.liveAvgScore !== null ? `${student.liveAvgScore}/100` : '—'}
                              </span>
                              <span className="text-[10px] text-zinc-500 block">
                                ({student.liveCompletedCount} completed)
                              </span>
                            </div>

                            <div className="bg-[#1B1C26] border border-white/5 rounded-xl p-3 text-center">
                              <span className="text-[10px] text-zinc-500 uppercase block mb-1">
                                Scheduled
                              </span>
                              <span className="text-base font-bold text-amber-400">
                                {student.pendingScheduledCount}
                              </span>
                              <span className="text-[10px] text-zinc-500 block">Upcoming</span>
                            </div>
                          </div>
                        </div>

                        {/* 3. Quick Actions Footer */}
                        <div className="pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3 text-xs text-zinc-400">
                            {p.contactNumber && <span>📞 {p.contactNumber}</span>}
                            {p.resumeUrl && (
                              <a
                                href={p.resumeUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-400 hover:underline inline-flex items-center gap-1"
                              >
                                <FiExternalLink size={12} />
                                <span>Student Resume</span>
                              </a>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => onScheduleStudent && onScheduleStudent(student)}
                              className="px-4 py-2 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-bold transition shadow-sm inline-flex items-center gap-1.5"
                            >
                              <FiCalendar size={13} />
                              <span>Schedule Interview</span>
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-20 text-center text-zinc-400 space-y-2">
            <FiUser size={32} className="mx-auto text-zinc-600 mb-2" />
            <h4 className="text-sm font-bold text-white">No Matching Students Found</h4>
            <p className="text-xs text-zinc-500">
              Try adjusting your search criteria, section, or performance score filters.
            </p>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-white/10 flex items-center justify-between text-xs">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40 transition"
            >
              Previous
            </button>

            <span className="text-zinc-400">
              Page {page} of {totalPages}
            </span>

            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40 transition"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default StudentDirectory;
