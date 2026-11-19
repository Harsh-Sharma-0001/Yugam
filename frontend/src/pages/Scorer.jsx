import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  FiAlertCircle,
  FiArrowLeft,
  FiArrowRight,
  FiBookOpen,
  FiCheck,
  FiCheckCircle,
  FiCopy,
  FiCpu,
  FiExternalLink,
  FiFileText,
  FiLayers,
  FiRefreshCw,
  FiShield,
  FiTarget,
  FiTrash2,
  FiTrendingUp,
  FiUploadCloud,
  FiUser,
  FiZap,
} from 'react-icons/fi';
import { useDispatch, useSelector } from 'react-redux';
import { PolarAngleAxis, RadialBar, RadialBarChart } from 'recharts';
import api from '../utils/axios';
import { setResume } from '../redux/resumeSlice';
import { getResumeRoles } from '../apis/resume.api';

// --------------------------------------------------
// CONSTANTS & BENCHMARKS
// --------------------------------------------------

const MAX_FILE_SIZE = 20 * 1024 * 1024;

const SCORE_LABELS = {
  strong: 'Strong Match',
  average: 'Average Match',
  weak: 'Needs Improvement',
};

// Curated ATS Benchmarks for popular roles
const POPULAR_ROLE_BENCHMARKS = {
  'mern-stack-developer': {
    label: 'MERN Stack Developer',
    required: ['JavaScript', 'React', 'Node.js', 'Express.js', 'MongoDB', 'HTML', 'CSS', 'REST APIs', 'Git'],
    preferred: ['TypeScript', 'Redux', 'Tailwind CSS', 'JWT', 'Socket.IO', 'Docker', 'AWS', 'Testing'],
    focus: 'Full-stack JavaScript architectures, state management, RESTful microservices, and NoSQL databases.',
  },
  'full-stack-software-engineer': {
    label: 'Full-Stack Software Engineer',
    required: ['JavaScript', 'React', 'Node.js', 'REST APIs', 'SQL', 'NoSQL', 'Git', 'Data Structures & Algorithms'],
    preferred: ['TypeScript', 'Docker', 'Redis', 'CI/CD', 'Cloud Computing', 'System Design'],
    focus: 'End-to-end software delivery, database normalization, caching strategies, and distributed systems.',
  },
  'java-backend-developer': {
    label: 'Java Backend Developer',
    required: ['Java', 'Spring Boot', 'SQL', 'REST APIs', 'Git', 'OOP', 'Data Structures & Algorithms'],
    preferred: ['Hibernate', 'PostgreSQL', 'Docker', 'Microservices', 'Redis', 'JUnit'],
    focus: 'Enterprise Java applications, Spring microservices, transactional consistency, and ORM patterns.',
  },
  'frontend-developer': {
    label: 'Frontend Developer',
    required: ['HTML', 'CSS', 'JavaScript', 'React', 'Responsive Design', 'Git'],
    preferred: ['TypeScript', 'Next.js', 'Redux', 'Tailwind CSS', 'Automated Testing', 'Webpack'],
    focus: 'Client-side rendering, component lifecycle, web accessibility (a11y), and frontend performance.',
  },
  'backend-developer': {
    label: 'Backend Developer',
    required: ['Node.js', 'Express.js', 'SQL', 'REST APIs', 'Git', 'Data Structures & Algorithms'],
    preferred: ['PostgreSQL', 'MongoDB', 'Redis', 'Docker', 'System Design', 'Microservices'],
    focus: 'Scalable API architectures, high-concurrency request handling, authentication, and database indexing.',
  },
  'python-developer': {
    label: 'Python Developer',
    required: ['Python', 'REST APIs', 'SQL', 'Git', 'OOP', 'Data Structures & Algorithms'],
    preferred: ['Django', 'Flask', 'PostgreSQL', 'Docker', 'Redis', 'Automated Testing'],
    focus: 'Pythonic backends, asynchronous execution, database pipelines, and API integrations.',
  },
  'devops-engineer': {
    label: 'DevOps Engineer',
    required: ['Linux', 'Git', 'Docker', 'CI/CD', 'Cloud Computing', 'Bash'],
    preferred: ['Kubernetes', 'Terraform', 'AWS', 'Monitoring', 'Ansible', 'Python'],
    focus: 'Infrastructure as Code (IaC), automated release pipelines, container orchestration, and reliability.',
  },
  'data-analyst': {
    label: 'Data Analyst',
    required: ['SQL', 'Python', 'Excel', 'Data Analysis', 'Statistics'],
    preferred: ['Power BI', 'Tableau', 'Pandas', 'NumPy', 'Data Visualization'],
    focus: 'Relational data querying, descriptive statistics, dashboard development, and business insights.',
  },
};

