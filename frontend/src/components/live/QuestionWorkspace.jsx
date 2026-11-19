import React from "react";
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
} from "react-icons/fi";
import Editor from "@monaco-editor/react";

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
  const activeQuestion = questions[activeQuestionIndex] || {
    questionText: "Welcome to your live interview session. The trainer will push questions shortly.",
    difficulty: "medium",
  };

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
          <div className="bg-[#111318] text-white border border-gray-900/10 rounded-2xl p-5 space-y-3 shadow-md">
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
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3 mt-auto shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-gray-900 flex items-center gap-1.5">
                  <FiPlus size={14} className="text-gray-900" />
                  <span>Push New Question to Student</span>
                </span>
                <select
                  value={newQuestionDifficulty}
                  onChange={(e) => setNewQuestionDifficulty(e.target.value)}
                  className="bg-white border border-gray-200 text-xs text-gray-800 rounded-xl px-2.5 py-1 outline-none font-semibold shadow-xs"
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
                className="w-full bg-white border border-gray-200 rounded-xl p-3 text-xs text-gray-900 placeholder-gray-400 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 resize-none shadow-xs"
              />

              <button
                onClick={handlePushQuestion}
                disabled={!newQuestionText.trim() || isPushingQuestion}
                className="w-full py-2.5 rounded-xl bg-gray-900 hover:bg-black disabled:opacity-40 text-white text-xs font-black transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
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
        {/* Workspace Tabs Header */}
        <div className="h-14 border-b border-gray-200 bg-white px-5 flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("answer")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === "answer"
                  ? "bg-gray-900 text-white shadow-xs font-black"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              <FiFileText size={14} />
              <span>Live Answer & Voice</span>
            </button>

            <button
              onClick={() => setActiveTab("code")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === "code"
                  ? "bg-gray-900 text-white shadow-xs font-black"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              <FiCode size={14} />
              <span>Shared Monaco Code</span>
            </button>

            {participantRole === "trainer" ? (
              <button
                onClick={() => setActiveTab("rubric")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "rubric"
                    ? "bg-gray-900 text-white shadow-xs font-black"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                <FiSliders size={14} />
                <span>Rubric & Notes (Trainer Only)</span>
              </button>
            ) : (
              <button
                onClick={() => setActiveTab("guide")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "guide"
                    ? "bg-gray-900 text-white font-black shadow-xs"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                <FiHelpCircle size={14} />
                <span>Live Interview Guide</span>
              </button>
            )}
          </div>

          {activeTab === "code" && (
            <div className="flex items-center gap-2">
              <select
                value={language}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="bg-gray-50 border border-gray-200 text-xs text-gray-800 rounded-xl px-2.5 py-1.5 outline-none font-semibold cursor-pointer shadow-xs"
              >
                {langOptions.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang.toUpperCase()}
                  </option>
                ))}
              </select>

              <button
                onClick={handleRunCode}
                disabled={isRunningCode}
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-black transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                {isRunningCode ? (
                  <FiRefreshCw size={12} className="animate-spin" />
                ) : (
                  <FiPlay size={12} />
                )}
                <span>Run</span>
              </button>
            </div>
          )}
        </div>

        {/* Workspace Tab Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* TAB 1: LIVE ANSWER & SPEECH-TO-TEXT */}
          {activeTab === "answer" && (
            <div className="flex-1 p-5 flex flex-col space-y-3 overflow-y-auto">
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
                    <FiMic size={14} />
                    <span>{isDictating ? "Listening (Dictating...)" : "Voice Dictate"}</span>
                  </button>
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

                {participantRole === "student" && (
                  <div className="mt-2 text-[11px] text-gray-500 font-semibold flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Live Synced with Trainer Room
                    </span>
                    <span>{studentAnswer.split(/\s+/).filter(Boolean).length} words</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: SYNCHRONIZED MONACO CODE EDITOR */}
          {activeTab === "code" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 relative">
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

              {/* Console Output Tray */}
              <div className="h-48 border-t border-gray-200 bg-[#111318] text-white flex flex-col shrink-0">
                <div className="h-9 border-b border-white/10 px-4 flex items-center justify-between bg-[#161822]">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCodeTab("output")}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer ${
                        codeTab === "output" ? "bg-white/15 text-white" : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      Terminal Output
                    </button>
                    <button
                      onClick={() => setCodeTab("stdin")}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer ${
                        codeTab === "stdin" ? "bg-white/15 text-white" : "text-zinc-400 hover:text-white"
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
                          <pre className="text-red-400 whitespace-pre-wrap">{codeOutput.stderr}</pre>
                        )}
                        {codeOutput.stdout && (
                          <pre className="text-emerald-400 whitespace-pre-wrap">
                            {codeOutput.stdout}
                          </pre>
                        )}
                      </div>
                    ) : (
                      <span className="text-zinc-500">
                        Click "Run" to compile and execute your code in an isolated sandbox.
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
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              <div className="bg-[#111318] text-white border border-gray-900/10 rounded-2xl p-5 flex items-center justify-between shadow-md">
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <FiAward className="text-emerald-400" />
                    <span>Live Candidate Evaluation Rubric</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Adjust criteria sliders. Scoring saves directly to the student's unified performance record.
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-xs text-zinc-400 block font-semibold">Overall Score</span>
                  <span className="text-3xl font-black text-emerald-400">{overallScore}/100</span>
                </div>
              </div>

              {/* 6 Criteria Sliders */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { key: "correctness", label: "Correctness (25%)", desc: "Solution logic & accuracy" },
                  { key: "problemSolving", label: "Problem Solving (25%)", desc: "Algorithmic thinking" },
                  { key: "efficiency", label: "Efficiency & Complexity (15%)", desc: "Time & space complexity" },
                  { key: "clarity", label: "Clarity & Structure (15%)", desc: "Clean code & architecture" },
                  { key: "relevance", label: "Technical Relevance (10%)", desc: "Domain knowledge fit" },
                  { key: "communication", label: "Communication (10%)", desc: "Verbal articulation" },
                ].map((crit) => (
                  <div key={crit.key} className="bg-white border border-gray-200 rounded-2xl p-4 space-y-2 shadow-xs">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-black text-gray-900">{crit.label}</span>
                      <span className="font-mono font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded-md">
                        {criteria[crit.key]}/100
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={criteria[crit.key]}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setCriteria((prev) => ({ ...prev, [crit.key]: val }));
                      }}
                      className="w-full accent-gray-900 h-2 bg-gray-100 rounded-lg cursor-pointer"
                    />
                    <p className="text-[10px] text-gray-500">{crit.desc}</p>
                  </div>
                ))}
              </div>

              {/* Auto Calculate Button */}
              <button
                type="button"
                onClick={calculateWeightedScore}
                className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold border border-gray-200 transition shadow-xs cursor-pointer"
              >
                Recalculate Weighted Overall Score
              </button>

              {/* Strengths & Weaknesses Tags */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Strengths */}
                <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-2xl p-4 space-y-2.5 shadow-xs">
                  <span className="text-xs font-black text-emerald-800 block">Candidate Strengths</span>
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
                  <span className="text-xs font-black text-amber-800 block">Areas for Improvement</span>
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
                  <span>Faculty Private Notes (Confidential — Strictly Redacted from Student)</span>
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
                className="w-full py-3.5 rounded-2xl bg-gray-900 hover:bg-black disabled:opacity-40 text-white text-sm font-black transition flex items-center justify-center gap-2 shadow-xl cursor-pointer"
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
            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4 shadow-xs">
                <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                  <FiHelpCircle className="text-blue-600" />
                  <span>Live Technical Interview Guidelines</span>
                </h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Welcome to your institutional live interview. Follow these best practices to maximize your performance:
                </p>

                <div className="space-y-2.5 text-xs text-gray-700 pt-1">
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <span className="w-2 h-2 rounded-full bg-blue-500 mt-1 shrink-0" />
                    <span>
                      <strong className="text-gray-900">Communicate your thoughts clearly:</strong> Explain your approach before jumping into code.
                    </span>
                  </div>

                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1 shrink-0" />
                    <span>
                      <strong className="text-gray-900">Write clean, testable code:</strong> Use meaningful variable names and consider edge cases.
                    </span>
                  </div>

                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <span className="w-2 h-2 rounded-full bg-purple-500 mt-1 shrink-0" />
                    <span>
                      <strong className="text-gray-900">Leverage voice dictation:</strong> If typing is slow, use the Voice Dictate button to articulate solutions verbally.
                    </span>
                  </div>

                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <span className="w-2 h-2 rounded-full bg-amber-500 mt-1 shrink-0" />
                    <span>
                      <strong className="text-gray-900">Shared environment:</strong> The faculty trainer sees your code and answer updates in real-time.
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
