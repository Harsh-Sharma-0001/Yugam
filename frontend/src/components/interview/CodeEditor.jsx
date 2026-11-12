import React, { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from "motion/react"
import {
  FiTerminal,
  FiX,
  FiPlay,
  FiLoader,
  FiCheckCircle,
  FiAlertCircle,
  FiClock,
  FiCpu,
  FiEdit3,
} from 'react-icons/fi'
import Editor from '@monaco-editor/react'
import { executeCode, pollCodeStatus } from '../../apis/interview.api'

const LANG_OPTIONS = ["javascript", "python", "java", "cpp"];

const LANG_DETAILS = {
  javascript: { name: "JavaScript", runtime: "Node.js 18", id: 63 },
  python: { name: "Python", runtime: "Python 3.8", id: 71 },
  java: { name: "Java", runtime: "OpenJDK 17", id: 62 },
  cpp: { name: "C++", runtime: "GCC 9", id: 54 },
};

const DEFAULT_CODE = {
  javascript: `// JavaScript (Node.js 18)
function solution() {
  console.log("Hello from JavaScript!");
}

solution();`,

  python: `# Python (3.8)
def solution():
    print("Hello from Python!")

if __name__ == "__main__":
    solution()`,

  java: `// Java (OpenJDK 17) - Class must be named Main
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello from Java!");
    }
}`,

  cpp: `// C++ (GCC 9)
#include <iostream>
using namespace std;

int main() {
    cout << "Hello from C++!" << endl;
    return 0;
}`,
};

function CodeEditor({ onClose, onSubmitCode }) {
  const [lang, setLang] = useState("javascript");
  const [code, setCode] = useState(DEFAULT_CODE["javascript"]);
  const [stdin, setStdin] = useState("");
  const [activeTab, setActiveTab] = useState("output"); // "output" | "stdin"
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState(null);

  const pollingRef = useRef(null);

  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const handleLanguageChange = (newL) => {
    setLang(newL);
    setCode(DEFAULT_CODE[newL] || "");
    setOutput(null);
  };

  const handleRunCode = async () => {
    if (isRunning) return;

    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    setIsRunning(true);
    setActiveTab("output");
    setOutput({
      status: { id: 1, description: "Running..." },
      stdout: "",
      stderr: "",
      compile_output: "",
      time: null,
      memory: null,
    });

    try {
      const res = await executeCode({
        language: lang,
        source_code: code,
        stdin,
      });

      if (!res?.success || !res?.token) {
        setOutput({
          error: res?.message || "Failed to submit code for execution.",
          status: { id: 13, description: "Submission Error" },
        });
        setIsRunning(false);
        return;
      }

      const token = res.token;
      const startTime = Date.now();

      pollingRef.current = setInterval(async () => {
        // Safety timeout of 20 seconds
        if (Date.now() - startTime > 20000) {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          setIsRunning(false);
          setOutput({
            error: "Execution timed out waiting for sandbox worker (20s).",
            status: { id: 5, description: "Time Limit Exceeded" },
          });
          return;
        }

        try {
          const statusRes = await pollCodeStatus(token);

          if (!statusRes?.success) {
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
            setIsRunning(false);
            setOutput({
              error: statusRes?.message || "Error retrieving execution status.",
              status: { id: 13, description: "Internal Error" },
            });
            return;
          }

          // Runner status codes:
          // 1: In Queue, 2: Processing
          // 3: Accepted
          // > 3: Compilation/Runtime/Time Limit Error
          const statusId = statusRes?.status?.id || 0;

          if (statusId >= 3) {
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
            setIsRunning(false);
            setOutput(statusRes);
          } else {
            // Still in queue or processing
            setOutput((prev) => ({
              ...prev,
              status: statusRes.status || { id: statusId, description: "Running..." },
            }));
          }
        } catch (pollErr) {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          setIsRunning(false);
          setOutput({
            error: pollErr?.message || "Polling network error.",
            status: { id: 13, description: "Network Error" },
          });
        }
      }, 400);
    } catch (err) {
      setIsRunning(false);
      setOutput({
        error: err?.message || "Failed to trigger code execution.",
        status: { id: 13, description: "Request Failed" },
      });
    }
  };

  const formatMemory = (memKb) => {
    if (!memKb && memKb !== 0) return null;
    const num = Number(memKb);
    if (isNaN(num)) return null;
    if (num >= 1024) {
      return `${(num / 1024).toFixed(1)} MB`;
    }
    return `${num} KB`;
  };

  const formatTime = (timeSec) => {
    if (!timeSec && timeSec !== 0) return null;
    const num = parseFloat(timeSec);
    if (isNaN(num)) return null;
    return `${num.toFixed(3)}s`;
  };

  const renderStatusBadge = () => {
    if (isRunning) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/25">
          <FiLoader className="animate-spin" size={11} />
          Running...
        </span>
      );
    }

    if (!output) return null;

    if (output.error) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/25">
          <FiAlertCircle size={11} />
          {output.status?.description || "Failed"}
        </span>
      );
    }

    const statusId = output.status?.id;

    if (statusId === 3) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
          <FiCheckCircle size={11} />
          Accepted
        </span>
      );
    }

    if (statusId > 3) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/25">
          <FiAlertCircle size={11} />
          {output.status?.description || "Error"}
        </span>
      );
    }

    return null;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 20 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-x-3 top-3 bottom-3 sm:inset-x-6 sm:top-5 sm:bottom-5 md:inset-x-12 md:top-6 md:bottom-6 z-50 flex flex-col overflow-hidden rounded-2xl bg-[#0E1016] border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] via-transparent to-transparent pointer-events-none" />

        {/* Modal Header */}
        <div className="relative flex items-center justify-between px-4 sm:px-5 py-3 border-b border-white/8 bg-[#0E1016]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <FiTerminal className="text-emerald-400" size={14} />
            </div>
            <div>
              <span className="text-sm font-semibold text-white">Online Compiler & Editor</span>
              <span className="hidden sm:inline-block ml-2 text-[10px] text-zinc-400 border border-white/10 rounded px-1.5 py-0.2 bg-white/[0.03]">
                Isolated Sandbox
              </span>
            </div>
          </div>

          {/* Language selector pills */}
          <div className="flex items-center gap-1.5">
            {LANG_OPTIONS.map((l) => (
              <button
                key={l}
                onClick={() => handleLanguageChange(l)}
                className={`text-xs px-2.5 py-1 rounded-lg capitalize transition-all cursor-pointer ${
                  lang === l
                    ? "bg-white text-[#0A0A0A] font-semibold shadow-sm"
                    : "text-white/40 hover:text-white/80 hover:bg-white/5"
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          <button
            onClick={onClose}
            className="text-white/35 hover:text-white transition-colors cursor-pointer p-1 rounded-lg hover:bg-white/5"
          >
            <FiX size={18} />
          </button>
        </div>

        {/* Monaco Editor Canvas */}
        <div className="relative flex-1 min-h-[180px] bg-[#0E1016]">
          <Editor
            height="100%"
            language={lang}
            value={code}
            onChange={(v) => setCode(v || "")}
            theme="vs-dark"
            options={{
              fontSize: 13,
              minimap: { enabled: false },
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              wordWrap: "on",
              padding: { top: 12, bottom: 8 },
              fontFamily: "'Fira Code', 'Cascadia Code', monospace",
              fontLigatures: true,
              renderLineHighlight: "line",
              cursorBlinking: "smooth",
            }}
          />
        </div>

        {/* Bottom Terminal Drawer (Output & Stdin) */}
        <div className="relative flex flex-col h-56 sm:h-64 border-t border-white/10 bg-[#090A0F]">
          {/* Drawer Header & Tabs */}
          <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-white/8 bg-[#0C0E14]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("output")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                  activeTab === "output"
                    ? "bg-white/10 text-white font-semibold border border-white/15 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                }`}
              >
                <FiTerminal size={12} />
                Output
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("stdin")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                  activeTab === "stdin"
                    ? "bg-white/10 text-white font-semibold border border-white/15 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                }`}
              >
                <FiEdit3 size={12} />
                Custom Input (stdin)
                {stdin.trim() && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                )}
              </button>
            </div>

            {/* Status & Metrics */}
            <div className="flex items-center gap-2 sm:gap-3">
              {renderStatusBadge()}

              {output && !isRunning && (output.time || output.memory) && (
                <div className="hidden sm:flex items-center gap-2.5 text-[11px] text-zinc-400">
                  {formatTime(output.time) && (
                    <span className="flex items-center gap-1">
                      <FiClock size={11} className="text-zinc-500" />
                      {formatTime(output.time)}
                    </span>
                  )}
                  {formatMemory(output.memory) && (
                    <span className="flex items-center gap-1">
                      <FiCpu size={11} className="text-zinc-500" />
                      {formatMemory(output.memory)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 font-mono text-xs text-zinc-300 bg-[#07080C] select-text">
            {activeTab === "output" ? (
              <div className="h-full">
                {isRunning ? (
                  <div className="flex items-center gap-2 text-amber-400/90 text-xs py-2">
                    <FiLoader className="animate-spin shrink-0" size={14} />
                    <span>Compiling & executing code in isolated sandbox...</span>
                  </div>
                ) : output ? (
                  <div className="space-y-2">
                    {/* Explicit Error from network/server */}
                    {output.error && (
                      <div className="rounded-lg bg-red-950/25 border border-red-500/25 p-3 text-red-400 whitespace-pre-wrap leading-relaxed">
                        {output.error}
                      </div>
                    )}

                    {/* Compilation Error Output */}
                    {output.compile_output && (
                      <div className="rounded-lg bg-red-950/25 border border-red-500/25 p-3 text-red-400 whitespace-pre-wrap leading-relaxed">
                        <div className="text-[10px] uppercase font-bold tracking-wider text-red-400/70 mb-1">
                          Compilation Error:
                        </div>
                        {output.compile_output}
                      </div>
                    )}

                    {/* Runtime Stderr */}
                    {output.stderr && (
                      <div className="rounded-lg bg-red-950/20 border border-red-500/20 p-3 text-red-400 whitespace-pre-wrap leading-relaxed">
                        <div className="text-[10px] uppercase font-bold tracking-wider text-red-400/70 mb-1">
                          Standard Error (stderr):
                        </div>
                        {output.stderr}
                      </div>
                    )}

                    {/* Standard Output (stdout) */}
                    {output.stdout ? (
                      <div className="rounded-lg bg-black/40 border border-white/5 p-3 text-emerald-400/95 whitespace-pre-wrap leading-relaxed">
                        {output.stdout}
                      </div>
                    ) : (
                      !output.compile_output &&
                      !output.stderr &&
                      !output.error &&
                      output.status?.id === 3 && (
                        <div className="text-zinc-500 italic py-2">
                          Program finished with no output.
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-start justify-center h-full text-zinc-500 text-xs gap-1">
                    <p>Click <span className="text-emerald-400 font-semibold">▶ Run Code</span> below to compile and execute your program.</p>
                    <p className="text-[11px] text-zinc-600">You can also supply custom inputs in the Custom Input (stdin) tab.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col">
                <textarea
                  value={stdin}
                  onChange={(e) => setStdin(e.target.value)}
                  placeholder="Enter custom input (stdin) for your program here (e.g. input lines for scanner, cin, readline)..."
                  className="w-full h-full bg-[#0C0E14] border border-white/10 rounded-lg p-3 text-xs font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-white/25 resize-none leading-relaxed"
                />
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="relative border-t border-white/10 px-4 py-3 flex items-center justify-between bg-[#0E1016]">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="text-zinc-500">Runtime:</span>
            <span className="text-white font-medium bg-white/5 px-2 py-0.5 rounded border border-white/10 text-[11px]">
              {LANG_DETAILS[lang]?.runtime || lang}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Run Code Button */}
            <button
              type="button"
              onClick={handleRunCode}
              disabled={isRunning || !code.trim()}
              className="flex items-center gap-2 text-xs px-4 py-2 rounded-lg bg-emerald-500 text-black font-semibold hover:bg-emerald-400 transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed shadow-[0_0_15px_rgba(16,185,129,0.2)]"
            >
              {isRunning ? (
                <>
                  <FiLoader className="animate-spin" size={13} />
                  <span>Running...</span>
                </>
              ) : (
                <>
                  <FiPlay size={12} className="fill-current" />
                  <span>Run Code</span>
                </>
              )}
            </button>

            {/* Add To Answer Button */}
            <button
              type="button"
              onClick={() => onSubmitCode?.(code)}
              className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-white text-[#0A0A0A] font-semibold hover:bg-white/90 transition-all cursor-pointer shadow-sm"
            >
              Add To Answer
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default CodeEditor;
