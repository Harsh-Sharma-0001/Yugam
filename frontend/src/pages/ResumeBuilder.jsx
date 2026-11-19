import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  FiUser,
  FiFileText,
  FiCpu,
  FiBriefcase,
  FiFolder,
  FiBookOpen,
  FiArrowLeft,
  FiArrowRight,
  FiEye,
  FiCheck,
  FiZap,
  FiShield,
  FiLayers,
} from 'react-icons/fi';
import ResumeForm from '../components/resume/ResumeForm';
import initialData from '../components/resume/initialData';
import PreviewResume from '../components/resume/PreviewResume';
import DownloadBtn from '../components/resume/DownloadBtn';
import ATSTemplate from '../components/resume/ATSTemplate';

// 6 Structured Steps with Icons & Subtitles
const STEPS = [
  {
    step: 1,
    label: 'Personal',
    title: 'Personal Information',
    subtitle: 'Primary contact details, city, and professional profiles',
    icon: FiUser,
  },
  {
    step: 2,
    label: 'Summary',
    title: 'Professional Summary',
    subtitle: 'High-impact ATS summary tailored to your target role',
    icon: FiFileText,
  },
  {
    step: 3,
    label: 'Skills',
    title: 'Technical Skills',
    subtitle: 'Languages, frameworks, databases, and developer tools',
    icon: FiCpu,
  },
  {
    step: 4,
    label: 'Experience',
    title: 'Work Experience',
    subtitle: 'Internships, freelance work, and software engineering roles',
    icon: FiBriefcase,
  },
  {
    step: 5,
    label: 'Projects',
    title: 'Key Projects',
    subtitle: 'Production applications, open source, and full-stack projects',
    icon: FiFolder,
  },
  {
    step: 6,
    label: 'Education',
    title: 'Education & Academics',
    subtitle: 'Degrees, university, graduation year, and academic CGPA',
    icon: FiBookOpen,
  },
];

const TOTAL_STEPS = STEPS.length;

// Executive Accent Color Presets
const ACCENT_PRESETS = [
  {
    id: 'obsidian',
    name: 'Classic Obsidian',
    color: '#111318',
    bgClass: 'bg-[#111318]',
    borderClass: 'border-[#111318]',
    dotClass: 'bg-[#111318]',
    headerBorder: '#111318',
  },
  {
    id: 'indigo',
    name: 'Royal Indigo',
    color: '#312E81',
    bgClass: 'bg-[#312E81]',
    borderClass: 'border-[#312E81]',
    dotClass: 'bg-[#312E81]',
    headerBorder: '#312E81',
  },
  {
    id: 'emerald',
    name: 'Emerald Slate',
    color: '#065F46',
    bgClass: 'bg-[#065F46]',
    borderClass: 'border-[#065F46]',
    dotClass: 'bg-[#065F46]',
    headerBorder: '#065F46',
  },
];

// Helper: Check if step has filled criteria
const isStepComplete = (stepNum, d) => {
  if (!d) return false;
  switch (stepNum) {
    case 1:
      return Boolean(d.name?.trim() && d.email?.trim() && d.phone?.trim());
    case 2:
      return Boolean(d.summary?.trim() && d.summary.trim().length >= 30);
    case 3: {
      const list = d.skills ? d.skills.split(',').map((s) => s.trim()).filter(Boolean) : [];
      return list.length >= 3;
    }
    case 4:
      return Boolean(
        d.experience?.length > 0 &&
          d.experience.some((e) => e.role?.trim() && e.company?.trim())
      );
    case 5:
      return Boolean(d.projects?.length > 0 && d.projects.some((p) => p.name?.trim()));
    case 6:
      return Boolean(
        d.education?.length > 0 &&
          d.education.some((e) => e.degree?.trim() && e.college?.trim())
      );
    default:
      return false;
  }
};

