/**
 * Proctor Input Validator & Anti-Gibberish Analysis for AI Interviews
 * Validates candidate responses for genuineness, detecting empty answers,
 * repeated character sequences, symbol/number mash, and keyboard gibberish.
 */

// Common English words & core technical / interview vocabulary
const COMMON_DICTIONARY_WORDS = new Set([
  // Core English functional & descriptive words
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "i", "it", "for", "not", "on", "with",
  "he", "as", "you", "do", "at", "this", "but", "his", "by", "from", "they", "we", "say", "her",
  "she", "or", "an", "will", "my", "one", "all", "would", "there", "their", "what", "so", "up",
  "out", "if", "about", "who", "get", "which", "go", "me", "when", "make", "can", "like", "time",
  "no", "just", "him", "know", "take", "people", "into", "year", "your", "good", "some", "could",
  "them", "see", "other", "than", "then", "now", "look", "only", "come", "its", "over", "think",
  "also", "back", "after", "use", "two", "how", "our", "work", "first", "well", "way", "even",
  "new", "want", "because", "any", "these", "give", "day", "most", "us", "is", "are", "was",
  "were", "been", "has", "had", "having", "does", "did", "done", "doing", "shall", "should",
  "may", "might", "must", "yes", "true", "false", "none", "null", "undefined", "more", "less",
  "high", "low", "best", "better", "great", "simple", "complex", "easy", "hard", "fast", "slow",
  "many", "much", "each", "every", "both", "few", "own", "same", "different", "such", "why",
  "where", "how", "often", "always", "never", "sometimes", "usually", "help", "need", "try",
  "call", "write", "read", "run", "start", "stop", "end", "begin", "change", "play", "move",
  "live", "believe", "hold", "bring", "happen", "must", "provide", "sit", "stand", "lose",
  "pay", "meet", "include", "continue", "set", "learn", "lead", "understand", "watch", "follow",
  "stop", "create", "speak", "read", "allow", "add", "spend", "grow", "open", "walk", "win",
  "offer", "remember", "love", "consider", "appear", "buy", "wait", "serve", "die", "send",
  "expect", "build", "stay", "fall", "cut", "reach", "kill", "remain", "suggest", "raise",
  "pass", "sell", "require", "report", "decide", "pull", "target", "arr", "array", "return",

  // Technical & Software Engineering Vocabulary
  "react", "node", "javascript", "js", "ts", "typescript", "python", "java", "html", "css",
  "sql", "nosql", "mongodb", "postgres", "postgresql", "mysql", "redis", "express", "api", "apis",
  "rest", "restful", "graphql", "database", "server", "client", "frontend", "backend", "fullstack",
  "function", "class", "component", "props", "state", "hook", "hooks", "redux", "git", "github",
  "docker", "kubernetes", "k8s", "aws", "gcp", "azure", "cloud", "test", "testing", "code",
  "data", "algorithm", "algorithms", "dsa", "array", "object", "string", "number", "boolean",
  "async", "await", "promise", "callback", "loop", "interface", "type", "module", "import",
  "export", "router", "route", "schema", "model", "query", "mutation", "performance", "optimize",
  "optimization", "cache", "caching", "design", "pattern", "patterns", "architecture", "system",
  "security", "token", "jwt", "auth", "authentication", "authorization", "user", "session",
  "request", "response", "header", "payload", "error", "exception", "handling", "event", "listener",
  "dom", "virtual", "render", "rendering", "lifecycle", "effect", "method", "methods", "star",
  "situation", "task", "action", "result", "project", "experience", "team", "manager", "worked",
  "built", "created", "designed", "developed", "implemented", "solved", "problem", "challenge",
  "solution", "scale", "scaling", "scalable", "latency", "memory", "cpu", "thread", "threads",
  "process", "concurrent", "concurrency", "parallel", "distributed", "network", "http", "https",
  "tcp", "ip", "socket", "webrtc", "websocket", "table", "column", "row", "index", "indexing",
  "primary", "foreign", "key", "join", "joins", "relational", "document", "collection", "aggregate",
  "aggregation", "pipeline", "mvc", "solid", "dry", "clean", "agile", "scrum", "sprint", "ci",
  "cd", "continuous", "integration", "deployment", "delivery", "microservices", "monolith",
  "polymorphism", "inheritance", "encapsulation", "abstraction", "oop", "recursion", "recursive",
  "binary", "tree", "graph", "stack", "queue", "heap", "linked", "list", "sorting", "searching",
  "hash", "hashmap", "complexity", "space", "time", "idempotent", "idempotency", "acid", "base",
  "transaction", "transactions", "middleware", "cors", "csrf", "xss", "sanitization", "validation",
  "web", "applications", "previous", "tokens", "technique", "subproblems", "smaller", "calls",
  "itself", "spikes", "resolve", "followed", "objects", "different", "classes", "treated", "through",
  "common", "interface", "allows"
]);

