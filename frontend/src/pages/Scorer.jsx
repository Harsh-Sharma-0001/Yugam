
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";

import {
  FiAlertCircle,
  FiTrendingUp,
  FiUploadCloud,
  FiUser,
  FiZap,
  FiCheckCircle,
  FiTarget,
  FiBookOpen,
  FiRefreshCw,
  FiFileText,
} from "react-icons/fi";

import api from "../utils/axios";
import { useDispatch, useSelector } from "react-redux";
import { setResume } from "../redux/resumeSlice";

import {
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
} from "recharts";

import { useCoins } from "../apis/user.api";
import { getResumeRoles } from "../apis/resume.api";

// --------------------------------------------------
// CONSTANTS
// --------------------------------------------------

const MAX_FILE_SIZE = 20 * 1024 * 1024;

const SCORE_LABELS = {
  strong: "Strong",
  average: "Average",
  weak: "Needs Improvement",
};

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

const getScoreLabel = (score) => {
  if (score >= 75) return SCORE_LABELS.strong;
  if (score >= 50) return SCORE_LABELS.average;
  return SCORE_LABELS.weak;
};

const getScoreColor = (score) => {
  if (score >= 75) return "#7c3aed";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
};

const getSafeScore = (score) => {
  const value = Number(score);

  if (!Number.isFinite(value)) return 0;

  return Math.min(100, Math.max(0, value));
};

// --------------------------------------------------
// SCORE RING
// --------------------------------------------------

const ScoreRing = ({ score }) => {
  const safeScore = getSafeScore(score);
  const color = getScoreColor(safeScore);

  return (
    <div className="relative flex items-center justify-center">
      <RadialBarChart
        width={120}
        height={120}
        cx={60}
        cy={60}
        innerRadius={43}
        outerRadius={56}
        startAngle={90}
        endAngle={-270}
        data={[
          {
            value: safeScore,
            fill: color,
          },
        ]}
        barSize={9}
      >
        <PolarAngleAxis
          type="number"
          domain={[0, 100]}
          tick={false}
        />

        <RadialBar
          background={{ fill: "#e5e7eb" }}
          dataKey="value"
          cornerRadius={8}
        />
      </RadialBarChart>

      <div className="absolute flex items-center">
        <span className="text-xl font-bold text-white leading-none">
          {safeScore}
        </span>

        <span className="text-[9px] text-gray-200 mt-0.5">
          /100
        </span>
      </div>
    </div>
  );
};

// --------------------------------------------------
// TAG
// --------------------------------------------------

const Tag = ({ text, color = "purple" }) => {
  const styles = {
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    red: "bg-red-50 text-red-700 border-red-200",
    green: "bg-green-50 text-green-700 border-green-200",
    yellow: "bg-yellow-50 text-yellow-700 border-yellow-200",
  };

  return (
    <span
      className={`inline-flex items-center text-[10px] px-2 py-1.5 rounded-md border font-medium ${styles[color] || styles.purple}`}
    >
      {text}
    </span>
  );
};

// --------------------------------------------------
// EMPTY STATE
// --------------------------------------------------

const EmptyState = ({ message }) => (
  <p className="text-xs text-white/50">
    {message}
  </p>
);

// --------------------------------------------------
// SECTION CARD
// --------------------------------------------------

