import { useState, useRef, useEffect, useCallback } from "react";
import { executeCode, pollCodeStatus } from "../apis/interview.api";

export const LANG_OPTIONS = ["javascript", "python", "java", "cpp"];

export const DEFAULT_CODE_BY_LANG = {
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

export function useCodeExecution({ initialCode, initialLanguage, onCodeBroadcast } = {}) {
  const [language, setLanguage] = useState(initialLanguage || "javascript");
  const [code, setCode] = useState(initialCode || DEFAULT_CODE_BY_LANG.javascript);
  const [stdin, setStdin] = useState("");
  const [codeTab, setCodeTab] = useState("output"); // "output" | "stdin"
  const [isRunningCode, setIsRunningCode] = useState(false);
  const [codeOutput, setCodeOutput] = useState(null);

  const codePollingRef = useRef(null);

  // Sync initial props if they arrive late from REST API
  useEffect(() => {
    if (initialCode) {
      setCode(initialCode);
    }
  }, [initialCode]);

  useEffect(() => {
    if (initialLanguage && LANG_OPTIONS.includes(initialLanguage)) {
      setLanguage(initialLanguage);
    }
  }, [initialLanguage]);

  // Cleanup polling interval on unmount
  useEffect(() => {
    return () => {
      if (codePollingRef.current) {
        clearInterval(codePollingRef.current);
      }
    };
  }, []);

  const handleCodeChange = useCallback(
    (newVal) => {
      const updated = newVal || "";
      setCode(updated);
      if (onCodeBroadcast) {
        onCodeBroadcast(updated, language);
      }
    },
    [language, onCodeBroadcast]
  );

  const handleLanguageChange = useCallback(
    (newLang) => {
      setLanguage(newLang);
      const newCode = DEFAULT_CODE_BY_LANG[newLang] || "";
      setCode(newCode);
      setCodeOutput(null);
      if (onCodeBroadcast) {
        onCodeBroadcast(newCode, newLang);
      }
    },
    [onCodeBroadcast]
  );

  const handleRunCode = useCallback(
    async ({ socket, roomId } = {}) => {
      if (isRunningCode) return;
      setIsRunningCode(true);
      setCodeTab("output");
      setCodeOutput({
        status: { description: "Running on sandbox worker..." },
        stdout: "",
      });

      try {
        const res = await executeCode({
          language,
          source_code: code,
          stdin,
        });

        if (!res?.success || !res?.token) {
          const errMsg = res?.message || "Execution submission failed.";
          setCodeOutput({ error: errMsg, status: { description: "Submission Error" } });
          setIsRunningCode(false);
          return;
        }

        const token = res.token;
        const startTime = Date.now();

        codePollingRef.current = setInterval(async () => {
          if (Date.now() - startTime > 20000) {
            clearInterval(codePollingRef.current);
            codePollingRef.current = null;
            setIsRunningCode(false);
            setCodeOutput({
              error: "Execution timed out (20s).",
              status: { description: "Timeout" },
            });
            return;
          }

          try {
            const statusRes = await pollCodeStatus(token);
            if (!statusRes?.success) {
              clearInterval(codePollingRef.current);
              codePollingRef.current = null;
              setIsRunningCode(false);
              setCodeOutput({
                error: statusRes?.message || "Error polling status.",
                status: { description: "Error" },
              });
              return;
            }

            const statusId = statusRes?.status?.id || 0;
            if (statusId >= 3) {
              clearInterval(codePollingRef.current);
              codePollingRef.current = null;
              setIsRunningCode(false);

              const result = {
                stdout: statusRes.stdout || "",
                stderr: statusRes.stderr || "",
                compile_output: statusRes.compile_output || "",
                time: statusRes.time,
                memory: statusRes.memory,
                status: statusRes.status || { description: "Finished" },
              };
              setCodeOutput(result);

              // Broadcast output to room peer
              if (socket && roomId) {
                socket.emit("workspace:code-output", {
                  liveId: roomId,
                  output:
                    result.stdout ||
                    result.stderr ||
                    result.compile_output ||
                    "No output returned.",
                  status: result.status,
                });
              }
            }
          } catch (pollErr) {
            clearInterval(codePollingRef.current);
            codePollingRef.current = null;
            setIsRunningCode(false);
            setCodeOutput({ error: pollErr.message, status: { description: "Polling Failed" } });
          }
        }, 1000);
      } catch (e) {
        setIsRunningCode(false);
        setCodeOutput({ error: e.message, status: { description: "Execution Failed" } });
      }
    },
    [code, isRunningCode, language, stdin]
  );

  return {
    language,
    setLanguage,
    code,
    setCode,
    stdin,
    setStdin,
    codeTab,
    setCodeTab,
    isRunningCode,
    codeOutput,
    setCodeOutput,
    handleCodeChange,
    handleLanguageChange,
    handleRunCode,
  };
}