// Fallback benchmark for unspecified roles
const DEFAULT_BENCHMARK = {
  label: 'Software Engineer',
  required: ['JavaScript or Python', 'Data Structures & Algorithms', 'Git & Version Control', 'REST APIs', 'SQL/NoSQL'],
  preferred: ['Docker', 'Cloud Services (AWS/GCP)', 'CI/CD Automation', 'System Design', 'Unit Testing'],
  focus: 'Core computer science fundamentals, scalable API architecture, and clean code principles.',
};

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

const getSafeScore = (score) => {
  const value = Number(score);
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
};

const getScoreTier = (score) => {
  if (score >= 75) {
    return {
      label: SCORE_LABELS.strong,
      color: '#10b981',
      bgClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      pillClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      barColor: 'from-emerald-500 to-teal-400',
    };
  }
  if (score >= 50) {
    return {
      label: SCORE_LABELS.average,
      color: '#f59e0b',
      bgClass: 'bg-amber-50 text-amber-800 border-amber-200',
      pillClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      barColor: 'from-amber-500 to-yellow-400',
    };
  }
  return {
    label: SCORE_LABELS.weak,
    color: '#ef4444',
    bgClass: 'bg-rose-50 text-rose-800 border-rose-200',
    pillClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    barColor: 'from-rose-500 to-pink-500',
  };
};

// --------------------------------------------------
// COMPONENT
// --------------------------------------------------