const SectionCard = ({
  children,
  delay = 0,
  className = "",
}) => (
  <motion.div
    initial={{ y: 20, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    transition={{
      duration: 0.45,
      delay,
    }}
    className={`relative overflow-hidden bg-[#000000]/90 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.2)] ${className}`}
  >
    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] via-transparent to-transparent pointer-events-none" />

    <div className="relative">
      {children}
    </div>
  </motion.div>
);

// --------------------------------------------------
// SECTION HEADING
// --------------------------------------------------

const SectionHeading = ({
  icon: Icon,
  title,
  color,
}) => (
  <div className="flex items-center gap-2 mb-3">
    <Icon className={color} size={15} />

    <span className="text-xs font-semibold text-white">
      {title}
    </span>
  </div>
);

// --------------------------------------------------
// NAVBAR
// --------------------------------------------------

const Navbar = ({ label }) => {
  const navigate = useNavigate();

  return (
    <motion.nav
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{
        duration: 0.5,
        ease: "easeOut",
      }}
      className="fixed inset-x-0 top-0 z-20 border-b border-black/8 bg-white/80 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-12 max-w-7xl items-center justify-start px-3 sm:px-5">
        <div
          onClick={() => navigate("/dashboard")}
          className="flex cursor-pointer items-center gap-1.5"
        >
          <span className="text-sm font-extrabold sm:text-base text-[#0A0A0A]">
            Yugam
          </span>

          <span className="hidden rounded bg-black/5 px-1.5 py-0.5 text-[10px] text-black/50 sm:block">
            {label}
          </span>
        </div>
      </div>
    </motion.nav>
  );
};

// --------------------------------------------------
// SCORER COMPONENT
// --------------------------------------------------