const MASH_PATTERNS = /(qwe|wer|ert|rty|tyu|yui|uio|iop|asd|sdf|dfg|fgh|ghj|hjk|jkl|zxc|xcv|cvb|vbn|bnm)/i;

/**
 * Checks whether an answer (and optional code) is gibberish, empty, or non-responsive.
 * @param {string} rawAnswer - The candidate's submitted textual answer
 * @param {string} rawCode - Optional submitted code string
 * @returns {boolean} - true if invalid/gibberish/empty, false if valid
 */
export function isGibberishOrEmpty(rawAnswer, rawCode = "") {
  const answer = (rawAnswer || "").trim();
  const code = (rawCode || "").trim();

  // 1. Completely empty or whitespace-only
  if (!answer && !code) return true;

  // 2. Check if valid programming code was supplied in code or answer
  const hasValidCode = Boolean(
    (code &&
      code.length >= 10 &&
      /(function|const|let|var|def|class|return|import|export|console\.log|public|private|void|\=>|\{|\}|\;|\(\))/i.test(code)) ||
    (answer &&
      answer.length >= 10 &&
      /(function|const|let|var|def|class|return|import|export|console\.log|public|private|void|\=>)\s*/i.test(answer) &&
      /[\{\}\(\)\;]/.test(answer))
  );

  // If answer contains embedded code delimiter '--- Code ---'
  if (answer.includes("--- Code ---")) {
    const parts = answer.split("--- Code ---");
    const codePart = (parts[1] || "").trim();
    if (
      codePart.length >= 10 &&
      /(function|const|let|var|def|class|return|import|export|console\.log|\=>|\{|\}|\;)/i.test(codePart)
    ) {
      return false; // Valid code detected
    }
  }

  // 3. Pure numbers, symbols, whitespace, or punctuation with no code
  if (/^[\d\s\W_]+$/.test(answer) && !hasValidCode) {
    return true;
  }

  // 4. Repeated single character spam (e.g. "aaaaa", "zzzzzz", "11111")
  if (/(.)\1{4,}/i.test(answer) && !hasValidCode) {
    return true;
  }

  // 5. Clean text into individual words
  const cleanText = answer.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
  const words = cleanText.split(/\s+/).filter(Boolean);

  if (words.length === 0 && !hasValidCode) {
    return true;
  }

  // 6. Word dictionary & linguistic structure analysis
  let recognizedDictionaryCount = 0;
  let validWordCount = 0;

  for (const w of words) {
    if (COMMON_DICTIONARY_WORDS.has(w)) {
      recognizedDictionaryCount++;
      validWordCount++;
    } else if (w.length >= 2) {
      const hasVowel = /[aeiouy]/i.test(w);
      const hasExcessiveConsonants = /[bcdfghjklmnpqrstvwxz]{5,}/i.test(w);
      const hasExcessiveVowels = /[aeiou]{4,}/i.test(w);
      const isMashPattern = MASH_PATTERNS.test(w);

      const vowels = (w.match(/[aeiouy]/gi) || []).length;
      const vowelRatio = vowels / w.length;

      // Real English/technical terms have balanced vowel ratio and sensible consonant clusters
      if (
        hasVowel &&
        !hasExcessiveConsonants &&
        !hasExcessiveVowels &&
        !isMashPattern &&
        vowelRatio >= 0.20 &&
        vowelRatio <= 0.80
      ) {
        validWordCount++;
      }
    }
  }

  // If there are zero recognized English/technical words in non-code answers, it is gibberish
  if (!hasValidCode && recognizedDictionaryCount === 0) {
    return true;
  }

  // 7. Enforce at least 2 real alphabetic words for non-code text answers
  if (!hasValidCode) {
    // Single-word exemption ONLY for significant recognized technical keywords
    if (words.length === 1 && COMMON_DICTIONARY_WORDS.has(words[0]) && words[0].length >= 3) {
      return false;
    }
    if (validWordCount < 2) {
      return true;
    }
  }

  return false;
}

/**
 * Returns deterministic zero-score mentor-grade evaluation object.
 */
export function getZeroScoreFeedback() {
  return {
    score: 0,
    correctness: 0,
    clarity: 0,
    relevance: 0,
    detail: 0,
    efficiency: 0,
    communication: 0,
    problemSolving: 0,
    creativity: 0,
    feedback:
      "No valid response detected. The submitted text appears to be random characters, numbers, or symbols rather than a genuine answer to the interview question.",
    improvements: [
      "Provide a clear, coherent explanation addressing the specific question asked.",
      "Use structured reasoning or real-world examples (such as the STAR method for behavioral questions or working code for technical prompts).",
    ],
  };
}