// Helper: Calculate weighted 0%–100% Resume Completeness
const calculateCompleteness = (d) => {
  if (!d) return 0;
  let score = 0;

  // Personal Info (25%)
  if (d.name?.trim()) score += 5;
  if (d.email?.trim()) score += 5;
  if (d.phone?.trim()) score += 5;
  if (d.location?.trim()) score += 5;
  if (d.linkedin?.trim() || d.github?.trim()) score += 5;

  // Summary (15%)
  if (d.summary?.trim()) {
    if (d.summary.trim().length > 60) score += 15;
    else score += 8;
  }

  // Skills (20%)
  const skillsCount = d.skills
    ? d.skills.split(',').map((s) => s.trim()).filter(Boolean).length
    : 0;
  if (skillsCount >= 6) score += 20;
  else if (skillsCount >= 3) score += 12;
  else if (skillsCount > 0) score += 6;

  // Experience (15%)
  if (
    d.experience?.length > 0 &&
    d.experience.some((e) => e.role?.trim() && e.company?.trim())
  ) {
    score += 15;
  }

  // Projects (15%)
  if (d.projects?.length > 0 && d.projects.some((p) => p.name?.trim())) {
    score += 15;
  }

  // Education (10%)
  if (
    d.education?.length > 0 &&
    d.education.some((e) => e.degree?.trim() && e.college?.trim())
  ) {
    score += 10;
  }

  return Math.min(100, score);
};