function Scorer({ user, setUser }) {
  const dispatch = useDispatch();

  const { resume } = useSelector(
    (state) => state.resume
  );

  // Upload states
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Role states
  const [targetRole, setTargetRole] = useState("");
  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [roleError, setRoleError] = useState("");

  // --------------------------------------------------
  // LOAD AVAILABLE ROLES
  // --------------------------------------------------

  useEffect(() => {
    let isMounted = true;

    const loadRoles = async () => {
      try {
        setRolesLoading(true);
        setRoleError("");

        const data = await getResumeRoles();

        if (isMounted) {
          setRoles(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Load Resume Roles Error:", err);

        if (isMounted) {
          setRoleError(
            "Unable to load available roles. Please refresh the page."
          );
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
  // FILE VALIDATION
  // --------------------------------------------------

  const validateFile = (selectedFile) => {
    if (!selectedFile) {
      return "Please select a PDF resume.";
    }

    const isPDF =
      selectedFile.type === "application/pdf" ||
      selectedFile.name.toLowerCase().endsWith(".pdf");

    if (!isPDF) {
      return "Only PDF files are allowed.";
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      return "File size must not exceed 20 MB.";
    }

    if (selectedFile.size === 0) {
      return "The selected file is empty.";
    }

    return "";
  };

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) return;

    const validationError = validateFile(selectedFile);

    if (validationError) {
      setFile(null);
      setError(validationError);
      event.target.value = "";
      return;
    }

    setFile(selectedFile);
    setError("");
  };

  // --------------------------------------------------
  // UPLOAD AND ANALYZE RESUME
  // --------------------------------------------------

  const uploadResume = async () => {
    if (loading) return;

    if (!targetRole) {
      setError("Please select your target job role.");
      return;
    }

    const validationError = validateFile(file);

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const formData = new FormData();

      formData.append("resume", file);
      formData.append("targetRole", targetRole);

      // 1. Upload and analyze resume
      const response = await api.post(
        "/api/resume/upload",
        formData
      );

      if (
        !response.data?.success ||
        !response.data?.data
      ) {
        throw new Error(
          response.data?.message ||
          "Resume analysis failed."
        );
      }

      const analyzedResume = response.data.data;

      // 2. Verify role analysis was returned
      if (!analyzedResume.roleSkillAnalysis) {
        throw new Error(
          "Resume was analyzed, but role-based skill analysis was not returned. Please check your backend."
        );
      }

      // 3. Update Redux
      dispatch(setResume(analyzedResume));

      // 4. Deduct coins after successful analysis.
      // This assumes useCoins is an ordinary API function,
      // not a React hook.
      try {
        const coinResponse = await useCoins({
          coins: 10,
          action: "resume-scorer",
        });

        if (coinResponse?.interviewCoin !== undefined) {
          setUser((previousUser) => ({
            ...previousUser,
            interviewCoin: coinResponse.interviewCoin,
          }));
        }
      } catch (coinError) {
        console.error(
          "Resume Coin Deduction Error:",
          coinError
        );

        setError(
          "Resume analysis completed, but coin deduction failed. Please contact support."
        );
      }

      setFile(null);

    } catch (err) {
      console.error("Resume Upload Error:", err);

      setError(
        err.response?.data?.message ||
        err.message ||
        "Resume analysis failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // RE-UPLOAD
  // --------------------------------------------------

  const handleReupload = () => {
    dispatch(setResume(null));

    setFile(null);
    setError("");
    setTargetRole("");
  };

  // --------------------------------------------------
  // SAFE RESUME DATA
  // --------------------------------------------------

  if (resume) {
    const score = getSafeScore(resume.score);

    const strengths = Array.isArray(resume.strengths)
      ? resume.strengths
      : [];

    const weaknesses = Array.isArray(resume.weaknesses)
      ? resume.weaknesses
      : [];

    const recommendations = Array.isArray(
      resume.recommendations
    )
      ? resume.recommendations
      : [];

    const roleAnalysis = resume.roleSkillAnalysis;

    const missingRequiredSkills = Array.isArray(
      roleAnalysis?.missingRequiredSkills
    )
      ? roleAnalysis.missingRequiredSkills
      : [];

    const missingPreferredSkills = Array.isArray(
      roleAnalysis?.missingPreferredSkills
    )
      ? roleAnalysis.missingPreferredSkills
      : [];

    const missingSkills = Array.isArray(
      roleAnalysis?.missingSkills
    )
      ? roleAnalysis.missingSkills
      : Array.isArray(resume.missingSkills)
        ? resume.missingSkills
        : [];

    const matchedSkills = Array.isArray(
      roleAnalysis?.matchedSkills
    )
      ? roleAnalysis.matchedSkills
      : [];

    const overallCoverage = getSafeScore(
      roleAnalysis?.overallCoverage
    );

    const requiredCoverage = getSafeScore(
      roleAnalysis?.requiredCoverage
    );

    const preferredCoverage = getSafeScore(
      roleAnalysis?.preferredCoverage
    );

    return (
      <div className="min-h-screen bg-white text-[#0A0A0A]">
        <Navbar label="Resume Scorer" />

        <section className="max-w-6xl mx-auto px-3 pt-20 sm:pt-24 pb-8 space-y-3.5">

          {/* HEADER */}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] text-black/40 tracking-widest uppercase mb-0.5">
                Resume Analysis
              </p>

              <h2 className="text-lg font-bold">
                {resume?.name || "Candidate"}
              </h2>

              {roleAnalysis?.targetRoleLabel && (
                <p className="text-xs text-black/45 mt-1">
                  Evaluated for {roleAnalysis.targetRoleLabel}
                </p>
              )}
            </div>

            <button
              onClick={handleReupload}
              className="text-[10px] sm:text-xs text-black/50 hover:text-[#0A0A0A] border border-black/15 hover:border-black/35 px-3 py-1.5 rounded-lg transition-colors"
            >
              Re-upload
            </button>
          </div>

          {/* RESUME SCORE */}

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{
              duration: 0.5,
              delay: 0.05,
            }}
            className="relative overflow-hidden bg-[#000000]/90 backdrop-blur-2xl border border-white/10 rounded-2xl p-5 flex flex-col items-center gap-4 sm:flex-row shadow-[0_8px_32px_rgba(0,0,0,0.2)]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] via-transparent to-transparent pointer-events-none" />

            <div className="relative">
              <ScoreRing score={score} />
            </div>

            <div className="relative">
              <p className="text-white/50 text-xs mb-0.5">
                Resume Score
              </p>

              <p className="text-xl font-bold mb-1.5 text-white">
                {getScoreLabel(score)}
              </p>

              <div className="flex items-center gap-1.5">
                <FiUser className="text-purple-400 text-xs" />

                <span className="text-xs text-purple-300">
                  {resume?.suggestedRole || "Resume Candidate"}
                </span>
              </div>
            </div>
          </motion.div>

          {/* ROLE SKILL COVERAGE */}

          {roleAnalysis && (
            <SectionCard delay={0.06}>
              <SectionHeading
                icon={FiTarget}
                title="Role Skill Match"
                color="text-purple-400"
              />

              <p className="text-white/50 text-[11px] mb-4">
                Skill coverage against the configured requirements for{" "}
                <span className="text-purple-300 font-medium">
                  {roleAnalysis.targetRoleLabel || "your selected role"}
                </span>
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

                {/* OVERALL */}

                <div className="rounded-xl bg-white/[0.05] border border-white/10 p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-white/60 text-[10px]">
                      Overall Coverage
                    </span>

                    <span className="text-white text-sm font-bold">
                      {overallCoverage}%
                    </span>
                  </div>

                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full transition-all"
                      style={{ width: `${overallCoverage}%` }}
                    />
                  </div>
                </div>

                {/* REQUIRED */}

                <div className="rounded-xl bg-white/[0.05] border border-white/10 p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-white/60 text-[10px]">
                      Required Skills
                    </span>

                    <span className="text-white text-sm font-bold">
                      {requiredCoverage}%
                    </span>
                  </div>

                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${requiredCoverage}%` }}
                    />
                  </div>
                </div>

                {/* PREFERRED */}

                <div className="rounded-xl bg-white/[0.05] border border-white/10 p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-white/60 text-[10px]">
                      Preferred Skills
                    </span>

                    <span className="text-white text-sm font-bold">
                      {preferredCoverage}%
                    </span>
                  </div>

                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-500 rounded-full transition-all"
                      style={{ width: `${preferredCoverage}%` }}
                    />
                  </div>
                </div>
              </div>

              <p className="text-white/35 text-[9px] mt-3">
                These percentages represent keyword coverage in the configured role catalog, not verified professional proficiency or an employer's actual ATS score.
              </p>
            </SectionCard>
          )}

          {/* STRENGTHS AND WEAKNESSES */}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">

            {/* STRENGTHS */}

            <SectionCard delay={0.08}>
              <SectionHeading
                icon={FiAlertCircle}
                title="Strengths"
                color="text-green-400"
              />

              <div className="flex flex-wrap gap-1.5">
                {strengths.length > 0 ? (
                  strengths.map((item, index) => (
                    <Tag
                      key={`${item}-${index}`}
                      text={item}
                      color="green"
                    />
                  ))
                ) : (
                  <EmptyState message="No strengths identified in this analysis." />
                )}
              </div>
            </SectionCard>

            {/* WEAKNESSES */}

            <SectionCard delay={0.09}>
              <SectionHeading
                icon={FiAlertCircle}
                title="Weaknesses"
                color="text-yellow-400"
              />

              <div className="flex flex-wrap gap-1.5">
                {weaknesses.length > 0 ? (
                  weaknesses.map((item, index) => (
                    <Tag
                      key={`${item}-${index}`}
                      text={item}
                      color="yellow"
                    />
                  ))
                ) : (
                  <EmptyState message="No weaknesses identified in this analysis." />
                )}
              </div>
            </SectionCard>
          </div>

          {/* MISSING SKILLS */}

          <SectionCard delay={0.1}>
            <SectionHeading
              icon={FiZap}
              title="Missing Skills"
              color="text-red-400"
            />

            {roleAnalysis ? (
              <div className="space-y-4">

                {/* REQUIRED SKILLS */}

                <div>
                  <p className="text-[11px] text-white/65 font-medium mb-2">
                    Missing Required Skills
                  </p>

                  {missingRequiredSkills.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {missingRequiredSkills.map(
                        (skill, index) => (
                          <Tag
                            key={`${skill}-${index}`}
                            text={skill}
                            color="red"
                          />
                        )
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-green-400">
                      All configured required skills were found in the resume text.
                    </p>
                  )}
                </div>

                {/* PREFERRED SKILLS */}

                <div>
                  <p className="text-[11px] text-white/65 font-medium mb-2">
                    Missing Preferred Skills
                  </p>

                  {missingPreferredSkills.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {missingPreferredSkills.map(
                        (skill, index) => (
                          <Tag
                            key={`${skill}-${index}`}
                            text={skill}
                            color="yellow"
                          />
                        )
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-green-400">
                      All configured preferred skills were found in the resume text.
                    </p>
                  )}
                </div>

                {/* MATCHED SKILLS */}

                <div className="border-t border-white/10 pt-3">
                  <p className="text-[11px] text-white/65 font-medium mb-2">
                    Matched Skills ({matchedSkills.length})
                  </p>

                  {matchedSkills.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {matchedSkills.map((skill, index) => (
                        <Tag
                          key={`${skill}-${index}`}
                          text={skill}
                          color="green"
                        />
                      ))}
                    </div>
                  ) : (
                    <EmptyState message="No configured role skills were found in the extracted resume content." />
                  )}
                </div>

                <p className="text-[9px] text-white/35">
                  A matched skill means it was found in the extracted resume content. It does not independently verify the candidate's proficiency.
                </p>
              </div>
            ) : (
              <EmptyState
                message={
                  missingSkills.length > 0
                    ? "Legacy resume data is available, but role-specific skill analysis is not."
                    : "Role-specific skill analysis is unavailable. Please re-upload your resume and select a target role."
                }
              />
            )}
          </SectionCard>

          {/* RECOMMENDATIONS */}

          <SectionCard delay={0.12}>
            <SectionHeading
              icon={FiTrendingUp}
              title="Recommendations"
              color="text-purple-400"
            />

            <div className="flex flex-wrap gap-1.5">
              {recommendations.length > 0 ? (
                recommendations.map((item, index) => (
                  <Tag
                    key={`${item}-${index}`}
                    text={item}
                    color="purple"
                  />
                ))
              ) : (
                <EmptyState message="No recommendations available." />
              )}
            </div>
          </SectionCard>

          {/* FOOTER INFORMATION */}

          {roleAnalysis?.analyzedAt && (
            <p className="text-center text-[9px] text-black/35">
              Role analysis generated on{" "}
              {new Date(roleAnalysis.analyzedAt).toLocaleString()}
            </p>
          )}

        </section>
      </div>
    );
  }

  // --------------------------------------------------
  // UPLOAD SCREEN
  // --------------------------------------------------

  return (
    <div className="min-h-screen bg-white text-[#0A0A0A]">
      <Navbar label="Resume Scorer" />

      <section className="flex min-h-screen items-center justify-center px-3 pt-16 pb-6">

        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{
            duration: 0.5,
            delay: 0.05,
          }}
          className="relative w-full max-w-md rounded-3xl overflow-hidden bg-[#000000]/90 backdrop-blur-2xl border border-white/10 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.25)] sm:p-6"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] via-transparent to-transparent pointer-events-none" />

          {/* PROGRESS */}

          <div className="relative flex justify-between items-center mb-2">
            <p className="text-[10px] text-white/40 tracking-widest uppercase">
              Step 1 of 2
            </p>

            <FiFileText className="text-white/40" size={15} />
          </div>

          <div className="relative w-full h-1 bg-white/10 rounded-full mb-5">
            <div className="h-1 bg-white rounded-full w-1/2" />
          </div>

          {/* HEADING */}

          <h2 className="relative text-lg font-bold mb-1 text-white">
            Analyze Your Resume
          </h2>

          <p className="relative text-white/45 text-xs mb-5">
            Select your target role and upload your resume to get personalized feedback.
          </p>

          {/* ROLE SELECTOR */}

          <div className="relative mb-4">
            <label
              htmlFor="targetRole"
              className="block text-xs font-medium text-white/80 mb-2"
            >
              Select Target Job Role
            </label>

            <select
              id="targetRole"
              value={targetRole}
              onChange={(event) => {
                setTargetRole(event.target.value);
                setError("");
              }}
              disabled={rolesLoading || loading || roles.length === 0}
              className="w-full h-11 rounded-xl bg-white/10 border border-white/15 px-3 text-xs text-white outline-none focus:border-purple-400 disabled:opacity-50"
            >
              <option value="" className="text-black">
                {rolesLoading
                  ? "Loading roles..."
                  : "Choose your target role"}
              </option>

              {roles.map((role) => (
                <option
                  key={role.id}
                  value={role.id}
                  className="text-black"
                >
                  {role.label}
                </option>
              ))}
            </select>

            {rolesLoading && (
              <p className="text-white/40 text-[10px] mt-2">
                Loading available job roles...
              </p>
            )}

            {roleError && (
              <p className="text-red-400 text-[10px] mt-2">
                {roleError}
              </p>
            )}

            <p className="text-white/40 text-[10px] mt-2">
              Your resume will be evaluated against the selected role's configured skill requirements.
            </p>

            {!rolesLoading && roles.length === 0 && !roleError && (
              <p className="text-yellow-400 text-[10px] mt-2">
                No roles are currently available.
              </p>
            )}
          </div>

          {/* PDF UPLOAD */}

          <div className="relative mb-4">
            <label
              htmlFor="resumeFile"
              className={`flex flex-col items-center justify-center w-full h-40 sm:h-44 rounded-2xl border-2 border-dashed cursor-pointer transition-colors ${
                file
                  ? "border-white/40 bg-white/[0.06]"
                  : "border-white/15 bg-white/[0.03] hover:border-white/30"
              }`}
            >
              <FiUploadCloud
                className={`text-4xl sm:text-5xl mb-2.5 ${
                  file ? "text-white" : "text-white/30"
                }`}
              />

              <p className="text-xs font-medium text-white/80 text-center px-3">
                {file
                  ? file.name
                  : "Click to upload your resume"}
              </p>

              <p className="text-[10px] text-white/35 mt-1">
                PDF only · Maximum 20 MB
              </p>

              {file && (
                <p className="text-[10px] text-green-400 mt-2">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB selected
                </p>
              )}

              <input
                id="resumeFile"
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                disabled={loading}
                onChange={handleFileChange}
              />
            </label>
          </div>

          {/* ERROR MESSAGE */}

          {error && (
            <div className="relative flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-3">
              <FiAlertCircle
                className="text-red-400 mt-0.5 shrink-0"
                size={14}
              />

              <p className="text-red-300 text-[10px]">
                {error}
              </p>
            </div>
          )}

          {/* ANALYZE BUTTON */}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={uploadResume}
            disabled={
              !file ||
              !targetRole ||
              loading ||
              rolesLoading ||
              !!roleError ||
              roles.length === 0
            }
            className="relative mt-1 w-full h-11 rounded-xl font-semibold text-xs bg-white text-[#0A0A0A] shadow-[0_4px_14px_rgba(255,255,255,0.15)] hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <FiRefreshCw className="animate-spin" size={14} />
                Analyzing Resume...
              </>
            ) : (
              <>
                <FiZap size={14} />
                Analyze Resume
              </>
            )}
          </motion.button>

          {/* FOOTER */}

          <div className="relative flex items-center justify-center gap-1.5 mt-4">
            <FiBookOpen className="text-white/30" size={11} />

            <p className="text-[9px] text-white/35">
              AI-powered resume analysis with role-based skill matching
            </p>
          </div>

        </motion.div>
      </section>
    </div>
  );
}

export default Scorer;
