import {
  ROLE_SKILLS,
  SKILL_ALIASES,
} from "../config/roleSkills.js";

const normalize = (value = "") =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getResumeContent = (resumeData, extractedText) => {
  const parts = [
    ...(resumeData.skills || []),

    ...(resumeData.projects || []).flatMap((project) => [
      project.name,
      project.description,
      ...(project.technologies || []),
    ]),

    ...(resumeData.experience || []).flatMap((experience) => [
      experience.role,
      experience.company,
      ...(experience.responsibilities || []),
    ]),

    ...(resumeData.education || []).flatMap((education) => [
      education.degree,
      education.institution,
      ...(education.coursework || []),
    ]),

    extractedText,
  ];

  return normalize(parts.filter(Boolean).join(" "));
};

const hasSkill = (content, skill) => {
  const aliases = SKILL_ALIASES[skill] || [];

  const terms = [skill, ...aliases];

  return terms.some((term) => {
    const normalizedTerm = normalize(term);

    if (!normalizedTerm) return false;

    const regex = new RegExp(
      `(^| )${escapeRegex(normalizedTerm)}( |$)`,
      "i"
    );

    return regex.test(content);
  });
};

export const getAvailableRoles = () =>
  Object.entries(ROLE_SKILLS).map(([id, role]) => ({
    id,
    label: role.label,
  }));

export const analyzeRoleSkills = ({
  targetRole,
  resumeData,
  extractedText,
}) => {
  const role = ROLE_SKILLS[targetRole];

  if (!role) {
    throw new Error("Invalid target role");
  }

  const content = getResumeContent(resumeData, extractedText);

  const requiredSkills = role.required;
  const preferredSkills = role.preferred;

  const matchedRequiredSkills = requiredSkills.filter(
    (skill) => hasSkill(content, skill)
  );

  const matchedPreferredSkills = preferredSkills.filter(
    (skill) => hasSkill(content, skill)
  );

  const missingRequiredSkills = requiredSkills.filter(
    (skill) => !hasSkill(content, skill)
  );

  const missingPreferredSkills = preferredSkills.filter(
    (skill) => !hasSkill(content, skill)
  );

  const requiredCoverage = requiredSkills.length
    ? Math.round(
        (matchedRequiredSkills.length / requiredSkills.length) * 100
      )
    : 100;

  const preferredCoverage = preferredSkills.length
    ? Math.round(
        (matchedPreferredSkills.length / preferredSkills.length) * 100
      )
    : 100;

  const totalMatched =
    matchedRequiredSkills.length + matchedPreferredSkills.length;

  const totalSkills =
    requiredSkills.length + preferredSkills.length;

  const overallCoverage = totalSkills
    ? Math.round((totalMatched / totalSkills) * 100)
    : 100;

  return {
    targetRole,
    targetRoleLabel: role.label,

    requiredSkills,
    preferredSkills,

    matchedRequiredSkills,
    matchedPreferredSkills,

    missingRequiredSkills,
    missingPreferredSkills,

    // Keep this string array for compatibility with your existing UI.
    missingSkills: [
      ...missingRequiredSkills,
      ...missingPreferredSkills,
    ],

    matchedSkills: [
      ...matchedRequiredSkills,
      ...matchedPreferredSkills,
    ],

    requiredCoverage,
    preferredCoverage,
    overallCoverage,

    analyzedAt: new Date(),
    catalogVersion: "1.0.0",
  };
};
