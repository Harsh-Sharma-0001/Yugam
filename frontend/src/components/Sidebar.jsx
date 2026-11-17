import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { GiArtificialHive, GiTwoCoins } from 'react-icons/gi';
import {
  FiFileText,
  FiLogOut,
  FiMap,
  FiPlus,
  FiSidebar,
  FiStar,
  FiCheckSquare,
  FiUsers,
  FiShield,
  FiEdit2,
  FiBriefcase,
  FiGrid,
  FiLayers,
  FiUser,
  FiAward,
} from 'react-icons/fi';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaCirclePlus } from 'react-icons/fa6';

function Sidebar({
  user,
  onNewInterview,
  onLogout,
  onOpenEditProfile,
  onSelectTab,
  activeTab = 'overview',
  sidebarOpen,
  setSidebarOpen,
  moblieOpen,
  setMoblieOpen,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const role = user?.role || 'student';
  const avatar = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  // Build role-tailored navigation items
  let navItems = [];

  if (role === 'student') {
    navItems = [
      {
        icon: <FiGrid size={15} />,
        label: 'Dashboard Overview',
        action: () => {
          if (location.pathname !== '/dashboard') navigate('/dashboard');
          if (onSelectTab) onSelectTab('overview');
        },
        isActive: location.pathname === '/dashboard' && activeTab === 'overview',
      },
      {
        icon: <FiCheckSquare size={15} />,
        label: 'Assigned Tasks',
        action: () => {
          if (location.pathname !== '/dashboard') navigate('/dashboard?tab=tasks');
          if (onSelectTab) onSelectTab('tasks');
        },
        isActive: location.pathname === '/dashboard' && activeTab === 'tasks',
      },
      {
        icon: <FiFileText size={15} />,
        label: 'Resume Builder',
        action: () => navigate('/resume'),
        isActive: location.pathname === '/resume',
      },
      {
        icon: <FiStar size={15} />,
        label: 'Resume Scorer',
        action: () => navigate('/scorer'),
        isActive: location.pathname === '/scorer',
      },
      {
        icon: <FiMap size={15} />,
        label: 'Roadmap Builder',
        action: () => navigate('/roadmap'),
        isActive: location.pathname === '/roadmap',
      },
    ];
  } else if (role === 'trainer') {
    navItems = [
      {
        icon: <FiGrid size={15} />,
        label: 'Overview & KPIs',
        action: () => {
          if (location.pathname !== '/dashboard') navigate('/dashboard');
          if (onSelectTab) onSelectTab('overview');
        },
        isActive: location.pathname === '/dashboard' && activeTab === 'overview',
      },
      {
        icon: <FiUsers size={15} />,
        label: 'Students Directory',
        action: () => {
          if (location.pathname !== '/dashboard') navigate('/dashboard?tab=students');
          if (onSelectTab) onSelectTab('students');
        },
        isActive: location.pathname === '/dashboard' && activeTab === 'students',
      },
      {
        icon: <FiCheckSquare size={15} />,
        label: 'Tasks & Assignments',
        action: () => {
          if (location.pathname !== '/dashboard') navigate('/dashboard?tab=tasks');
          if (onSelectTab) onSelectTab('tasks');
        },
        isActive: location.pathname === '/dashboard' && activeTab === 'tasks',
      },
      {
        icon: <FiBriefcase size={15} />,
        label: 'AI & Live Interviews',
        action: () => {
          if (location.pathname !== '/dashboard') {
            navigate('/dashboard?tab=interviews');
          } else {
            if (onSelectTab) onSelectTab('interviews');
          }
        },
        isActive: location.pathname === '/dashboard' && (activeTab === 'interviews' || activeTab === 'history'),
      },
      {
        icon: <FiEdit2 size={15} />,
        label: 'My Profile',
        action: () => onOpenEditProfile && onOpenEditProfile(),
        isActive: false,
      },
    ];
  } else if (role === 'admin') {
    navItems = [
      {
        icon: <FiGrid size={15} />,
        label: 'Institution Overview',
        action: () => {
          if (location.pathname !== '/dashboard') navigate('/dashboard');
          if (onSelectTab) onSelectTab('overview');
        },
        isActive: location.pathname === '/dashboard' && activeTab === 'overview',
      },
      {
        icon: <FiUsers size={15} />,
        label: 'Students',
        action: () => {
          if (location.pathname !== '/dashboard') navigate('/dashboard?tab=students');
          if (onSelectTab) onSelectTab('students');
        },
        isActive: location.pathname === '/dashboard' && activeTab === 'students',
      },
      {
        icon: <FiLayers size={15} />,
        label: 'Trainers',
        action: () => {
          if (location.pathname !== '/dashboard') navigate('/dashboard?tab=trainers');
          if (onSelectTab) onSelectTab('trainers');
        },
        isActive: location.pathname === '/dashboard' && activeTab === 'trainers',
      },
      {
        icon: <FiCheckSquare size={15} />,
        label: 'Tasks & Assignments',
        action: () => {
          if (location.pathname !== '/dashboard') navigate('/dashboard?tab=tasks');
          if (onSelectTab) onSelectTab('tasks');
        },
        isActive: location.pathname === '/dashboard' && activeTab === 'tasks',
      },
      {
        icon: <FiShield size={15} />,
        label: 'Permissions & Roles',
        action: () => {
          if (location.pathname !== '/dashboard') navigate('/dashboard?tab=governance');
          if (onSelectTab) onSelectTab('governance');
        },
        isActive: location.pathname === '/dashboard' && activeTab === 'governance',
      },
      {
        icon: <FiEdit2 size={15} />,
        label: 'My Profile',
        action: () => onOpenEditProfile && onOpenEditProfile(),
        isActive: false,
      },
    ];
  }

  const inner = (
    <div className="flex flex-col h-full">
      {/* Brand Header */}
      <div
        className={`px-3 h-[52px] border-b border-black/8 shrink-0 flex items-center ${
          sidebarOpen ? 'justify-between' : 'justify-center'
        }`}
      >
        {sidebarOpen && (
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#000000] flex items-center justify-center shrink-0 shadow-[0_4px_14px_rgba(0,0,0,0.25)]">
              <GiArtificialHive size={19} color="white" />
            </div>
            <div className="flex flex-col">
              <motion.span
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.15 }}
                className="font-extrabold text-sm tracking-tight text-[#0A0A0A] whitespace-nowrap leading-tight"
              >
                Yugam
              </motion.span>
              <span className="text-[9px] uppercase tracking-wider font-bold text-black/40">
                {user?.institutionId || 'College Portal'}
              </span>
            </div>
          </div>
        )}
        <div className="flex items-center">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="cursor-pointer hidden md:flex text-black/30 hover:text-[#0A0A0A] transition-colors shrink-0"
          >
            <FiSidebar size={15} />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setMoblieOpen(!moblieOpen)}
            className="cursor-pointer md:hidden text-black/30 hover:text-[#0A0A0A] transition-colors shrink-0"
          >
            <FiSidebar size={15} />
          </motion.button>
        </div>
      </div>

      {/* New Interview CTA (Active for Student / Trainer) */}
      <div className="px-2.5 pt-3 pb-1.5 shrink-0">
        <motion.button
          onClick={onNewInterview}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className={`w-full flex items-center gap-2 bg-[#000000] text-white font-semibold rounded-lg py-2 transition-all shadow-[0_4px_14px_rgba(0,0,0,0.25)] cursor-pointer hover:bg-[#1a1a1a] ${
            sidebarOpen ? 'px-2.5' : 'justify-center px-0'
          }`}
        >
          <FiPlus size={14} className="shrink-0" />
          <AnimatePresence>
            {sidebarOpen && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.13 }}
                className="text-xs whitespace-nowrap"
              >
                {role === 'trainer' ? 'Start Live Interview' : 'Create Interview'}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      <AnimatePresence>
        {sidebarOpen && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.13 }}
            className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-widest text-black/30"
          >
            {role.toUpperCase()} PORTAL
          </motion.p>
        )}
      </AnimatePresence>

      {/* Navigation Links */}
      <nav className="flex flex-col gap-0.5 px-2.5 flex-1 overflow-y-auto">
        {navItems.map((nav, i) => (
          <motion.button
            key={i}
            onClick={() => {
              nav.action();
              setMoblieOpen(false);
            }}
            whileHover={{ x: sidebarOpen ? 3 : 0 }}
            transition={{ duration: 0.13 }}
            className={`flex items-center gap-2.5 rounded-lg py-2 transition-all text-xs font-medium cursor-pointer ${
              nav.isActive
                ? 'bg-black text-white font-semibold shadow-sm'
                : 'text-black/60 hover:text-[#0A0A0A] hover:bg-black/5'
            } ${sidebarOpen ? 'px-2.5' : 'justify-center px-0'}`}
          >
            <span className="shrink-0">{nav.icon}</span>

            {sidebarOpen && <span className="whitespace-nowrap">{nav.label}</span>}
          </motion.button>
        ))}
      </nav>

      {/* Coins / Balance Strip */}
      <div className="border-t border-black/8 p-2.5 shrink-0">
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.13 }}
              onClick={() => navigate('/billing')}
              className="group flex cursor-pointer items-center justify-between gap-2.5 rounded-lg border border-white/10 bg-[#000000]/90 backdrop-blur-2xl px-2.5 py-1.5 mb-2.5 transition-all hover:border-white/20 shadow-[0_8px_24px_rgba(0,0,0,0.2)]"
            >
              <div className="flex items-center gap-1.5">
                <GiTwoCoins size={15} className="text-yellow-500 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase tracking-wider text-white/40 font-medium">
                    Interview Coins
                  </span>
                  <span className="text-xs font-bold text-white">
                    {user?.interviewCoin ?? 150}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-center">
                <FaCirclePlus
                  size={16}
                  className="text-white/70 transition-transform duration-200 group-hover:scale-110"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Profile Card & Role Pill */}
        {!user ? (
          <div className={`flex items-center gap-2 ${sidebarOpen ? '' : 'justify-center'} py-1 animate-pulse`}>
            <div className="w-7 h-7 rounded-full bg-zinc-200 shrink-0" />
            {sidebarOpen && (
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="h-3 bg-zinc-200 rounded w-16" />
                <div className="h-2 bg-zinc-100 rounded w-24" />
              </div>
            )}
          </div>
        ) : (
          <div
            className={`flex items-center gap-2 ${
              sidebarOpen ? '' : 'justify-center'
            }`}
          >
            <div
              onClick={() => onOpenEditProfile && onOpenEditProfile()}
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 cursor-pointer hover:ring-2 hover:ring-black/20 transition ${
                role === 'admin'
                  ? 'bg-emerald-600 text-white'
                  : role === 'trainer'
                  ? 'bg-purple-600 text-white'
                  : 'bg-black text-white'
              }`}
              title="Click to edit profile"
            >
              <span className="font-bold text-[10px]">{avatar}</span>
            </div>

            <AnimatePresence>
              {sidebarOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => onOpenEditProfile && onOpenEditProfile()}
                  className="flex-1 min-w-0 cursor-pointer group"
                >
                  <div className="flex items-center gap-1.5">
                    <p className="text-[#0A0A0A] text-[11px] font-semibold truncate group-hover:text-blue-600 transition">
                      {user.name || user.email?.split('@')[0]}
                    </p>
                    <span
                      className={`inline-flex items-center gap-1 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${
                        role === 'admin'
                          ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30'
                          : role === 'trainer'
                          ? 'bg-purple-500/15 text-purple-700 border-purple-500/30'
                          : 'bg-blue-500/15 text-blue-700 border-blue-500/30'
                      }`}
                    >
                      {role === 'admin' && <FiShield size={9} />}
                      {role === 'trainer' && <FiAward size={9} />}
                      {role === 'student' && <FiUser size={9} />}
                      <span>{role}</span>
                    </span>
                  </div>
                  <p className="text-black/35 text-[9px] truncate">
                    {user.email}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {sidebarOpen && (
                <div className="flex items-center gap-1 ml-auto">
                  <motion.button
                    onClick={() => onOpenEditProfile && onOpenEditProfile()}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    whileHover={{ scale: 1.15 }}
                    title="Edit Profile"
                    className="text-black/30 hover:text-[#0A0A0A] transition-colors p-1"
                  >
                    <FiEdit2 size={12} />
                  </motion.button>
                  <motion.button
                    onClick={onLogout}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    whileHover={{ scale: 1.15 }}
                    title="Logout"
                    className="text-black/30 hover:text-red-600 transition-colors p-1"
                  >
                    <FiLogOut size={13} />
                  </motion.button>
                </div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <motion.aside
        animate={{ width: sidebarOpen ? 260 : 72 }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className="hidden md:flex fixed top-0 left-0 h-screen bg-white border-r border-black/8 flex-col z-40 overflow-hidden"
      >
        {inner}
      </motion.aside>

      <AnimatePresence>
        {moblieOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMoblieOpen(false)}
            className="fixed inset-0 bg-black/30 z-40 md:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {moblieOpen && (
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="fixed top-0 left-0 h-screen w-[280px] max-w-[85vw] bg-white border-r border-black/8 flex flex-col z-50 md:hidden overflow-hidden"
          >
            {inner}
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

export default Sidebar;