function ResumeBuilder({ user, setUser }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState(initialData);
  const [showPreview, setShowPreview] = useState(false);
  const [mobileTab, setMobileTab] = useState('edit'); // 'edit' | 'preview'
  const [accent, setAccent] = useState('obsidian');

  const printRef = useRef(null);
  const navigate = useNavigate();

  const activeStep = STEPS.find((s) => s.step === currentStep) || STEPS[0];
  const completeness = calculateCompleteness(data);
  const activeAccent = ACCENT_PRESETS.find((a) => a.id === accent) || ACCENT_PRESETS[0];

  const goPrev = () => {
    if (currentStep > 1) setCurrentStep((prev) => prev - 1);
  };

  const goNext = () => {
    if (currentStep < TOTAL_STEPS) setCurrentStep((prev) => prev + 1);
  };

  // Full-screen modal fallback for mobile review
  if (showPreview) {
    return (
      <PreviewResume
        data={data}
        user={user}
        setUser={setUser}
        onBack={() => setShowPreview(false)}
      />
    );
  }

  // Parse candidate skills for live preview
  const skillsList = data.skills
    ? data.skills.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  const halfSkills = Math.ceil(skillsList.length / 2);
  const col1Skills = skillsList.slice(0, halfSkills);
  const col2Skills = skillsList.slice(halfSkills);

  const cleanLinkedin = data.linkedin
    ? data.linkedin
        .trim()
        .replace(/^https?:\/\//i, '')
        .replace(/^www\./i, '')
        .replace(/^linkedin\.com\/in\//i, '')
        .replace(/^linkedin\.com\//i, '')
        .replace(/\/+$/, '')
    : '';

  const cleanGithub = data.github
    ? data.github
        .trim()
        .replace(/^https?:\/\//i, '')
        .replace(/^www\./i, '')
        .replace(/^github\.com\//i, '')
        .replace(/\/+$/, '')
    : '';

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-gray-900 flex flex-col font-sans">
      {/* 1. STICKY TOP STUDIO HEADER */}
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
              Resume Studio
            </span>
          </div>

          {/* Center 6-Step Clickable Pill Stepper (Desktop & Tablet) */}
          <div className="hidden md:flex items-center gap-1.5 overflow-x-auto py-1 no-scrollbar">
            {STEPS.map((s) => {
              const Icon = s.icon;
              const isActive = s.step === currentStep;
              const isCompleted = isStepComplete(s.step, data);

              return (
                <button
                  key={s.step}
                  onClick={() => setCurrentStep(s.step)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 cursor-pointer ${
                    isActive
                      ? 'bg-[#111318] text-white shadow-sm ring-1 ring-black/10'
                      : isCompleted
                      ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
                  }`}
                >
                  {isCompleted && !isActive ? (
                    <FiCheck className="w-3.5 h-3.5 text-emerald-600 font-bold" />
                  ) : (
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                  )}
                  <span>
                    {s.step}. {s.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right Action Suite */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Back to Overview */}
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-200 rounded-full px-3.5 py-1.5 text-xs font-medium inline-flex items-center gap-1.5 transition cursor-pointer"
            >
              <FiArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Back to Overview</span>
            </button>

            {/* Mobile Tab Toggle (Edit / Preview) */}
            <div className="lg:hidden flex items-center bg-gray-100 p-0.5 rounded-full border border-gray-200 text-xs">
              <button
                onClick={() => setMobileTab('edit')}
                className={`px-2.5 py-1 rounded-full font-medium transition ${
                  mobileTab === 'edit'
                    ? 'bg-[#111318] text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Edit
              </button>
              <button
                onClick={() => setMobileTab('preview')}
                className={`px-2.5 py-1 rounded-full font-medium transition ${
                  mobileTab === 'preview'
                    ? 'bg-[#111318] text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Preview
              </button>
            </div>

            {/* Fullscreen Preview Icon (Desktop) */}
            <button
              onClick={() => setShowPreview(true)}
              title="Full-Screen High Res Preview"
              className="hidden sm:flex w-8 h-8 items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-400 bg-white transition cursor-pointer"
            >
              <FiEye className="w-4 h-4" />
            </button>

            {/* Primary Emerald Download / Export PDF Button */}
            <DownloadBtn
              docRef={printRef}
              user={user}
              setUser={setUser}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm px-4 py-1.5 rounded-full inline-flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
            >
              <span className="hidden sm:inline">Download PDF</span>
              <span className="sm:hidden">PDF</span>
            </DownloadBtn>
          </div>
        </div>

        {/* Mobile 6-Step Stepper Bar (Horizontal Scrollable) */}
        <div className="md:hidden flex items-center gap-1.5 overflow-x-auto px-4 py-2 border-t border-gray-100 bg-gray-50/80 no-scrollbar">
          {STEPS.map((s) => {
            const isActive = s.step === currentStep;
            const isCompleted = isStepComplete(s.step, data);
            return (
              <button
                key={s.step}
                onClick={() => {
                  setCurrentStep(s.step);
                  setMobileTab('edit');
                }}
                className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                  isActive
                    ? 'bg-[#111318] text-white shadow-xs'
                    : isCompleted
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-white text-gray-600 border border-gray-200'
                }`}
              >
                {isCompleted && !isActive ? (
                  <FiCheck className="w-3 h-3 text-emerald-600" />
                ) : (
                  <span>{s.step}.</span>
                )}
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>
      </motion.nav>

      {/* 2. MAIN TWO-COLUMN SPLIT WORKSPACE */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* ========================================================== */}
          {/* LEFT COLUMN: INTERACTIVE FORM CARD & HERO (7 cols on lg)   */}
          {/* ========================================================== */}
          <div
            className={`lg:col-span-7 flex flex-col gap-6 ${
              mobileTab === 'preview' ? 'hidden lg:flex' : 'flex'
            }`}
          >
            {/* Obsidian Hero Banner */}
            <div className="bg-[#111318] text-white rounded-2xl p-5 sm:p-6 shadow-md border border-gray-800 relative overflow-hidden">
              <div className="absolute top-0 right-0 -mr-8 -mt-8 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="flex items-start justify-between gap-4 relative z-10">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center text-white border border-white/10 shadow-inner">
                    {React.createElement(activeStep.icon, { className: 'w-5 h-5 text-emerald-400' })}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded">
                        Step {currentStep} of {TOTAL_STEPS}
                      </span>
                      {isStepComplete(currentStep, data) && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300 font-medium">
                          <FiCheck className="w-3 h-3" /> Section Completed
                        </span>
                      )}
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-1">
                      {activeStep.title}
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-300 mt-0.5">
                      {activeStep.subtitle}
                    </p>
                  </div>
                </div>

                {/* Score Pill */}
                <div className="text-right shrink-0">
                  <div className="text-xl sm:text-2xl font-extrabold text-emerald-400 font-mono">
                    {completeness}%
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-gray-400">
                    ATS Score
                  </div>
                </div>
              </div>

              {/* Animated Completeness Progress Bar */}
              <div className="mt-5 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-gray-300 font-medium flex items-center gap-1.5">
                    <FiZap className="w-3.5 h-3.5 text-amber-400" />
                    Resume Completeness Meter
                  </span>
                  <span className="text-emerald-400 font-semibold">{completeness}% filled</span>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden p-[1px]">
                  <motion.div
                    className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${completeness}%` }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-2">
                  {completeness >= 85
                    ? '✨ Exceptional profile! High ATS parse compatibility for top tech roles.'
                    : completeness >= 50
                    ? '📈 Great progress! Add measurable metrics to your work and projects.'
                    : '💡 Complete all 6 sections to maximize your resume ranking with recruiters.'}
                </p>
              </div>
            </div>

            {/* Elevated Form Card */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-7 shadow-sm">
              <ResumeForm step={currentStep} data={data} setData={setData} />

              {/* Bottom Step Navigation Bar */}
              <div className="mt-8 pt-6 border-t border-gray-200 flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={currentStep === 1}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium border transition cursor-pointer ${
                    currentStep === 1
                      ? 'border-gray-200 text-gray-300 bg-gray-50 cursor-not-allowed'
                      : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400'
                  }`}
                >
                  <FiArrowLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                {/* Step indicator dots */}
                <div className="hidden sm:flex items-center gap-1.5">
                  {STEPS.map((s) => (
                    <button
                      key={s.step}
                      type="button"
                      onClick={() => setCurrentStep(s.step)}
                      className={`h-2 rounded-full transition-all cursor-pointer ${
                        s.step === currentStep
                          ? 'w-6 bg-[#111318]'
                          : isStepComplete(s.step, data)
                          ? 'w-2 bg-emerald-500'
                          : 'w-2 bg-gray-300 hover:bg-gray-400'
                      }`}
                      title={s.label}
                    />
                  ))}
                </div>

                {currentStep === TOTAL_STEPS ? (
                  <button
                    type="button"
                    onClick={() => setShowPreview(true)}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-[#111318] text-white hover:bg-black shadow-sm transition cursor-pointer"
                  >
                    <FiEye className="w-4 h-4" />
                    <span>Review Full Resume</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={goNext}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-[#111318] text-white hover:bg-black shadow-sm transition cursor-pointer"
                  >
                    <span>Next Section</span>
                    <FiArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ========================================================== */}
          {/* RIGHT COLUMN: STICKY REAL-TIME ATS PREVIEW (5 cols on lg)  */}
          {/* ========================================================== */}
          <div
            className={`lg:col-span-5 sticky top-20 flex flex-col ${
              mobileTab === 'edit' ? 'hidden lg:flex' : 'flex'
            }`}
          >
            {/* Preview Obsidian Header */}
            <div className="bg-[#111318] text-white rounded-t-2xl px-4 py-3 border-b border-gray-800 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2.5">
                {/* Pulsing Beacon */}
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-bold tracking-wider uppercase text-gray-100">
                  Live ATS Resume Preview
                </span>
              </div>

              {/* Accent Color Presets */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-semibold text-gray-400 hidden sm:inline mr-1">
                  Accent:
                </span>
                {ACCENT_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setAccent(p.id)}
                    title={p.name}
                    className={`w-4 h-4 rounded-full transition-all cursor-pointer ${
                      p.dotClass
                    } ${
                      accent === p.id
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-[#111318] scale-110'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* A4 Paper Canvas */}
            <div
              className="bg-white border-x border-b border-gray-300 rounded-b-2xl shadow-xl p-6 sm:p-7 overflow-y-auto max-h-[calc(100vh-170px)] text-black font-serif select-text"
              style={{ fontFamily: "'Times New Roman', Times, serif" }}
            >
              {/* Header: Name + Contact */}
              <div
                className="mb-3 border-b-2 pb-2.5 text-center transition-colors"
                style={{ borderColor: activeAccent.headerBorder }}
              >
                <h2
                  className="m-0 mb-1.5 text-2xl font-bold uppercase tracking-wider transition-colors"
                  style={{ color: activeAccent.headerBorder }}
                >
                  {data.name?.trim() ? data.name : (
                    <span className="text-gray-400 font-medium">ALEXANDER CHEN</span>
                  )}
                </h2>

                <div className="flex flex-wrap justify-center text-[10px] text-gray-800 gap-x-1.5 gap-y-0.5">
                  {data.email?.trim() ||
                  data.phone?.trim() ||
                  data.location?.trim() ||
                  cleanLinkedin ||
                  cleanGithub ? (
                    <>
                      {data.email && <span>{data.email}</span>}
                      {data.email && data.phone && <span>|</span>}
                      {data.phone && <span>{data.phone}</span>}
                      {(data.email || data.phone) && data.location && <span>|</span>}
                      {data.location && <span>{data.location}</span>}
                      {(data.email || data.phone || data.location) && cleanLinkedin && <span>|</span>}
                      {cleanLinkedin && <span>linkedin.com/in/{cleanLinkedin}</span>}
                      {(data.email || data.phone || data.location || cleanLinkedin) &&
                        cleanGithub && <span>|</span>}
                      {cleanGithub && <span>github.com/{cleanGithub}</span>}
                    </>
                  ) : (
                    <span className="text-gray-400 italic">
                      alex.chen@example.com | +1 (555) 019-2834 | San Francisco, CA |
                      linkedin.com/in/alexchen | github.com/alexchen
                    </span>
                  )}
                </div>
              </div>

              {/* 1. Professional Summary Section */}
              <section className="mb-3.5">
                <h3
                  className="m-0 mb-1.5 border-b-[1.5px] pb-0.5 text-[10px] font-bold uppercase tracking-widest transition-colors"
                  style={{
                    borderColor: activeAccent.headerBorder,
                    color: activeAccent.headerBorder,
                  }}
                >
                  Professional Summary
                </h3>
                {data.summary?.trim() ? (
                  <p className="m-0 text-[10.5px] leading-relaxed text-gray-900">{data.summary}</p>
                ) : (
                  <p className="m-0 text-[10.5px] leading-relaxed text-gray-400 italic">
                    Results-driven software engineer with demonstrated experience designing and
                    scaling full-stack web applications, microservices, and modern user interfaces.
                    Proficient in cloud deployment, distributed systems, and modern agile delivery
                    pipelines.
                  </p>
                )}
              </section>

              {/* 2. Technical Skills Section */}
              <section className="mb-3.5">
                <h3
                  className="m-0 mb-1.5 border-b-[1.5px] pb-0.5 text-[10px] font-bold uppercase tracking-widest transition-colors"
                  style={{
                    borderColor: activeAccent.headerBorder,
                    color: activeAccent.headerBorder,
                  }}
                >
                  Technical Skills
                </h3>
                {skillsList.length > 0 ? (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10.5px] text-gray-900">
                    <ul className="list-disc pl-4 space-y-0.5">
                      {col1Skills.map((s, idx) => (
                        <li key={idx} className="capitalize">
                          {s}
                        </li>
                      ))}
                    </ul>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {col2Skills.map((s, idx) => (
                        <li key={idx} className="capitalize">
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10.5px] text-gray-400 italic">
                    <ul className="list-disc pl-4 space-y-0.5">
                      <li>JavaScript, TypeScript, React, Next.js</li>
                      <li>Node.js, Express, REST APIs, GraphQL</li>
                    </ul>
                    <ul className="list-disc pl-4 space-y-0.5">
                      <li>MongoDB, PostgreSQL, Redis</li>
                      <li>Docker, AWS, Git & CI/CD Pipelines</li>
                    </ul>
                  </div>
                )}
              </section>

              {/* 3. Work Experience Section */}
              <section className="mb-3.5">
                <h3
                  className="m-0 mb-1.5 border-b-[1.5px] pb-0.5 text-[10px] font-bold uppercase tracking-widest transition-colors"
                  style={{
                    borderColor: activeAccent.headerBorder,
                    color: activeAccent.headerBorder,
                  }}
                >
                  Work Experience
                </h3>
                {data.experience?.length > 0 &&
                data.experience.some((e) => e.role || e.company) ? (
                  <div className="space-y-2.5">
                    {data.experience.map((exp, idx) => (
                      <div key={idx}>
                        <div className="flex items-baseline justify-between text-[11px] font-bold text-gray-900">
                          <span>{exp.role || 'Software Engineering Intern'}</span>
                          <span className="text-[10px] font-normal text-gray-700">
                            {exp.duration || '2023 - 2024'}
                          </span>
                        </div>
                        <div className="text-[10.5px] italic text-gray-800">
                          {exp.company || 'Tech Innovations Corp.'}
                        </div>
                        {exp.description && (
                          <ul className="list-disc pl-4 mt-1 text-[10px] leading-relaxed text-gray-900 space-y-0.5">
                            {exp.description
                              .split('\n')
                              .map((l) => l.trim())
                              .filter(Boolean)
                              .map((line, lIdx) => (
                                <li key={lIdx}>{line.replace(/^[-•]\s*/, '')}</li>
                              ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-400 italic">
                    <div className="flex items-baseline justify-between text-[11px] font-bold">
                      <span>Senior Full-Stack Engineer</span>
                      <span className="text-[10px] font-normal">2023 - Present</span>
                    </div>
                    <div className="text-[10.5px]">Apex Cloud Technologies, Inc.</div>
                    <ul className="list-disc pl-4 mt-1 text-[10px] leading-relaxed space-y-0.5">
                      <li>
                        Architected resilient microservices reducing end-to-end latency by 32% across
                        100k+ active daily users.
                      </li>
                      <li>
                        Spearheaded migration of legacy services to React 18, TypeScript, and modern
                        headless REST APIs.
                      </li>
                    </ul>
                  </div>
                )}
              </section>

              {/* 4. Key Projects Section */}
              <section className="mb-3.5">
                <h3
                  className="m-0 mb-1.5 border-b-[1.5px] pb-0.5 text-[10px] font-bold uppercase tracking-widest transition-colors"
                  style={{
                    borderColor: activeAccent.headerBorder,
                    color: activeAccent.headerBorder,
                  }}
                >
                  Key Projects
                </h3>
                {data.projects?.length > 0 && data.projects.some((p) => p.name) ? (
                  <div className="space-y-2.5">
                    {data.projects.map((proj, idx) => (
                      <div key={idx}>
                        <div className="flex items-baseline justify-between text-[11px] font-bold text-gray-900">
                          <span>{proj.name || 'Cloud Scale Portfolio Project'}</span>
                          {proj.github && (
                            <span className="text-[10px] font-normal text-gray-700">
                              {proj.github}
                            </span>
                          )}
                        </div>
                        {proj.techStack && (
                          <div className="text-[10.5px] italic text-gray-800">
                            <span className="font-bold">Tech Stack: </span>
                            {proj.techStack}
                          </div>
                        )}
                        {proj.description && (
                          <ul className="list-disc pl-4 mt-1 text-[10px] leading-relaxed text-gray-900 space-y-0.5">
                            {proj.description
                              .split('\n')
                              .map((l) => l.trim())
                              .filter(Boolean)
                              .map((line, lIdx) => (
                                <li key={lIdx}>{line.replace(/^[-•]\s*/, '')}</li>
                              ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-400 italic">
                    <div className="flex items-baseline justify-between text-[11px] font-bold">
                      <span>Real-Time Code Collaboration Engine</span>
                      <span className="text-[10px] font-normal">github.com/alexchen/collab-code</span>
                    </div>
                    <div className="text-[10.5px]">
                      <span className="font-bold">Tech Stack: </span> React, WebSockets, Node.js,
                      Redis, Tailwind CSS
                    </div>
                    <ul className="list-disc pl-4 mt-1 text-[10px] leading-relaxed space-y-0.5">
                      <li>
                        Engineered real-time shared state sync with WebRTC and sub-50ms peer-to-peer
                        data channels.
                      </li>
                    </ul>
                  </div>
                )}
              </section>

              {/* 5. Education Section */}
              <section className="mb-2">
                <h3
                  className="m-0 mb-1.5 border-b-[1.5px] pb-0.5 text-[10px] font-bold uppercase tracking-widest transition-colors"
                  style={{
                    borderColor: activeAccent.headerBorder,
                    color: activeAccent.headerBorder,
                  }}
                >
                  Education
                </h3>
                {data.education?.length > 0 && data.education.some((e) => e.degree || e.college) ? (
                  <div className="space-y-2">
                    {data.education.map((edu, idx) => (
                      <div key={idx}>
                        <div className="flex items-baseline justify-between text-[11px] font-bold text-gray-900">
                          <span>
                            {edu.degree || 'Bachelor of Science'}
                            {edu.branch ? ` in ${edu.branch}` : ''}
                          </span>
                          <span className="text-[10px] font-normal text-gray-700">
                            {edu.year || '2020 - 2024'}
                          </span>
                        </div>
                        <div className="text-[10.5px] italic text-gray-800">
                          {edu.college || 'University of California, Berkeley'}
                          {edu.cgpa && (
                            <span className="ml-2 font-normal not-italic">
                              | CGPA: <strong>{edu.cgpa}</strong>
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-400 italic">
                    <div className="flex items-baseline justify-between text-[11px] font-bold">
                      <span>Bachelor of Technology in Computer Science & Engineering</span>
                      <span className="text-[10px] font-normal">2020 - 2024</span>
                    </div>
                    <div className="text-[10.5px]">
                      Institute of Engineering & Technology | CGPA: <strong>8.9 / 10.0</strong>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      </main>

      {/* Hidden millimeter-accurate printable container for react-to-print */}
      <div className="hidden">
        <div ref={printRef}>
          <ATSTemplate data={data} accentColor={activeAccent.headerBorder} />
        </div>
      </div>
    </div>
  );
}

export default ResumeBuilder;
