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
    description: 'Access AI mock interviews, live faculty rooms, resumes, and roadmaps.',
  },
  {
    id: 'trainer',
    label: 'Technical Trainer',
    icon: FiAward,
    badgeColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    description: 'Conduct live video interviews, grade rubrics, and review student progress.',
  },
  {
    id: 'admin',
    label: 'College Admin',
    icon: FiShield,
    badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    description: 'Manage institutional student rosters, assign trainers, and audit records.',
  },
];

function LoginPage({ setUser }) {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState('student');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const activeTabMeta = ROLE_TABS.find((t) => t.id === selectedRole) || ROLE_TABS[0];

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, provider);
      const token = await result.user.getIdToken();

      const response = await api.post('/api/auth/login', {
        token,
        intendedRole: selectedRole,
        authMode: 'login',
      });

      if (response.data?.success && response.data?.user) {
        setUser(response.data.user);
        navigate('/dashboard', { replace: true });
      } else {
        throw new Error(response.data?.message || 'Login failed.');
      }
    } catch (err) {
      console.error('Google login error:', err);
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
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-black/[0.03] blur-[100px] pointer-events-none" />

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
              Log In to Yugam
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Select your institution role to enter your workspace
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

          {/* Role Context Pill */}
          <div className="bg-[#17181E] border border-white/5 rounded-2xl p-3 mb-6 text-center">
            <span
              className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border mb-1.5 ${activeTabMeta.badgeColor}`}
            >
              <activeTabMeta.icon size={11} />
              <span>{activeTabMeta.label} Portal</span>
            </span>
            <p className="text-xs text-zinc-300 leading-relaxed">{activeTabMeta.description}</p>
          </div>

          {/* Error Banner */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-2xl p-3.5 mb-5 flex items-start gap-2.5 text-xs leading-relaxed"
            >
              <FiAlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">{error}</div>
            </motion.div>
          )}

          {/* Google Sign In CTA */}
          <motion.button
            onClick={handleGoogleLogin}
            disabled={loading}
            whileHover={{ scale: loading ? 1 : 1.02 }}
            whileTap={{ scale: loading ? 1 : 0.98 }}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 hover:border-white/30 text-white font-bold text-xs sm:text-sm shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <FcGoogle size={20} />
            )}
            <span>
              {loading
                ? 'Verifying Credentials...'
                : `Continue with Google as ${activeTabMeta.label}`}
            </span>
          </motion.button>

          {/* Footer Navigation */}
          <div className="mt-6 pt-5 border-t border-white/10 text-center">
            <p className="text-xs text-zinc-400">
              New to Yugam?{' '}
              <Link
                to={`/signup?role=${selectedRole}`}
                className="text-white font-bold hover:underline transition"
              >
                Create an account →
              </Link>
            </p>
          </div>
        </motion.div>
      </main>

      {/* Footer Info */}
      <footer className="w-full max-w-5xl mx-auto px-6 py-4 text-center text-xs text-black/40 z-10">
        © 2026 Yugam Autonomous Interview & Assessment Platform. Secure SSO powered by Firebase.
      </footer>
    </div>
  );
}

export default LoginPage;
