import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate, Link } from 'react-router-dom';
import { GiArtificialHive } from 'react-icons/gi';
import { FcGoogle } from 'react-icons/fc';
import {
  FiUser,
  FiAward,
  FiShield,
  FiArrowLeft,
  FiAlertCircle,
  FiCheckCircle,
  FiBookOpen,
  FiHash,
  FiBriefcase,
} from 'react-icons/fi';
import { signInWithPopup } from 'firebase/auth';
import { auth, provider } from '../utils/firebase';
import api from '../utils/axios';

const ROLE_TABS = [
  {
    id: 'student',
    label: 'Student',
    icon: FiUser,
    badgeColor: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    description: 'Access AI mock interviews, faculty live rooms, resume scorer, and roadmaps.',
  },
  {
    id: 'trainer',
    label: 'Technical Trainer',
    icon: FiAward,
    badgeColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    description: 'Conduct live video interviews, run synced code tests, and grade student rubrics.',
  },
  {
    id: 'admin',
    label: 'College Admin',
    icon: FiShield,
    badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    description: 'Oversee student performance directories, provision trainers, and audit institutional KPIs.',
  },
];

function SignupPage({ setUser }) {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState('student');
  const [collegeName, setCollegeName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const activeTabMeta = ROLE_TABS.find((t) => t.id === selectedRole) || ROLE_TABS[0];

  const handleGoogleSignup = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, provider);
      const token = await result.user.getIdToken();

      const payload = {
        token,
        intendedRole: selectedRole,
        authMode: 'signup',
        collegeName: collegeName.trim() || undefined,
        rollNumber: selectedRole === 'student' ? (rollNumber.trim() || undefined) : undefined,
        employeeId: selectedRole !== 'student' ? (employeeId.trim() || undefined) : undefined,
      };

      const response = await api.post('/api/auth/login', payload);

      if (response.data?.success && response.data?.user) {
        setUser(response.data.user);
        navigate('/dashboard', { replace: true });
      } else {
        throw new Error(response.data?.message || 'Sign up failed.');
      }
    } catch (err) {
      console.error('Google sign up error:', err);
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Authentication failed. Please check your network and try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#0A0A0A] font-sans flex flex-col justify-between relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] rounded-full bg-black/[0.03] blur-[110px] pointer-events-none" />

      {/* Top Navigation */}
      <header className="w-full max-w-5xl mx-auto px-6 py-5 flex items-center justify-between z-10">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-7 h-7 rounded-lg bg-[#0A0A0A] flex items-center justify-center shadow-[0_4px_14px_rgba(0,0,0,0.18)]">
            <GiArtificialHive size={15} color="white" />
          </div>
          <span className="font-extrabold text-base tracking-tight text-[#0A0A0A]">Yugam</span>
        </Link>

        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-black/60 hover:text-black transition"
        >
          <FiArrowLeft size={13} />
          <span>Back to Home</span>
        </Link>
      </header>

      {/* Main Obsidian Card */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 z-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative w-full max-w-md bg-[#0E1016] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.35)] text-white"
        >
          {/* Subtle gradient sheen */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] via-transparent to-transparent rounded-3xl pointer-events-none" />

          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center mx-auto mb-3 shadow-inner">
              <GiArtificialHive size={20} className="text-white" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Create Yugam Account
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Select your role to get started with your institution
            </p>
          </div>

          {/* 3 Role Tabs */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#17181E] border border-white/10 rounded-2xl mb-4">
            {ROLE_TABS.map((tab) => {
              const Icon = tab.icon;
              const isSelected = selectedRole === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setSelectedRole(tab.id);
                    setError(null);
                  }}
                  className={`py-2 px-1.5 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                    isSelected
                      ? 'bg-white text-black shadow-md'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon size={14} className={isSelected ? 'text-black' : 'text-zinc-400'} />
                  <span className="truncate w-full text-center text-[11px]">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Active Role Meta Card */}
          <div className="p-3 rounded-2xl bg-[#14151C] border border-white/5 mb-4 text-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Target Role
              </span>
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${activeTabMeta.badgeColor}`}
              >
                {activeTabMeta.label.toUpperCase()}
              </span>
            </div>
            <p className="text-zinc-300 text-[11px] leading-relaxed">
              {activeTabMeta.description}
            </p>
          </div>

          {/* Optional Pre-configuration Form Fields */}
          <div className="space-y-3 mb-5">
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1 flex items-center gap-1">
                <FiBookOpen size={11} />
                <span>College / Institution Name (Optional)</span>
              </label>
              <input
                type="text"
                value={collegeName}
                onChange={(e) => setCollegeName(e.target.value)}
                placeholder="e.g. DEFAULT_COLLEGE or University Name"
                className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 transition"
              />
            </div>

            {selectedRole === 'student' ? (
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1 flex items-center gap-1">
                  <FiHash size={11} />
                  <span>University Roll Number (Optional)</span>
                </label>
                <input
                  type="text"
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                  placeholder="e.g. 2315000916"
                  className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 transition"
                />
              </div>
            ) : (
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1 flex items-center gap-1">
                  <FiBriefcase size={11} />
                  <span>Faculty Employee ID / Code (Optional)</span>
                </label>
                <input
                  type="text"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="e.g. EMP-10492"
                  className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 transition"
                />
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-start gap-2 mb-4 leading-relaxed"
            >
              <FiAlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block mb-0.5">Registration Error</span>
                <span>{error}</span>
              </div>
            </motion.div>
          )}

          {/* Google Sign Up Button */}
          <button
            onClick={handleGoogleSignup}
            disabled={loading}
            className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-zinc-100 text-black font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2.5 transition-all shadow-[0_4px_20px_rgba(255,255,255,0.12)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
            ) : (
              <>
                <FcGoogle size={18} />
                <span>Sign Up with Google as {activeTabMeta.label}</span>
              </>
            )}
          </button>

          {/* Security Note */}
          <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-zinc-500">
            <FiCheckCircle size={11} className="text-zinc-400" />
            <span>Secure Firebase Google OAuth & College RBAC</span>
          </div>

          {/* Footer Navigation */}
          <div className="mt-6 pt-5 border-t border-white/10 text-center text-xs text-zinc-400">
            <span>Already have an account? </span>
            <Link
              to="/login"
              className="font-bold text-white hover:underline transition ml-1"
            >
              Log In →
            </Link>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-5xl mx-auto px-6 py-4 text-center text-xs text-black/40 z-10">
        © {new Date().getFullYear()} Yugam · Institutional Career & Placement Platform
      </footer>
    </div>
  );
}

export default SignupPage;