function Scorer({ user, setUser }) {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { resume } = useSelector((state) => state.resume);

  // Upload states
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Role states
  const [targetRole, setTargetRole] = useState('');
  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [roleError, setRoleError] = useState('');

  // Report filter states
  const [activeSkillFilter, setActiveSkillFilter] = useState('all'); // 'all' | 'required' | 'preferred' | 'matched'
  const [copiedSkill, setCopiedSkill] = useState(null);

  // --------------------------------------------------
  // LOAD ROLES
  // --------------------------------------------------
  useEffect(() => {
    let isMounted = true;
    const loadRoles = async () => {
      try {
        setRolesLoading(true);
        setRoleError('');
        const data = await getResumeRoles();
        if (isMounted) {
          setRoles(Array.isArray(data) ? data : []);
          if (Array.isArray(data) && data.length > 0 && !targetRole) {
            setTargetRole(data[0].id);
          }
        }
      } catch (err) {
        console.error('Load Resume Roles Error:', err);
        if (isMounted) {
          setRoleError('Unable to load available roles. Please refresh the page.');
        }
      } finally {
        if (isMounted) {
          setRolesLoading(false);
        }
      }
    };

    loadRoles();
    return () => {
      isMounted = false;
    };
  }, []);

  // --------------------------------------------------
  // FILE HANDLING
  // --------------------------------------------------
  const validateFile = (selectedFile) => {
    if (!selectedFile) return 'Please select a PDF resume.';
    const isPDF =
      selectedFile.type === 'application/pdf' ||
      selectedFile.name.toLowerCase().endsWith('.pdf');
    if (!isPDF) return 'Only PDF files are allowed.';
    if (selectedFile.size > MAX_FILE_SIZE) return 'File size must not exceed 20 MB.';
    if (selectedFile.size === 0) return 'The selected file is empty.';
    return '';
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    const validationError = validateFile(selectedFile);
    if (validationError) {
      setFile(null);
      setError(validationError);
      e.target.value = '';
      return;
    }
    setFile(selectedFile);
    setError('');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (!droppedFile) return;
    const validationError = validateFile(droppedFile);
    if (validationError) {
      setFile(null);
      setError(validationError);
      return;
    }
    setFile(droppedFile);
    setError('');
  };

  // --------------------------------------------------
  // UPLOAD & ANALYZE
  // --------------------------------------------------
  const uploadResume = async () => {
    if (loading) return;

    if (!targetRole) {
      setError('Please select your target job role.');
      return;
    }

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setLoading(true);
      setError('');

      const formData = new FormData();
      formData.append('resume', file);
      formData.append('targetRole', targetRole);

      const response = await api.post('/api/resume/upload', formData);

      if (!response.data?.success || !response.data?.data) {
        throw new Error(response.data?.message || 'Resume analysis failed.');
      }

      const analyzedResume = response.data.data;

      if (!analyzedResume.roleSkillAnalysis) {
        throw new Error(
          'Resume was analyzed, but role-based skill analysis was not returned. Please check backend.'
        );
      }

      dispatch(setResume(analyzedResume));

      if (typeof response.data?.interviewCoin === 'number') {
        setUser((prev) => ({
          ...prev,
          interviewCoin: response.data.interviewCoin,
        }));
      }

      setFile(null);
    } catch (err) {
      console.error('Resume Upload Error:', err);
      if (err.response?.status === 402) {
        setError(
          `Insufficient interview coins! You need ${
            err.response.data?.required || 10
          } coins to analyze a resume. Please recharge your balance.`
        );
      } else {
        setError(
          err.response?.data?.message ||
            err.message ||
            'Resume analysis failed. Please try again.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReupload = () => {
    dispatch(setResume(null));
    setFile(null);
    setError('');
  };

  const handleCopySkill = (skill) => {
    navigator.clipboard.writeText(skill);
    setCopiedSkill(skill);
    setTimeout(() => setCopiedSkill(null), 2000);
  };

  // Resolve current active benchmark for Step 1 preview
  const currentBenchmark = useMemo(() => {
    if (targetRole && POPULAR_ROLE_BENCHMARKS[targetRole]) {
      return POPULAR_ROLE_BENCHMARKS[targetRole];
    }
    const foundRole = roles.find((r) => r.id === targetRole);
    if (foundRole) {
      return {
        label: foundRole.label,
        ...DEFAULT_BENCHMARK,
      };
    }
    return DEFAULT_BENCHMARK;
  }, [targetRole, roles]);

  // --------------------------------------------------
  // RENDER STEP 2: DIAGNOSTIC REPORT
  // --------------------------------------------------
  if (resume) {
    const score = getSafeScore(resume.score);
    const scoreTier = getScoreTier(score);

    const strengths = Array.isArray(resume.strengths) ? resume.strengths : [];
    const weaknesses = Array.isArray(resume.weaknesses) ? resume.weaknesses : [];
    const recommendations = Array.isArray(resume.recommendations)
      ? resume.recommendations
      : [];

    const roleAnalysis = resume.roleSkillAnalysis;
    const targetRoleLabel = roleAnalysis?.targetRoleLabel || resume?.suggestedRole || 'Software Engineer';

    const missingRequiredSkills = Array.isArray(roleAnalysis?.missingRequiredSkills)
      ? roleAnalysis.missingRequiredSkills
      : [];

    const missingPreferredSkills = Array.isArray(roleAnalysis?.missingPreferredSkills)
      ? roleAnalysis.missingPreferredSkills
      : [];

    const missingSkills = Array.isArray(roleAnalysis?.missingSkills)
      ? roleAnalysis.missingSkills
      : Array.isArray(resume.missingSkills)
      ? resume.missingSkills
      : [];

    const matchedSkills = Array.isArray(roleAnalysis?.matchedSkills)
      ? roleAnalysis.matchedSkills
      : [];

    const overallCoverage = getSafeScore(roleAnalysis?.overallCoverage);
    const requiredCoverage = getSafeScore(roleAnalysis?.requiredCoverage);
    const preferredCoverage = getSafeScore(roleAnalysis?.preferredCoverage);

    return (
      <div className="min-h-screen bg-[#F8F9FA] text-gray-900 flex flex-col font-sans">
        {/* Sticky Studio Top Header */}
        <motion.nav
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
            {/* Left: Brand Mark + Scorer Badge */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 group cursor-pointer text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-[#111318] flex items-center justify-center text-white font-black text-sm shadow-sm group-hover:scale-105 transition-transform">
                  Y
                </div>
                <span className="font-extrabold text-base tracking-tight text-gray-900 hidden sm:inline">
                  Yugam
                </span>
              </button>
              <span className="bg-[#111318] text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                ATS Resume Scorer
              </span>
            </div>

            {/* Center: Step Indicator Pills + Re-upload Action */}
            <div className="hidden md:flex items-center gap-2">
              <button
                onClick={handleReupload}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition cursor-pointer"
              >
                <FiCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>1. Upload & Role</span>
              </button>
              <span className="text-gray-400 text-xs font-bold">→</span>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#111318] text-white shadow-xs">
                <span>2. AI ATS Diagnostic Report</span>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={handleReupload}
                className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-full px-3.5 py-1.5 text-xs font-medium inline-flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <FiRefreshCw className="w-3.5 h-3.5 text-gray-500" />
                <span>New Scan</span>
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-200 rounded-full px-3.5 py-1.5 text-xs font-medium inline-flex items-center gap-1.5 transition cursor-pointer"
              >
                <FiArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Back to Overview</span>
              </button>
            </div>
          </div>
        </motion.nav>

        {/* Diagnostic Report Content */}
        <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 flex-1 space-y-6">
          {/* 1. TOP EXECUTIVE SCORE BANNER */}
          <div className="bg-[#111318] text-white rounded-3xl p-6 sm:p-8 shadow-md border border-gray-800 relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
              {/* Left Candidate & Role Metadata */}
              <div className="flex-1 text-center md:text-left">
                <div className="inline-flex items-center gap-2 bg-white/10 border border-white/10 px-3 py-1 rounded-full text-xs text-gray-300 mb-3">
                  <FiTarget className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Target Role Benchmark:</span>
                  <strong className="text-white font-semibold">{targetRoleLabel}</strong>
                </div>

                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                  {resume.name || 'Candidate Evaluation'}
                </h1>
                <p className="text-xs sm:text-sm text-gray-400 mt-1 max-w-xl">
                  Evaluated against enterprise ATS algorithms for keyword density, section readability, and verified technical proficiencies.
                </p>

                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-4">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${scoreTier.pillClass}`}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: scoreTier.color }} />
                    {scoreTier.label}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white/10 text-gray-300 border border-white/10">
                    <FiUser className="w-3.5 h-3.5 text-emerald-400" />
                    {resume.suggestedRole || targetRoleLabel}
                  </span>
                </div>
              </div>

              {/* Radial Score Gauge */}
              <div className="flex flex-col items-center shrink-0">
                <div className="relative flex items-center justify-center">
                  <RadialBarChart
                    width={140}
                    height={140}
                    cx={70}
                    cy={70}
                    innerRadius={48}
                    outerRadius={64}
                    startAngle={90}
                    endAngle={-270}
                    data={[{ value: score, fill: scoreTier.color }]}
                    barSize={10}
                  >
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                    <RadialBar background={{ fill: 'rgba(255,255,255,0.1)' }} dataKey="value" cornerRadius={8} />
                  </RadialBarChart>
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-3xl font-black text-white font-mono leading-none">
                      {score}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mt-1">
                      / 100
                    </span>
                  </div>
                </div>
                <span className="text-xs font-medium text-gray-300 mt-1">ATS Score</span>
              </div>
            </div>
          </div>

          {/* 2. ROLE SKILL MATCH & MATRIX CARD */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-7 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <FiTarget className="w-5 h-5 text-indigo-600" />
                  Role Skill Coverage & Benchmark
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Extracted keyword coverage mapped against the required competency matrix for{' '}
                  <span className="text-gray-900 font-semibold">{targetRoleLabel}</span>.
                </p>
              </div>

              {/* Direct Roadmap Bridge Button */}
              <button
                onClick={() => navigate('/roadmap')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[#111318] text-white hover:bg-black transition shadow-sm cursor-pointer self-start sm:self-center"
              >
                <span>Build Learning Roadmap</span>
                <FiArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 3 Metric Coverage Bars */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
              {/* Overall Coverage */}
              <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-medium text-gray-600">Overall Coverage</span>
                  <span className="text-base font-bold text-gray-900 font-mono">{overallCoverage}%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-500"
                    style={{ width: `${overallCoverage}%` }}
                  />
                </div>
                <span className="text-[10px] text-gray-400 mt-2 block">Aggregate role match</span>
              </div>

              {/* Required Skills Coverage */}
              <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold text-emerald-900">Required Skills</span>
                  <span className="text-base font-bold text-emerald-800 font-mono">{requiredCoverage}%</span>
                </div>
                <div className="h-2 bg-emerald-200/60 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
                    style={{ width: `${requiredCoverage}%` }}
                  />
                </div>
                <span className="text-[10px] text-emerald-700 mt-2 block">Core gatekeeper proficiencies</span>
              </div>

              {/* Preferred Skills Coverage */}
              <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold text-amber-900">Preferred Skills</span>
                  <span className="text-base font-bold text-amber-800 font-mono">{preferredCoverage}%</span>
                </div>
                <div className="h-2 bg-amber-200/60 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-yellow-500 rounded-full transition-all duration-500"
                    style={{ width: `${preferredCoverage}%` }}
                  />
                </div>
                <span className="text-[10px] text-amber-700 mt-2 block">Bonus standout technologies</span>
              </div>
            </div>

            {/* Interactive Skill Gap Filter Pills */}
            <div className="pt-2">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                  <button
                    onClick={() => setActiveSkillFilter('all')}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer ${
                      activeSkillFilter === 'all'
                        ? 'bg-[#111318] text-white shadow-xs'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    All Skills ({missingSkills.length + matchedSkills.length})
                  </button>
                  <button
                    onClick={() => setActiveSkillFilter('required')}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer ${
                      activeSkillFilter === 'required'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                    }`}
                  >
                    Missing Required ({missingRequiredSkills.length})
                  </button>
                  <button
                    onClick={() => setActiveSkillFilter('preferred')}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer ${
                      activeSkillFilter === 'preferred'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                    }`}
                  >
                    Missing Preferred ({missingPreferredSkills.length})
                  </button>
                  <button
                    onClick={() => setActiveSkillFilter('matched')}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer ${
                      activeSkillFilter === 'matched'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                    }`}
                  >
                    Matched ({matchedSkills.length})
                  </button>
                </div>

                <span className="text-[11px] text-gray-400">
                  {copiedSkill ? (
                    <span className="text-emerald-600 font-semibold">✓ Copied &quot;{copiedSkill}&quot;</span>
                  ) : (
                    'Click any skill tag to copy'
                  )}
                </span>
              </div>

              {/* Filtered Skill Tags Grid */}
              <div className="flex flex-wrap gap-2 min-h-[50px] p-4 bg-gray-50/70 border border-gray-200/60 rounded-xl">
                {activeSkillFilter === 'all' && (
                  <>
                    {missingRequiredSkills.map((s, idx) => (
                      <button
                        key={`req-${idx}`}
                        onClick={() => handleCopySkill(s)}
                        title="Click to copy missing required skill"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition cursor-pointer"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        <span>{s}</span>
                        <FiCopy className="w-3 h-3 text-rose-400 ml-0.5" />
                      </button>
                    ))}
                    {missingPreferredSkills.map((s, idx) => (
                      <button
                        key={`pref-${idx}`}
                        onClick={() => handleCopySkill(s)}
                        title="Click to copy missing preferred skill"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition cursor-pointer"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        <span>{s}</span>
                        <FiCopy className="w-3 h-3 text-amber-400 ml-0.5" />
                      </button>
                    ))}
                    {matchedSkills.map((s, idx) => (
                      <button
                        key={`mat-${idx}`}
                        onClick={() => handleCopySkill(s)}
                        title="Click to copy matched skill"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition cursor-pointer"
                      >
                        <FiCheck className="w-3 h-3 text-emerald-600 font-bold" />
                        <span>{s}</span>
                      </button>
                    ))}
                  </>
                )}

                {activeSkillFilter === 'required' &&
                  (missingRequiredSkills.length > 0 ? (
                    missingRequiredSkills.map((s, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleCopySkill(s)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition cursor-pointer"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        <span>{s}</span>
                        <FiCopy className="w-3 h-3 text-rose-400 ml-0.5" />
                      </button>
                    ))
                  ) : (
                    <p className="text-xs text-emerald-700 font-medium py-1">
                      🎉 Outstanding! All configured required skills were verified in your resume.
                    </p>
                  ))}

                {activeSkillFilter === 'preferred' &&
                  (missingPreferredSkills.length > 0 ? (
                    missingPreferredSkills.map((s, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleCopySkill(s)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition cursor-pointer"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        <span>{s}</span>
                        <FiCopy className="w-3 h-3 text-amber-400 ml-0.5" />
                      </button>
                    ))
                  ) : (
                    <p className="text-xs text-emerald-700 font-medium py-1">
                      ✨ Great work! All preferred skills are present in your resume.
                    </p>
                  ))}

                {activeSkillFilter === 'matched' &&
                  (matchedSkills.length > 0 ? (
                    matchedSkills.map((s, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleCopySkill(s)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition cursor-pointer"
                      >
                        <FiCheck className="w-3 h-3 text-emerald-600 font-bold" />
                        <span>{s}</span>
                      </button>
                    ))
                  ) : (
                    <p className="text-xs text-gray-500 py-1">
                      No matching role skills were extracted from the document.
                    </p>
                  ))}
              </div>
            </div>
          </div>

          {/* 3. TWO-COLUMN STRENGTHS & WEAKNESSES */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Candidate Strengths */}
            <div className="bg-white border border-emerald-200/90 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-emerald-100">
                <FiCheckCircle className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                  Candidate Strengths ({strengths.length})
                </h3>
              </div>

              {strengths.length > 0 ? (
                <div className="space-y-2.5">
                  {strengths.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50/50 border border-emerald-100 text-xs text-gray-800"
                    >
                      <FiCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{item}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 py-4">No strengths identified in this scan.</p>
              )}
            </div>

            {/* Areas to Strengthen */}
            <div className="bg-white border border-amber-200/90 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-amber-100">
                <FiAlertCircle className="w-5 h-5 text-amber-600" />
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                  Areas to Strengthen ({weaknesses.length})
                </h3>
              </div>

              {weaknesses.length > 0 ? (
                <div className="space-y-2.5">
                  {weaknesses.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50/50 border border-amber-100 text-xs text-gray-800"
                    >
                      <FiAlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{item}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 py-4">No critical weaknesses detected.</p>
              )}
            </div>
          </div>

          {/* 4. ACTIONABLE RECOMMENDATIONS */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-7 shadow-sm">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
              <FiTrendingUp className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                Actionable ATS Recommendations
              </h3>
            </div>

            {recommendations.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {recommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-gray-50/80 border border-gray-200/80 flex items-start gap-3 hover:border-gray-300 transition"
                  >
                    <span className="w-6 h-6 rounded-lg bg-[#111318] text-white text-xs font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <p className="text-xs leading-relaxed text-gray-800">{rec}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">No specific recommendations generated.</p>
            )}
          </div>
        </main>
      </div>
    );
  }

  // --------------------------------------------------
  // RENDER STEP 1: UPLOAD & ROLE SELECTION (SPLIT-SCREEN)
  // --------------------------------------------------
  return (
    <div className="min-h-screen bg-[#F8F9FA] text-gray-900 flex flex-col font-sans">
      {/* Sticky Studio Top Header */}
      <motion.nav
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand Mark + Studio Badge */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 group cursor-pointer text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-[#111318] flex items-center justify-center text-white font-black text-sm shadow-sm group-hover:scale-105 transition-transform">
                Y
              </div>
              <span className="font-extrabold text-base tracking-tight text-gray-900 hidden sm:inline">
                Yugam
              </span>
            </button>
            <span className="bg-[#111318] text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
              ATS Resume Scorer
            </span>
          </div>

          {/* Center 2-Step Stepper */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#111318] text-white shadow-xs">
              <span>1. Upload & Target Role</span>
            </div>
            <span className="text-gray-300 text-xs font-bold">→</span>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-400">
              <span>2. AI ATS Diagnostic Report</span>
            </div>
          </div>

          {/* Right Action: Back to Overview */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-200 rounded-full px-3.5 py-1.5 text-xs font-medium inline-flex items-center gap-1.5 transition cursor-pointer"
            >
              <FiArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Back to Overview</span>
            </button>
          </div>
        </div>
      </motion.nav>

      {/* Main Split-Screen Workspace */}
      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* ========================================================== */}
          {/* LEFT COLUMN: UPLOAD & ROLE CARD (7 cols on lg)             */}
          {/* ========================================================== */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {/* Obsidian Hero Header */}
            <div className="bg-[#111318] text-white rounded-3xl p-6 sm:p-7 shadow-md border border-gray-800 relative overflow-hidden">
              <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-0.5 rounded-full">
                    Step 1 of 2 • ATS Diagnostic
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        targetRole ? 'bg-emerald-900/60 text-emerald-300' : 'bg-gray-800 text-gray-400'
                      }`}
                    >
                      {targetRole ? '✓ Role Set' : 'Role Pending'}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        file ? 'bg-emerald-900/60 text-emerald-300' : 'bg-gray-800 text-gray-400'
                      }`}
                    >
                      {file ? '✓ PDF Ready' : 'PDF Pending'}
                    </span>
                  </div>
                </div>

                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-2">
                  ATS Resume Diagnostic & Role Match
                </h1>
                <p className="text-xs sm:text-sm text-gray-300 mt-1 max-w-lg leading-relaxed">
                  Select your target job role and upload your resume in PDF format to receive instant ATS keyword match percentages, skill gap analysis, and tailored recommendations.
                </p>
              </div>
            </div>

            {/* Elevated Form Card */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-7 shadow-sm space-y-6">
              {/* 1. Target Role Selector */}
              <div>
                <label htmlFor="targetRole" className="block text-xs font-bold text-gray-900 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <FiTarget className="text-indigo-600" />
                  Select Target Job Role
                </label>

                <select
                  id="targetRole"
                  value={targetRole}
                  onChange={(e) => {
                    setTargetRole(e.target.value);
                    setError('');
                  }}
                  disabled={rolesLoading || loading || roles.length === 0}
                  className="w-full h-11 rounded-xl bg-gray-50 border border-gray-300 px-3.5 text-xs sm:text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#111318] focus:border-transparent transition disabled:opacity-50"
                >
                  <option value="">{rolesLoading ? 'Loading role catalog...' : 'Choose your target role'}</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.label}
                    </option>
                  ))}
                </select>

                {/* Popular Quick-Select Role Chips */}
                <div className="mt-3">
                  <span className="text-[11px] text-gray-500 font-medium block mb-2">
                    Or select a popular track:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { id: 'mern-stack-developer', label: 'MERN Stack' },
                      { id: 'full-stack-software-engineer', label: 'Full-Stack Eng' },
                      { id: 'java-backend-developer', label: 'Java Backend' },
                      { id: 'frontend-developer', label: 'Frontend' },
                      { id: 'python-developer', label: 'Python Dev' },
                      { id: 'devops-engineer', label: 'DevOps' },
                      { id: 'data-analyst', label: 'Data Analyst' },
                    ].map((chip) => {
                      const isSelected = targetRole === chip.id;
                      return (
                        <button
                          key={chip.id}
                          type="button"
                          onClick={() => {
                            setTargetRole(chip.id);
                            setError('');
                          }}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium transition cursor-pointer ${
                            isSelected
                              ? 'bg-[#111318] text-white shadow-xs'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                          }`}
                        >
                          {chip.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 2. Drag-and-Drop PDF Dropzone */}
              <div>
                <label className="block text-xs font-bold text-gray-900 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <FiFileText className="text-indigo-600" />
                  Resume Document (PDF)
                </label>

                {!file ? (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={`relative flex flex-col items-center justify-center w-full min-h-[160px] rounded-2xl border-2 border-dashed transition-all cursor-pointer p-6 ${
                      isDragging
                        ? 'border-indigo-600 bg-indigo-50/50'
                        : 'border-gray-300 bg-gray-50/50 hover:bg-gray-50 hover:border-gray-400'
                    }`}
                  >
                    <input
                      id="resumeFile"
                      type="file"
                      accept=".pdf,application/pdf"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      disabled={loading}
                      onChange={handleFileChange}
                    />
                    <div className="w-12 h-12 rounded-2xl bg-white shadow-xs border border-gray-200 flex items-center justify-center text-indigo-600 mb-3">
                      <FiUploadCloud className="w-6 h-6" />
                    </div>
                    <p className="text-xs sm:text-sm font-semibold text-gray-800 text-center">
                      Click to upload or drag & drop your resume
                    </p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      PDF format only • Maximum file size 20 MB
                    </p>
                  </div>
                ) : (
                  /* Selected File Preview Card */
                  <div className="flex items-center justify-between p-4 rounded-xl border border-emerald-200 bg-emerald-50/40">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-white border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0 shadow-xs">
                        <FiFileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-bold text-gray-900 truncate">{file.name}</p>
                        <p className="text-[11px] text-emerald-700 font-medium">
                          {(file.size / (1024 * 1024)).toFixed(2)} MB • Ready for ATS scan
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-white rounded-lg transition cursor-pointer"
                      title="Remove file"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl p-3.5 text-xs text-red-800">
                  <FiAlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{error}</p>
                </div>
              )}

              {/* Primary Analyze CTA Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={uploadResume}
                  disabled={!file || !targetRole || loading || rolesLoading}
                  className="w-full h-12 rounded-xl font-bold text-xs sm:text-sm bg-[#111318] text-white hover:bg-black shadow-md hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <FiRefreshCw className="w-4 h-4 animate-spin" />
                      <span>Parsing & Analyzing Resume with AI...</span>
                    </>
                  ) : (
                    <>
                      <FiZap className="w-4 h-4 text-amber-400" />
                      <span>Analyze Resume & Calculate ATS Match</span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-center gap-2 mt-3 text-[11px] text-gray-500">
                  <FiShield className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Costs 10 Interview Coins • Instant multi-factor role feedback</span>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================== */}
          {/* RIGHT COLUMN: ROLE BENCHMARK PREVIEW (5 cols on lg)        */}
          {/* ========================================================== */}
          <div className="lg:col-span-5 sticky top-20 flex flex-col">
            {/* Header */}
            <div className="bg-[#111318] text-white rounded-t-2xl px-5 py-4 border-b border-gray-800 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-bold tracking-wider uppercase text-gray-100">
                  ATS Evaluation Benchmark
                </span>
              </div>
              <span className="text-[10px] bg-white/10 text-gray-300 font-mono px-2 py-0.5 rounded">
                Live Guide
              </span>
            </div>

            {/* Benchmark Card Body */}
            <div className="bg-white border-x border-b border-gray-200 rounded-b-2xl p-5 sm:p-6 shadow-sm space-y-5">
              {/* Active Role Benchmark Header */}
              <div className="border-b border-gray-100 pb-4">
                <span className="text-[10px] uppercase font-bold text-indigo-600 tracking-wider">
                  Target Role Profile
                </span>
                <h3 className="text-base font-bold text-gray-900 mt-0.5">{currentBenchmark.label}</h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{currentBenchmark.focus}</p>
              </div>

              {/* Required Core Skills Checklist */}
              <div>
                <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5 mb-2">
                  <FiCheckCircle className="text-emerald-600 w-3.5 h-3.5" />
                  Required Core Skills Evaluated:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {currentBenchmark.required.map((skill, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/80"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* Preferred Bonus Skills */}
              <div>
                <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5 mb-2">
                  <FiTrendingUp className="text-amber-600 w-3.5 h-3.5" />
                  Preferred Standout Skills:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {currentBenchmark.preferred.map((skill, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200/80"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* ATS Parser Checklist */}
              <div className="pt-4 border-t border-gray-100">
                <span className="text-xs font-bold text-gray-900 block mb-2">
                  What Recruiters Check in ATS:
                </span>
                <ul className="space-y-1.5 text-xs text-gray-600">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                    <span>Exact keyword matching for framework names</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                    <span>Quantifiable metrics in project descriptions</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                    <span>Clean section headings (Experience, Skills, Education)</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Scorer;
