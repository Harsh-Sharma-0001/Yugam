import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FiX,
  FiUser,
  FiAward,
  FiCheckCircle,
  FiClock,
  FiAlertCircle,
  FiBriefcase,
  FiBook,
  FiPhone,
  FiLink,
  FiSave,
} from 'react-icons/fi';
import { updateProfile } from '../apis/user.api';

function EditProfileModal({ isOpen, onClose, user, onProfileUpdated }) {
  const role = user?.role || 'student';
  const profile = user?.profile || {};

  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Student states
  const [rollNumber, setRollNumber] = useState('');
  const [collegeName, setCollegeName] = useState('');
  const [course, setCourse] = useState('');
  const [year, setYear] = useState('');
  const [semester, setSemester] = useState('');
  const [section, setSection] = useState('');
  const [currentCGPA, setCurrentCGPA] = useState('');
  const [tenthPercentage, setTenthPercentage] = useState('');
  const [twelfthPercentage, setTwelfthPercentage] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [resumeUrl, setResumeUrl] = useState('');

  // Trainer / Admin states
  const [employeeId, setEmployeeId] = useState('');
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');
  const [specializations, setSpecializations] = useState('');
  const [yearsOfExperience, setYearsOfExperience] = useState('');
  const [bio, setBio] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      const p = user.profile || {};
      setRollNumber(p.rollNumber || '');
      setCollegeName(p.collegeName || '');
      setCourse(p.course || '');
      setYear(p.year !== undefined ? String(p.year) : '');
      setSemester(p.semester !== undefined ? String(p.semester) : '');
      setSection(p.section || '');
      setCurrentCGPA(p.currentCGPA !== undefined ? String(p.currentCGPA) : '');
      setTenthPercentage(
        p.academics?.tenthPercentage !== undefined
          ? String(p.academics.tenthPercentage)
          : ''
      );
      setTwelfthPercentage(
        p.academics?.twelfthPercentage !== undefined
          ? String(p.academics.twelfthPercentage)
          : ''
      );
      setContactNumber(p.contactNumber || '');
      setResumeUrl(p.resumeUrl || '');

      setEmployeeId(p.employeeId || '');
      setDepartment(p.department || '');
      setDesignation(p.designation || '');
      setSpecializations(
        Array.isArray(p.specializations) ? p.specializations.join(', ') : ''
      );
      setYearsOfExperience(
        p.yearsOfExperience !== undefined ? String(p.yearsOfExperience) : ''
      );
      setBio(p.bio || '');

      setError(null);
      setSuccessMsg(null);
    }
  }, [user, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const payload = {
        name,
        profile: {},
      };

      if (role === 'student') {
        payload.profile = {
          rollNumber,
          collegeName,
          course,
          year: year ? Number(year) : undefined,
          semester: semester ? Number(semester) : undefined,
          section,
          currentCGPA: currentCGPA !== '' ? Number(currentCGPA) : undefined,
          academics: {
            tenthPercentage:
              tenthPercentage !== '' ? Number(tenthPercentage) : undefined,
            twelfthPercentage:
              twelfthPercentage !== '' ? Number(twelfthPercentage) : undefined,
          },
          contactNumber,
          resumeUrl,
        };
      } else if (role === 'trainer') {
        payload.profile = {
          employeeId,
          collegeName,
          department,
          designation,
          specializations: specializations
            ? specializations
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
          yearsOfExperience:
            yearsOfExperience !== '' ? Number(yearsOfExperience) : undefined,
          contactNumber,
          bio,
        };
      } else if (role === 'admin') {
        payload.profile = {
          employeeId,
          collegeName,
          department,
          designation,
          contactNumber,
        };
      }

      const res = await updateProfile(payload);
      if (res.success && res.user) {
        setSuccessMsg(
          role === 'student' &&
            res.user.profile?.academicVerificationStatus === 'pending'
            ? 'Profile updated. Academic edits are pending administrator verification.'
            : 'Profile saved successfully!'
        );
        if (onProfileUpdated) {
          onProfileUpdated(res.user);
        }
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setError(res.message || 'Failed to update profile.');
      }
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || 'Failed to update profile.'
      );
    } finally {
      setLoading(false);
    }
  };

  const verificationStatus = profile.academicVerificationStatus || 'unsubmitted';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="bg-[#0E1016] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl text-white overflow-hidden my-auto"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white">
                <FiUser size={18} />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold">Edit Profile</h3>
                <p className="text-xs text-zinc-400 capitalize">
                  {role} Account • {user?.institutionId || 'DEFAULT_COLLEGE'}
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

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5">
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

            {/* Academic Verification Status Banner for Students */}
            {role === 'student' && (
              <div className="bg-[#17181E] border border-white/5 rounded-xl p-3.5 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-300">
                      Academic Verification:
                    </span>
                    {verificationStatus === 'verified' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <FiCheckCircle size={11} /> Verified
                      </span>
                    )}
                    {verificationStatus === 'pending' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        <FiClock size={11} /> Pending Admin Verification
                      </span>
                    )}
                    {verificationStatus === 'unsubmitted' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-zinc-500/15 text-zinc-400 border border-zinc-500/30">
                        Unverified
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-normal">
                    {verificationStatus === 'verified'
                      ? 'Your GPA and percentage marks are institutionally verified. Any changes to academic fields will enter a pending state for Admin/Trainer review.'
                      : verificationStatus === 'pending'
                      ? 'You have submitted updated marks/CGPA. They will appear on your verified transcript once approved by college administrators.'
                      : 'Submit your college marks and CGPA for faculty/placement verification.'}
                  </p>
                </div>
              </div>
            )}

            {/* Basic Info: Full Name */}
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 outline-none focus:border-white/30 transition"
              />
            </div>

            {/* STUDENT ROLE FIELDS */}
            {role === 'student' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                      University Roll / Reg Number
                    </label>
                    <input
                      type="text"
                      value={rollNumber}
                      onChange={(e) => setRollNumber(e.target.value)}
                      placeholder="e.g. 21BCSE102"
                      className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 outline-none focus:border-white/30 transition"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                      College / Institution Name
                    </label>
                    <input
                      type="text"
                      value={collegeName}
                      onChange={(e) => setCollegeName(e.target.value)}
                      placeholder="e.g. National Institute of Technology"
                      className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 outline-none focus:border-white/30 transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                      Course / Degree
                    </label>
                    <input
                      type="text"
                      value={course}
                      onChange={(e) => setCourse(e.target.value)}
                      placeholder="e.g. B.Tech CSE"
                      className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 outline-none focus:border-white/30 transition"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                      Year (1-6)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="6"
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      placeholder="e.g. 3"
                      className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 outline-none focus:border-white/30 transition"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                      Semester (1-12)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={semester}
                      onChange={(e) => setSemester(e.target.value)}
                      placeholder="e.g. 5"
                      className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 outline-none focus:border-white/30 transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                      Section / Batch
                    </label>
                    <input
                      type="text"
                      value={section}
                      onChange={(e) => setSection(e.target.value)}
                      placeholder="e.g. CSE-A"
                      className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 outline-none focus:border-white/30 transition"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                      Current CGPA (0 - 10)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="10"
                      value={currentCGPA}
                      onChange={(e) => setCurrentCGPA(e.target.value)}
                      placeholder="e.g. 8.75"
                      className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 outline-none focus:border-white/30 transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                      Class 10th Percentage (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={tenthPercentage}
                      onChange={(e) => setTenthPercentage(e.target.value)}
                      placeholder="e.g. 91.5"
                      className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 outline-none focus:border-white/30 transition"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                      Class 12th Percentage (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={twelfthPercentage}
                      onChange={(e) => setTwelfthPercentage(e.target.value)}
                      placeholder="e.g. 88.4"
                      className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 outline-none focus:border-white/30 transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                      Contact / Phone Number
                    </label>
                    <input
                      type="tel"
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value)}
                      placeholder="+91 9876543210"
                      className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 outline-none focus:border-white/30 transition"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                      Resume Link / Portfolio URL
                    </label>
                    <input
                      type="url"
                      value={resumeUrl}
                      onChange={(e) => setResumeUrl(e.target.value)}
                      placeholder="https://drive.google.com/..."
                      className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 outline-none focus:border-white/30 transition"
                    />
                  </div>
                </div>
              </>
            )}

            {/* TRAINER ROLE FIELDS */}
            {role === 'trainer' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                      Employee ID / Staff Code
                    </label>
                    <input
                      type="text"
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                      placeholder="e.g. TR-204"
                      className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 outline-none focus:border-white/30 transition"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                      College / Institution Name
                    </label>
                    <input
                      type="text"
                      value={collegeName}
                      onChange={(e) => setCollegeName(e.target.value)}
                      placeholder="e.g. School of Engineering & Technology"
                      className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 outline-none focus:border-white/30 transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                      Department
                    </label>
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="e.g. Computer Science & AI"
                      className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 outline-none focus:border-white/30 transition"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                      Designation
                    </label>
                    <input
                      type="text"
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      placeholder="e.g. Lead Technical Trainer / Assistant Professor"
                      className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 outline-none focus:border-white/30 transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                      Technical Specializations (comma separated)
                    </label>
                    <input
                      type="text"
                      value={specializations}
                      onChange={(e) => setSpecializations(e.target.value)}
                      placeholder="e.g. DSA, System Design, Full-Stack, Java"
                      className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 outline-none focus:border-white/30 transition"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                      Years of Experience
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={yearsOfExperience}
                      onChange={(e) => setYearsOfExperience(e.target.value)}
                      placeholder="e.g. 6"
                      className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 outline-none focus:border-white/30 transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                      Contact Number
                    </label>
                    <input
                      type="tel"
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value)}
                      placeholder="+91 9876543210"
                      className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 outline-none focus:border-white/30 transition"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                      Short Trainer Bio
                    </label>
                    <input
                      type="text"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="e.g. 8+ years coaching college students for Tier-1 placements."
                      className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 outline-none focus:border-white/30 transition"
                    />
                  </div>
                </div>
              </>
            )}

            {/* ADMIN ROLE FIELDS */}
            {role === 'admin' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                      Staff / Employee ID
                    </label>
                    <input
                      type="text"
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                      placeholder="e.g. ADM-01"
                      className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 outline-none focus:border-white/30 transition"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                      College / Institution Name
                    </label>
                    <input
                      type="text"
                      value={collegeName}
                      onChange={(e) => setCollegeName(e.target.value)}
                      placeholder="e.g. State Engineering University"
                      className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 outline-none focus:border-white/30 transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                      Department / Office
                    </label>
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="e.g. Training & Placement Cell"
                      className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 outline-none focus:border-white/30 transition"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                      Designation
                    </label>
                    <input
                      type="text"
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      placeholder="e.g. Head of Placements / Dean Academics"
                      className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 outline-none focus:border-white/30 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                    Contact Number
                  </label>
                  <input
                    type="tel"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    placeholder="+91 9876543210"
                    className="w-full bg-[#17181E] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 outline-none focus:border-white/30 transition"
                  />
                </div>
              </>
            )}

            {/* Footer Buttons */}
            <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3">
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
                className="px-5 py-2 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-bold transition shadow-sm inline-flex items-center gap-1.5"
              >
                <FiSave size={14} />
                <span>{loading ? 'Saving...' : 'Save Profile'}</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default EditProfileModal;
