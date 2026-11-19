import React, { useState } from "react";
import {
  FiFileText,
  FiPlus,
  FiSend,
  FiCode,
  FiSliders,
  FiHelpCircle,
  FiPlay,
  FiRefreshCw,
  FiMic,
  FiAward,
  FiLock,
  FiCheckCircle,
  FiCopy,
  FiCheck,
} from "react-icons/fi";
import Editor from "@monaco-editor/react";

const STARTER_PROMPTS = [
  {
    label: "System Design",
    difficulty: "hard",
    prompt:
      "Design a high-throughput URL shortening service (like TinyURL) supporting 10,000 writes/sec with custom aliases, cache-aside strategy, and rate limiting.",
  },
  {
    label: "DSA / Complexity",
    difficulty: "medium",
    prompt:
      "Given an unsorted array of integers and a target sum, return the 1-based indices of two numbers that add up to target. What is the time and space complexity?",
  },
  {
    label: "Core Concepts",
    difficulty: "medium",
    prompt:
      "Explain how JavaScript handles asynchronous operations using the Event Loop, Call Stack, Microtask queue, and Macrotask queue.",
  },
  {
    label: "Debugging Scenario",
    difficulty: "hard",
    prompt:
      "A production microservice encounters memory exhaustion (OOM) after 48 hours of deployment under steady load. Walk me through your step-by-step triage and debugging playbook.",
  },
];

