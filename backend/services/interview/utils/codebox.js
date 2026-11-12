export const LANGUAGE_MAP = {
  javascript: { id: 63, name: "JavaScript (Node.js 18)", ext: "js" },
  python: { id: 71, name: "Python (3.8)", ext: "py" },
  java: { id: 62, name: "Java (OpenJDK 17)", ext: "java" },
  cpp: { id: 54, name: "C++ (GCC 9)", ext: "cpp" },
};

export const LANGUAGE_ALIASES = {
  js: "javascript",
  node: "javascript",
  nodejs: "javascript",
  py: "python",
  python3: "python",
  "c++": "cpp",
  cplusplus: "cpp",
};

export const resolveLanguage = (lang = "") => {
  if (!lang || typeof lang !== "string") return null;
  const clean = lang.trim().toLowerCase();
  if (Object.hasOwn(LANGUAGE_MAP, clean)) {
    return clean;
  }
  if (Object.hasOwn(LANGUAGE_ALIASES, clean)) {
    return LANGUAGE_ALIASES[clean];
  }
  return null;
};

export const validateCodeboxPayload = ({ language, source_code, stdin }) => {
  const resolvedLang = resolveLanguage(language);
  if (!resolvedLang) {
    return {
      valid: false,
      error: `Unsupported language: '${language}'. Supported languages: ${Object.keys(
        LANGUAGE_MAP
      ).join(", ")}`,
    };
  }

  if (
    !source_code ||
    typeof source_code !== "string" ||
    !source_code.trim()
  ) {
    return {
      valid: false,
      error: "source_code is required and cannot be empty.",
    };
  }

  if (source_code.length > 50000) {
    return {
      valid: false,
      error: "source_code exceeds maximum character limit of 50,000 characters.",
    };
  }

  if (stdin !== undefined && stdin !== null) {
    if (typeof stdin !== "string") {
      return {
        valid: false,
        error: "stdin must be a string.",
      };
    }
    if (stdin.length > 10000) {
      return {
        valid: false,
        error: "stdin exceeds maximum character limit of 10,000 characters.",
      };
    }
  }

  const langInfo = LANGUAGE_MAP[resolvedLang];

  return {
    valid: true,
    language_id: langInfo.id,
    language: resolvedLang,
    source_code,
    stdin: typeof stdin === "string" ? stdin : "",
  };
};