export default function QuestionWorkspace({
  videoPanel,
  questions = [],
  activeQuestionIndex = 0,
  switchQuestion,
  participantRole,
  // Question Form
  newQuestionText,
  setNewQuestionText,
  newQuestionDifficulty,
  setNewQuestionDifficulty,
  isPushingQuestion,
  handlePushQuestion,
  // Tabs & Answers
  activeTab,
  setActiveTab,
  studentAnswer,
  handleAnswerChange,
  isDictating,
  toggleDictation,
  speechSupported,
  // Code & Terminal
  language,
  code,
  stdin,
  setStdin,
  codeTab,
  setCodeTab,
  isRunningCode,
  codeOutput,
  handleLanguageChange,
  handleCodeChange,
  handleRunCode,
  langOptions = ["javascript", "python", "java", "cpp"],
  // Trainer Rubric
  criteria,
  setCriteria,
  overallScore,
  calculateWeightedScore,
  strengths,
  setStrengths,
  newStrengthInput,
  setNewStrengthInput,
  handleAddStrength,
  weaknesses,
  setWeaknesses,
  newWeaknessInput,
  setNewWeaknessInput,
  handleAddWeakness,
  summaryFeedback,
  setSummaryFeedback,
  trainerPrivateNotes,
  setTrainerPrivateNotes,
  handleSubmitEvaluation,
  isSubmittingEvaluation,
}) {
  const [copiedAnswer, setCopiedAnswer] = useState(false);

  const activeQuestion = questions[activeQuestionIndex] || {
    questionText: "Welcome to your live interview session. The trainer will push questions shortly.",
    difficulty: "medium",
  };

  const handleCopyAnswer = () => {
    if (!studentAnswer) return;
    navigator.clipboard?.writeText(studentAnswer);
    setCopiedAnswer(true);
    setTimeout(() => setCopiedAnswer(false), 2000);
  };

  const handleResetTemplate = () => {
    const templates = {
      javascript: `// JavaScript Solution\nfunction solution() {\n  // Write your code here\n}\n`,
      python: `# Python Solution\ndef solution():\n    pass\n`,
      java: `// Java Solution\npublic class Solution {\n    public static void main(String[] args) {\n        // Code here\n    }\n}\n`,
      cpp: `// C++ Solution\n#include <iostream>\nusing namespace std;\n\nint main() {\n    // Code here\n    return 0;\n}\n`,
    };
    handleCodeChange(templates[language] || "// Code solution\n");
  };

  const getTierBadge = (score) => {
    if (score >= 75)
      return {
        label: "Strong Performance",
        color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
      };
    if (score >= 50)
      return {
        label: "Proficient Performance",
        color: "bg-amber-500/20 text-amber-300 border-amber-500/30",
      };
    return {
      label: "Developing Performance",
      color: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    };
  };

  const currentTier = getTierBadge(overallScore);

  return (
    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
      {/* LEFT PANEL: Questions & Question Flow (42% width) */}
      <div className="w-full lg:w-[42%] flex flex-col bg-white border-b lg:border-b-0 lg:border-r border-gray-200 overflow-hidden">
        {videoPanel}

        {/* ACTIVE QUESTION DISPLAY & SELECTOR */}
        <div className="flex-1 flex flex-col p-4 overflow-y-auto space-y-4 bg-white">
          {/* Question Selector Strip */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
              <FiFileText size={14} className="text-gray-900" />
              <span>Interview Questions ({questions.length})</span>
            </span>

            {questions.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {questions.map((q, idx) => (
                  <button
                    key={q._id || idx}
                    onClick={() => switchQuestion(idx)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition border cursor-pointer ${
                      activeQuestionIndex === idx
                        ? "bg-gray-900 text-white font-black border-gray-900 shadow-xs"
                        : "bg-gray-100 hover:bg-gray-200 text-gray-600 border-gray-200"
                    }`}
                  >
                    Q{idx + 1}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Active Question Card */}
          <div className="bg-[#111318] text-white border border-white/10 rounded-2xl p-5 space-y-3 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Question #{activeQuestionIndex + 1}
              </span>

              <span
                className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                  activeQuestion.difficulty === "easy"
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    : activeQuestion.difficulty === "hard"
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                    : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                }`}
              >
                {activeQuestion.difficulty || "medium"}
              </span>
            </div>

            <p className="text-sm font-semibold text-white leading-relaxed">
              {activeQuestion.questionText}
            </p>
          </div>

          {/* Trainer Only: Push New Live Question Form */}
          {participantRole === "trainer" && (
            <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3 mt-auto shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-gray-900 flex items-center gap-1.5">
                  <FiPlus size={14} className="text-gray-900" />
                  <span>Push New Question to Student</span>
                </span>
                <select
                  value={newQuestionDifficulty}
                  onChange={(e) => setNewQuestionDifficulty(e.target.value)}
                  className="bg-gray-50 border border-gray-200 text-xs text-gray-800 rounded-xl px-2.5 py-1 outline-none font-semibold shadow-2xs"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              <textarea
                value={newQuestionText}
                onChange={(e) => setNewQuestionText(e.target.value)}
                placeholder="Type an interview question or problem statement to push in real-time..."
                rows={2}
                className="w-full bg-gray-50/70 border border-gray-200 rounded-xl p-3 text-xs text-gray-900 placeholder-gray-400 outline-none focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 resize-none shadow-2xs transition"
              />

              {/* 1-Click Quick Starter Chips */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                  1-Click Quick Starter Prompts
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {STARTER_PROMPTS.map((starter) => (
                    <button
                      key={starter.label}
                      type="button"
                      onClick={() => {
                        setNewQuestionDifficulty(starter.difficulty);
                        setNewQuestionText(starter.prompt);
                      }}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-200 transition shadow-2xs hover:border-gray-300 cursor-pointer"
                    >
                      + {starter.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handlePushQuestion}
                disabled={!newQuestionText.trim() || isPushingQuestion}
                className="w-full py-2.5 rounded-xl bg-[#111318] hover:bg-black disabled:opacity-40 text-white text-xs font-black transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
              >
                <FiSend size={12} />
                <span>Push to Room</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL: Tabbed Workspace (58% width) */}
      <div className="w-full lg:w-[58%] flex flex-col bg-[#F8F9FA] overflow-hidden">
        {/* Obsidian Workspace Hero Banner */}
        <div className="m-4 mb-2 bg-[#111318] text-white border border-white/10 rounded-2xl p-4 sm:p-5 shadow-sm shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/10 text-zinc-300">
                STUDIO WORKSPACE
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Synced • &lt; 50ms
              </span>
            </div>
            <h2 className="text-base font-black tracking-tight text-white">
              {activeTab === "answer" && "Live Candidate Response Canvas"}
              {activeTab === "code" && "Shared Monaco IDE & CodeBox Sandbox"}
              {activeTab === "rubric" && "Faculty Rubric & Institutional Scoring"}
              {activeTab === "guide" && "Live Technical Interview Guidelines"}
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              {activeTab === "answer" &&
                "Real-time bidirectional speech dictation and typed transcript synchronization."}
              {activeTab === "code" &&
                "Isolated peer code execution with multi-language compiler runtimes."}
              {activeTab === "rubric" &&
                "Weighted dimensional criteria, strengths tagging, and confidential notes."}
              {activeTab === "guide" &&
                "Official GLA University candidate performance standards and tips."}
            </p>
          </div>

          {/* Segmented Pill Switcher */}
          <div className="flex items-center gap-1 bg-[#171822] p-1.5 rounded-xl border border-white/10 shrink-0 self-start md:self-auto overflow-x-auto">
            <button
              onClick={() => setActiveTab("answer")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === "answer"
                  ? "bg-white text-gray-900 shadow-sm font-black"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <FiFileText size={13} />
              <span>Live Answer & Voice</span>
            </button>

            <button
              onClick={() => setActiveTab("code")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === "code"
                  ? "bg-white text-gray-900 shadow-sm font-black"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <FiCode size={13} />
              <span>Shared Monaco Code</span>
            </button>

            {participantRole === "trainer" ? (
              <button
                onClick={() => setActiveTab("rubric")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "rubric"
                    ? "bg-white text-gray-900 shadow-sm font-black"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <FiSliders size={13} />
                <span>Rubric & Notes</span>
              </button>
            ) : (
              <button
                onClick={() => setActiveTab("guide")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "guide"
                    ? "bg-white text-gray-900 shadow-sm font-black"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <FiHelpCircle size={13} />
                <span>Guide</span>
              </button>
            )}
          </div>
        </div>

        {/* Workspace Tab Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* TAB 1: LIVE ANSWER & SPEECH-TO-TEXT */}
          {activeTab === "answer" && (
            <div className="flex-1 p-4 pt-2 flex flex-col space-y-3 overflow-y-auto">
              <div className="flex items-center justify-between bg-white border border-gray-200 rounded-2xl p-4 shrink-0 shadow-xs">
                <div>
                  <h4 className="text-xs font-black text-gray-900">
                    {participantRole === "student"
                      ? "Candidate Answer Space"
                      : "Candidate's Live Streamed Response"}
                  </h4>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {participantRole === "student"
                      ? "Speak using speech-to-text dictation or type your detailed explanation below."
                      : "Watching candidate's verbal and typed response sync in real-time."}
                  </p>
                </div>

                {participantRole === "student" && speechSupported && (
                  <button
                    onClick={toggleDictation}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm cursor-pointer ${
                      isDictating
                        ? "bg-red-600 text-white animate-pulse"
                        : "bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold"
                    }`}
                  >
                    <FiMic size={14} className={isDictating ? "animate-bounce" : ""} />
                    <span>{isDictating ? "Listening (Dictating...)" : "Voice Dictate"}</span>
                    {isDictating && (
                      <span className="flex items-center gap-0.5 ml-1">
                        <span className="w-1 h-3 bg-white rounded-full animate-pulse" />
                        <span className="w-1 h-4 bg-white rounded-full animate-pulse delay-75" />
                        <span className="w-1 h-2 bg-white rounded-full animate-pulse delay-150" />
                      </span>
                    )}
                  </button>
                )}

                {participantRole === "trainer" && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-500 font-semibold mr-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="hidden sm:inline">Live typing sync active</span>
                    </div>
                    <button
                      onClick={handleCopyAnswer}
                      className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs border border-gray-200 cursor-pointer"
                    >
                      {copiedAnswer ? (
                        <FiCheck size={13} className="text-emerald-600" />
                      ) : (
                        <FiCopy size={13} />
                      )}
                      <span>{copiedAnswer ? "Copied!" : "Copy Response"}</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-1 relative flex flex-col">
                <textarea
                  value={studentAnswer}
                  onChange={(e) => handleAnswerChange(e.target.value)}
                  readOnly={participantRole !== "student"}
                  placeholder={
                    participantRole === "student"
                      ? "Speak or type your answer here. Everything you provide is visible to the faculty trainer in real-time..."
                      : "Candidate's answer will appear here in real-time as they speak or type..."
                  }
                  className="w-full flex-1 min-h-[320px] bg-white border border-gray-200 rounded-2xl p-5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 resize-none font-sans leading-relaxed shadow-xs"
                />

                <div className="mt-2 text-[11px] text-gray-500 font-semibold flex items-center justify-between px-1">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>
                      {participantRole === "student"
                        ? "Live Synced with Trainer Room"
                        : "Receiving Real-Time Candidate Input"}
                    </span>
                  </span>
                  <span>
                    {studentAnswer.split(/\s+/).filter(Boolean).length} words •{" "}
                    {studentAnswer.length} chars
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SYNCHRONIZED MONACO CODE EDITOR */}
          {activeTab === "code" && (
            <div className="flex-1 flex flex-col overflow-hidden px-4 pb-4">
              {/* Integrated Toolbar Above Monaco */}
              <div className="h-11 bg-[#111318] border border-white/10 rounded-t-2xl px-4 flex items-center justify-between text-white shrink-0 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                    <FiCode size={12} className="text-emerald-400" />
                    <span>Language Runtime:</span>
                  </span>
                  <select
                    value={language}
                    onChange={(e) => handleLanguageChange(e.target.value)}
                    className="bg-[#1c1f2e] border border-white/15 text-xs text-zinc-200 rounded-lg px-2.5 py-1 outline-none font-semibold cursor-pointer shadow-2xs hover:border-white/30 transition"
                  >
                    {langOptions.map((lang) => (
                      <option key={lang} value={lang}>
                        {lang.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleResetTemplate}
                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-zinc-300 hover:text-white text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                    title="Reset to boilerplate template"
                  >
                    <FiRefreshCw size={11} />
                    <span className="hidden sm:inline">Reset Template</span>
                  </button>

                  <button
                    onClick={handleRunCode}
                    disabled={isRunningCode}
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-black transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    {isRunningCode ? (
                      <FiRefreshCw size={12} className="animate-spin" />
                    ) : (
                      <FiPlay size={12} />
                    )}
                    <span>Run Code</span>
                  </button>
                </div>
              </div>

              {/* Monaco Editor Canvas */}
              <div className="flex-1 relative border-x border-white/10 overflow-hidden bg-[#1e1e1e]">
                <Editor
                  height="100%"
                  language={language}
                  theme="vs-dark"
                  value={code}
                  onChange={handleCodeChange}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: "on",
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                  }}
                />
              </div>

              {/* Console Output Drawer */}
              <div className="h-44 border border-white/10 rounded-b-2xl bg-[#111318] text-white flex flex-col shrink-0 overflow-hidden shadow-md">
                <div className="h-9 border-b border-white/10 px-4 flex items-center justify-between bg-[#161822]">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCodeTab("output")}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer ${
                        codeTab === "output"
                          ? "bg-white/15 text-white"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      Terminal Output
                    </button>
                    <button
                      onClick={() => setCodeTab("stdin")}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer ${
                        codeTab === "stdin"
                          ? "bg-white/15 text-white"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      Standard Input (stdin)
                    </button>
                  </div>

                  {codeOutput?.status && (
                    <span className="text-[10px] text-zinc-400 font-mono">
                      Status: {codeOutput.status.description || "Ready"}
                    </span>
                  )}
                </div>

                <div className="flex-1 p-3.5 overflow-y-auto font-mono text-xs text-zinc-300">
                  {codeTab === "output" ? (
                    codeOutput ? (
                      <div>
                        {codeOutput.error && (
                          <p className="text-red-400 font-semibold">{codeOutput.error}</p>
                        )}
                        {codeOutput.compile_output && (
                          <pre className="text-red-300 whitespace-pre-wrap">
                            {codeOutput.compile_output}
                          </pre>
                        )}
                        {codeOutput.stderr && (
                          <pre className="text-red-400 whitespace-pre-wrap">
                            {codeOutput.stderr}
                          </pre>
                        )}
                        {codeOutput.stdout && (
                          <pre className="text-emerald-400 whitespace-pre-wrap">
                            {codeOutput.stdout}
                          </pre>
                        )}
                      </div>
                    ) : (
                      <span className="text-zinc-500">
                        Click "Run Code" to compile and execute in the secure isolated sandbox.
                      </span>
                    )
                  ) : (
                    <textarea
                      value={stdin}
                      onChange={(e) => setStdin(e.target.value)}
                      placeholder="Provide optional custom input values to stdin..."
                      className="w-full h-full bg-transparent text-xs text-zinc-200 outline-none resize-none font-mono"
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TRAINER-ONLY RUBRIC EVALUATION & PRIVATE NOTES */}
          {activeTab === "rubric" && participantRole === "trainer" && (
            <div className="flex-1 p-5 pt-2 overflow-y-auto space-y-5">
              {/* High-Contrast Obsidian Composite Score Card */}
              <div className="bg-[#111318] text-white border border-white/10 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <FiAward className="text-emerald-400" size={16} />
                    <h3 className="text-sm font-black text-white">
                      Live Candidate Evaluation Rubric
                    </h3>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${currentTier.color}`}
                    >
                      {currentTier.label}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Adjust criteria sliders. Scoring saves directly to the student's unified
                    performance record.
                  </p>
                </div>

                <div className="text-left sm:text-right shrink-0">
                  <span className="text-xs text-zinc-400 block font-semibold">Overall Score</span>
                  <span className="text-3xl font-black text-emerald-400">
                    {overallScore}
                    <span className="text-xs text-zinc-500 font-normal"> / 100</span>
                  </span>
                </div>
              </div>

              {/* 6 Interactive Criteria Cards with Progress Fills */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {[
                  {
                    key: "correctness",
                    label: "Correctness (25%)",
                    desc: "Solution logic & accuracy",
                  },
                  {
                    key: "problemSolving",
                    label: "Problem Solving (25%)",
                    desc: "Algorithmic thinking",
                  },
                  {
                    key: "efficiency",
                    label: "Efficiency & Complexity (15%)",
                    desc: "Time & space complexity",
                  },
                  {
                    key: "clarity",
                    label: "Clarity & Structure (15%)",
                    desc: "Clean code & architecture",
                  },
                  {
                    key: "relevance",
                    label: "Technical Relevance (10%)",
                    desc: "Domain knowledge fit",
                  },
                  {
                    key: "communication",
                    label: "Communication (10%)",
                    desc: "Verbal articulation",
                  },
                ].map((crit) => {
                  const val = criteria[crit.key];
                  const barColor =
                    val >= 75 ? "bg-emerald-500" : val >= 50 ? "bg-amber-500" : "bg-rose-500";

                  return (
                    <div
                      key={crit.key}
                      className="bg-white border border-gray-200 rounded-2xl p-4 space-y-2.5 shadow-xs"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-black text-gray-900">{crit.label}</span>
                        <span className="font-mono font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded-md">
                          {val}/100
                        </span>
                      </div>

                      <div className="relative">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={val}
                          onChange={(e) => {
                            const num = Number(e.target.value);
                            setCriteria((prev) => ({ ...prev, [crit.key]: num }));
                          }}
                          className="w-full accent-gray-900 h-2 bg-gray-100 rounded-lg cursor-pointer"
                        />
                        <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mt-1">
                          <div
                            className={`h-full ${barColor} transition-all duration-300 rounded-full`}
                            style={{ width: `${Math.min(val, 100)}%` }}
                          />
                        </div>
                      </div>

                      <p className="text-[10px] text-gray-500">{crit.desc}</p>
                    </div>
                  );
                })}
              </div>

              {/* Auto Calculate Button */}
              <button
                type="button"
                onClick={calculateWeightedScore}
                className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold border border-gray-200 transition shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <FiRefreshCw size={12} />
                <span>Recalculate Weighted Overall Score</span>
              </button>

              {/* Strengths & Weaknesses Tags */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Strengths */}
                <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-2xl p-4 space-y-2.5 shadow-xs">
                  <span className="text-xs font-black text-emerald-800 block">
                    Candidate Strengths
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {strengths.map((s, i) => (
                      <span
                        key={i}
                        className="text-[11px] bg-white border border-emerald-300 text-emerald-800 font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-2xs"
                      >
                        {s}
                        <button
                          onClick={() => setStrengths(strengths.filter((_, idx) => idx !== i))}
                          className="hover:text-emerald-950 font-bold cursor-pointer"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <form onSubmit={handleAddStrength} className="flex gap-1.5">
                    <input
                      value={newStrengthInput}
                      onChange={(e) => setNewStrengthInput(e.target.value)}
                      onBlur={handleAddStrength}
                      placeholder="Add strength tag..."
                      className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-gray-900 outline-none focus:border-emerald-600 shadow-2xs"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer shadow-xs"
                    >
                      Add
                    </button>
                  </form>
                </div>

                {/* Weaknesses */}
                <div className="bg-amber-50/50 border border-amber-200/80 rounded-2xl p-4 space-y-2.5 shadow-xs">
                  <span className="text-xs font-black text-amber-800 block">
                    Areas for Improvement
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {weaknesses.map((w, i) => (
                      <span
                        key={i}
                        className="text-[11px] bg-white border border-amber-300 text-amber-800 font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-2xs"
                      >
                        {w}
                        <button
                          onClick={() => setWeaknesses(weaknesses.filter((_, idx) => idx !== i))}
                          className="hover:text-amber-950 font-bold cursor-pointer"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <form onSubmit={handleAddWeakness} className="flex gap-1.5">
                    <input
                      value={newWeaknessInput}
                      onChange={(e) => setNewWeaknessInput(e.target.value)}
                      onBlur={handleAddWeakness}
                      placeholder="Add improvement tag..."
                      className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-gray-900 outline-none focus:border-amber-600 shadow-2xs"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer shadow-xs"
                    >
                      Add
                    </button>
                  </form>
                </div>
              </div>

              {/* Summary Feedback */}
              <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-2 shadow-xs">
                <label className="text-xs font-black text-gray-900 block">
                  Summary Feedback (Shared with Candidate in Report)
                </label>
                <textarea
                  value={summaryFeedback}
                  onChange={(e) => setSummaryFeedback(e.target.value)}
                  placeholder="Provide constructive feedback for the candidate's development..."
                  rows={3}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900 placeholder-gray-400 outline-none focus:bg-white focus:border-gray-900 resize-none shadow-2xs"
                />
              </div>

              {/* Trainer Private Notes (Strictly Hidden from Student) */}
              <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 space-y-2 shadow-xs">
                <div className="flex items-center gap-1.5 text-xs font-black text-amber-900">
                  <FiLock size={13} />
                  <span>
                    Faculty Private Notes (Confidential — Strictly Redacted from Student)
                  </span>
                </div>
                <textarea
                  value={trainerPrivateNotes}
                  onChange={(e) => setTrainerPrivateNotes(e.target.value)}
                  placeholder="Confidential notes for academic records / placement cell only..."
                  rows={2}
                  className="w-full bg-white border border-amber-300 rounded-xl p-3 text-xs text-amber-950 placeholder-amber-400 outline-none focus:border-amber-600 resize-none shadow-2xs"
                />
              </div>

              {/* Finalize Button */}
              <button
                onClick={handleSubmitEvaluation}
                disabled={isSubmittingEvaluation}
                className="w-full py-3.5 rounded-2xl bg-[#111318] hover:bg-black disabled:opacity-40 text-white text-sm font-black transition flex items-center justify-center gap-2 shadow-xl cursor-pointer"
              >
                {isSubmittingEvaluation ? (
                  <FiRefreshCw size={15} className="animate-spin" />
                ) : (
                  <FiCheckCircle size={15} />
                )}
                <span>Finalize & Submit Live Interview Report</span>
              </button>
            </div>
          )}

          {/* TAB 3 (STUDENT VIEW): LIVE INTERVIEW GUIDE */}
          {activeTab === "guide" && (
            <div className="flex-1 p-5 pt-2 overflow-y-auto space-y-4">
              <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4 shadow-xs">
                <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                  <FiHelpCircle className="text-blue-600" />
                  <span>Live Technical Interview Guidelines</span>
                </h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Welcome to your institutional live interview. Follow these best practices to
                  maximize your performance:
                </p>

                <div className="space-y-2.5 text-xs text-gray-700 pt-1">
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <span className="w-2 h-2 rounded-full bg-blue-500 mt-1 shrink-0" />
                    <span>
                      <strong className="text-gray-900">Communicate your thoughts clearly:</strong>{" "}
                      Explain your approach before jumping into code.
                    </span>
                  </div>

                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1 shrink-0" />
                    <span>
                      <strong className="text-gray-900">Write clean, testable code:</strong> Use
                      meaningful variable names and consider edge cases.
                    </span>
                  </div>

                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <span className="w-2 h-2 rounded-full bg-purple-500 mt-1 shrink-0" />
                    <span>
                      <strong className="text-gray-900">Leverage voice dictation:</strong> If
                      typing is slow, use the Voice Dictate button to articulate solutions
                      verbally.
                    </span>
                  </div>

                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <span className="w-2 h-2 rounded-full bg-amber-500 mt-1 shrink-0" />
                    <span>
                      <strong className="text-gray-900">Shared environment:</strong> The faculty
                      trainer sees your code and answer updates in real-time.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
