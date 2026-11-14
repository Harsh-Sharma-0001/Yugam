import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  FiVideo,
  FiVideoOff,
  FiMic,
  FiMicOff,
  FiPhoneOff,
  FiSend,
  FiCode,
  FiFileText,
  FiCheckCircle,
  FiAlertCircle,
  FiPlay,
  FiRefreshCw,
  FiSliders,
  FiUser,
  FiHelpCircle,
  FiLock,
  FiPlus,
  FiChevronRight,
  FiClock,
  FiArrowLeft,
  FiAward,
} from "react-icons/fi";
import Editor from "@monaco-editor/react";
import { io } from "socket.io-client";
import {
  joinLiveRoom,
  completeLiveRoom,
  executeCode,
  pollCodeStatus,
} from "../apis/interview.api";

const LANG_OPTIONS = ["javascript", "python", "java", "cpp"];

const DEFAULT_CODE_BY_LANG = {
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

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

function LiveInterviewRoom({ user }) {
  const { scheduleId } = useParams();
  const navigate = useNavigate();

  // Initialization State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [room, setRoom] = useState(null);
  const [scheduled, setScheduled] = useState(null);
  const [participantRole, setParticipantRole] = useState("student"); // "trainer" | "student"

  // WebRTC Media & Streams
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [peerConnected, setPeerConnected] = useState(false);
  const [peerInfo, setPeerInfo] = useState({ userName: "", role: "" });

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const socketRef = useRef(null);
  const streamRef = useRef(null);

  // Timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Workspace State
  const [activeTab, setActiveTab] = useState("answer"); // "answer" | "code" | "rubric" | "guide"
  const [questions, setQuestions] = useState([]);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [studentAnswer, setStudentAnswer] = useState("");

  // Trainer Question Add Input
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newQuestionDifficulty, setNewQuestionDifficulty] = useState("medium");
  const [isPushingQuestion, setIsPushingQuestion] = useState(false);

  // Speech-to-Text
  const [isDictating, setIsDictating] = useState(false);
  const speechRecognitionRef = useRef(null);
  const [speechSupported] = useState(
    () => typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window)
  );

  // Monaco Code Editor & Runner
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState(DEFAULT_CODE_BY_LANG.javascript);
  const [stdin, setStdin] = useState("");
  const [codeTab, setCodeTab] = useState("output"); // "output" | "stdin"
  const [isRunningCode, setIsRunningCode] = useState(false);
  const [codeOutput, setCodeOutput] = useState(null);
  const codePollingRef = useRef(null);

  // Trainer Evaluation & Rubric State
  const [criteria, setCriteria] = useState({
    correctness: 70,
    clarity: 70,
    relevance: 70,
    efficiency: 70,
    communication: 70,
    problemSolving: 70,
  });
  const [overallScore, setOverallScore] = useState(70);
  const [strengths, setStrengths] = useState([]);
  const [newStrengthInput, setNewStrengthInput] = useState("");
  const [weaknesses, setWeaknesses] = useState([]);
  const [newWeaknessInput, setNewWeaknessInput] = useState("");
  const [summaryFeedback, setSummaryFeedback] = useState("");
  const [trainerPrivateNotes, setTrainerPrivateNotes] = useState("");
  const [isSubmittingEvaluation, setIsSubmittingEvaluation] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [sessionCompletedReport, setSessionCompletedReport] = useState(null);

  // Timer counter
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // 1. Initialize Room Session via REST
  useEffect(() => {
    let isMounted = true;

    const initRoom = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await joinLiveRoom(scheduleId);
        if (!res?.success) {
          throw new Error(res?.message || "Failed to enter live interview room.");
        }

        if (!isMounted) return;

        setRoom(res.room);
        setScheduled(res.scheduled);
        setParticipantRole(res.participantRole);

        if (res.room.questions && res.room.questions.length > 0) {
          setQuestions(res.room.questions);
          setStudentAnswer(res.room.questions[0].studentAnswer || "");
        }

        if (res.room.sharedCode?.content) {
          setCode(res.room.sharedCode.content);
          if (res.room.sharedCode.language) {
            setLanguage(res.room.sharedCode.language);
          }
        }

        if (res.room.trainerPrivateNotes) {
          setTrainerPrivateNotes(res.room.trainerPrivateNotes);
        }
      } catch (err) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (scheduleId) {
      initRoom();
    }

    return () => {
      isMounted = false;
    };
  }, [scheduleId]);

  // 2. Setup Local Media Stream
  useEffect(() => {
    let localMediaStream = null;

    const setupMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localMediaStream = stream;
        streamRef.current = stream;
        setLocalStream(stream);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.warn("Could not access camera/mic:", err.message);
        // Fallback: try audio only
        try {
          const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true });
          localMediaStream = audioOnly;
          streamRef.current = audioOnly;
          setLocalStream(audioOnly);
          setIsCameraOn(false);
        } catch (audioErr) {
          console.warn("Microphone access also failed:", audioErr.message);
          setIsMicOn(false);
          setIsCameraOn(false);
        }
      }
    };

    setupMedia();

    return () => {
      if (localMediaStream) {
        localMediaStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // 3. Setup WebRTC PeerConnection & Socket.IO Signaling
  useEffect(() => {
    if (!room?._id) return;

    const socketUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:6000";
    const socket = io(socketUrl, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    // Attach local stream tracks to RTCPeerConnection
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, streamRef.current);
      });
    }

    // Remote track arrival
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
        setPeerConnected(true);
      }
    };

    // ICE Candidate generation
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit("webrtc:ice-candidate", {
          liveId: room._id,
          candidate: event.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        setPeerConnected(true);
      } else if (
        pc.connectionState === "disconnected" ||
        pc.connectionState === "failed" ||
        pc.connectionState === "closed"
      ) {
        setPeerConnected(false);
      }
    };

    // Join room on connect
    socket.on("connect", () => {
      socket.emit("room:join", {
        liveId: room._id,
        role: participantRole,
        userName: user?.name || (participantRole === "trainer" ? "Trainer" : "Student"),
      });
    });

    // When another peer joins the room
    socket.on("user:joined", async (peer) => {
      setPeerInfo({ userName: peer.userName, role: peer.role });

      // Trainer initiates the WebRTC offer
      if (participantRole === "trainer") {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("webrtc:offer", {
            liveId: room._id,
            targetSocketId: peer.socketId,
            sdp: offer,
          });
        } catch (e) {
          console.error("Error creating WebRTC offer:", e);
        }
      }
    });

    socket.on("room:joined", async ({ peers }) => {
      if (peers && peers.length > 0) {
        setPeerInfo({ userName: peers[0].userName, role: peers[0].role });
      }
    });

    // Incoming WebRTC Offer
    socket.on("webrtc:offer", async ({ senderSocketId, sdp }) => {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("webrtc:answer", {
          liveId: room._id,
          targetSocketId: senderSocketId,
          sdp: answer,
        });
      } catch (e) {
        console.error("Error handling WebRTC offer:", e);
      }
    });

    // Incoming WebRTC Answer
    socket.on("webrtc:answer", async ({ sdp }) => {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      } catch (e) {
        console.error("Error handling WebRTC answer:", e);
      }
    });

    // Incoming ICE Candidate
    socket.on("webrtc:ice-candidate", async ({ candidate }) => {
      try {
        if (candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (e) {
        console.error("Error adding ICE candidate:", e);
      }
    });

    // Workspace: Question Pushed by Trainer
    socket.on("workspace:question-pushed", ({ questions: updatedQuestions, activeQuestionIndex: newIdx }) => {
      setQuestions(updatedQuestions);
      setActiveQuestionIndex(newIdx);
      const curQ = updatedQuestions[newIdx];
      setStudentAnswer(curQ?.studentAnswer || "");
    });

    // Workspace: Question switch
    socket.on("workspace:active-question-switched", ({ questionIndex }) => {
      setActiveQuestionIndex(questionIndex);
      setQuestions((prev) => {
        const curQ = prev[questionIndex];
        if (curQ) setStudentAnswer(curQ.studentAnswer || "");
        return prev;
      });
    });

    // Workspace: Live answer update (speech or typing)
    socket.on("workspace:answer-updated", ({ questionIndex, answerText }) => {
      setQuestions((prev) => {
        const nextQ = [...prev];
        if (nextQ[questionIndex]) {
          nextQ[questionIndex] = { ...nextQ[questionIndex], studentAnswer: answerText };
        }
        return nextQ;
      });
      setActiveQuestionIndex((currentIdx) => {
        if (currentIdx === questionIndex) {
          setStudentAnswer(answerText);
        }
        return currentIdx;
      });
    });

    // Workspace: Real-time Monaco Code Editor update
    socket.on("workspace:code-updated", ({ code: remoteCode, language: remoteLang }) => {
      setCode(remoteCode);
      if (remoteLang) setLanguage(remoteLang);
    });

    // Workspace: Code output update
    socket.on("workspace:code-output", ({ output, status }) => {
      setCodeOutput({
        stdout: output,
        status: status || { description: "Executed" },
      });
    });

    // Workspace: Session ended by trainer
    socket.on("workspace:session-ended", ({ report }) => {
      setSessionCompletedReport(report || {});
      setShowEndModal(true);
    });

    // Peer disconnected
    socket.on("user:left", () => {
      setPeerConnected(false);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (pcRef.current) {
        pcRef.current.close();
      }
    };
  }, [room?._id, participantRole, user?.name]);

  // Handle Local Camera Toggle
  const toggleCamera = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOn(videoTrack.enabled);
      }
    }
  };

  // Handle Local Mic Toggle
  const toggleMic = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
      }
    }
  };

  // Handle Speech-to-Text Dictation
  const toggleDictation = () => {
    if (!speechSupported) return;

    if (isDictating) {
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop();
      }
      setIsDictating(false);
    } else {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new SpeechRecognition();
      rec.lang = "en-US";
      rec.continuous = true;
      rec.interimResults = false;

      rec.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript;
        setStudentAnswer((prev) => {
          const updated = prev ? `${prev} ${transcript.trim()}` : transcript.trim();
          // Broadcast live to socket
          if (socketRef.current && room?._id) {
            socketRef.current.emit("workspace:answer-update", {
              liveId: room._id,
              questionIndex: activeQuestionIndex,
              answerText: updated,
            });
          }
          return updated;
        });
      };

      rec.onerror = (e) => {
        console.warn("Speech recognition error:", e);
        setIsDictating(false);
      };

      rec.onend = () => {
        setIsDictating(false);
      };

      speechRecognitionRef.current = rec;
      rec.start();
      setIsDictating(true);
    }
  };

  // Handle Student Typed Answer Change
  const handleAnswerChange = (val) => {
    setStudentAnswer(val);
    if (socketRef.current && room?._id) {
      socketRef.current.emit("workspace:answer-update", {
        liveId: room._id,
        questionIndex: activeQuestionIndex,
        answerText: val,
      });
    }
  };

  // Handle Trainer Pushing New Question
  const handlePushQuestion = () => {
    if (!newQuestionText.trim() || !room?._id || !socketRef.current) return;
    setIsPushingQuestion(true);

    socketRef.current.emit("workspace:question-push", {
      liveId: room._id,
      questionText: newQuestionText.trim(),
      difficulty: newQuestionDifficulty,
    });

    setNewQuestionText("");
    setIsPushingQuestion(false);
  };

  // Switch Active Question
  const switchQuestion = (index) => {
    setActiveQuestionIndex(index);
    if (questions[index]) {
      setStudentAnswer(questions[index].studentAnswer || "");
    }
    if (socketRef.current && room?._id) {
      socketRef.current.emit("workspace:active-question", {
        liveId: room._id,
        questionIndex: index,
      });
    }
  };

  // Handle Code Change in Monaco
  const handleCodeChange = (val) => {
    const updated = val || "";
    setCode(updated);
    if (socketRef.current && room?._id) {
      socketRef.current.emit("workspace:code-update", {
        liveId: room._id,
        code: updated,
        language,
      });
    }
  };

  // Handle Language Change
  const handleLanguageChange = (newLang) => {
    setLanguage(newLang);
    const newCode = DEFAULT_CODE_BY_LANG[newLang] || "";
    setCode(newCode);
    setCodeOutput(null);

    if (socketRef.current && room?._id) {
      socketRef.current.emit("workspace:code-update", {
        liveId: room._id,
        code: newCode,
        language: newLang,
      });
    }
  };

  // Run Code via CodeBox
  const handleRunCode = async () => {
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

            // Broadcast to other participant
            if (socketRef.current && room?._id) {
              socketRef.current.emit("workspace:code-output", {
                liveId: room._id,
                output: result.stdout || result.stderr || result.compile_output || "No output returned.",
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
  };

  // Add Strength tag
  const handleAddStrength = (e) => {
    e?.preventDefault();
    if (newStrengthInput.trim() && !strengths.includes(newStrengthInput.trim())) {
      setStrengths([...strengths, newStrengthInput.trim()]);
      setNewStrengthInput("");
    }
  };

  // Add Weakness tag
  const handleAddWeakness = (e) => {
    e?.preventDefault();
    if (newWeaknessInput.trim() && !weaknesses.includes(newWeaknessInput.trim())) {
      setWeaknesses([...weaknesses, newWeaknessInput.trim()]);
      setNewWeaknessInput("");
    }
  };

  // Auto-calculate weighted score
  const calculateWeightedScore = () => {
    const calculated = Math.round(
      0.25 * criteria.correctness +
      0.25 * criteria.problemSolving +
      0.15 * criteria.efficiency +
      0.15 * criteria.clarity +
      0.10 * criteria.relevance +
      0.10 * criteria.communication
    );
    setOverallScore(calculated);
  };

  // Finalize & Submit Evaluation (Trainer)
  const handleSubmitEvaluation = async () => {
    if (!room?._id) return;
    setIsSubmittingEvaluation(true);
    try {
      const payload = {
        overallScore,
        criteria,
        strengths,
        weaknesses,
        summaryFeedback,
        trainerPrivateNotes,
        questions,
        sharedCode: { content: code, language },
      };

      const res = await completeLiveRoom(room._id, payload);
      if (!res?.success) {
        throw new Error(res?.message || "Failed to finalize evaluation.");
      }

      setSessionCompletedReport(res.liveInterview);

      // Notify peer that session is concluded
      if (socketRef.current) {
        socketRef.current.emit("workspace:session-ended", {
          liveId: room._id,
          report: res.liveInterview,
        });
      }

      setShowEndModal(true);
    } catch (err) {
      alert("Evaluation submission failed: " + err.message);
    } finally {
      setIsSubmittingEvaluation(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (codePollingRef.current) clearInterval(codePollingRef.current);
      if (speechRecognitionRef.current) speechRecognitionRef.current.stop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-[#07080B] flex flex-col items-center justify-center text-white px-4">
        <div className="w-12 h-12 border-3 border-purple-500 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-lg font-bold text-white tracking-wide">Connecting to Live Interview Studio...</h2>
        <p className="text-xs text-zinc-400 mt-1">Establishing encrypted WebRTC & Socket signaling channels</p>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="min-h-screen bg-[#07080B] flex flex-col items-center justify-center text-white px-4">
        <div className="max-w-md w-full bg-[#111218] border border-red-500/20 rounded-2xl p-6 text-center shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4 text-red-400">
            <FiAlertCircle size={24} />
          </div>
          <h3 className="text-base font-bold text-white">Live Room Access Error</h3>
          <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{error}</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold transition"
          >
            <FiArrowLeft size={14} />
            <span>Return to Dashboard</span>
          </button>
        </div>
      </div>
    );
  }

  const activeQuestion = questions[activeQuestionIndex] || {
    questionText: "Welcome to your live interview session. The trainer will push questions shortly.",
    difficulty: "medium",
  };

  return (
    <div className="min-h-screen bg-[#07080B] text-zinc-200 flex flex-col font-sans select-none overflow-hidden">
      {/* 1. STUDIO HEADER */}
      <header className="h-14 border-b border-white/10 bg-[#0C0D13]/90 backdrop-blur-md px-4 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (confirm("Are you sure you want to exit the live interview room?")) {
                navigate("/dashboard");
              }
            }}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition"
            title="Back to Dashboard"
          >
            <FiArrowLeft size={15} />
          </button>

          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <h1 className="text-sm font-black text-white tracking-wide flex items-center gap-2">
              <span>YUGAM LIVE STUDIO</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase">
                {scheduled?.role || "Technical Interview"}
              </span>
            </h1>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-400 bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
            <FiClock size={12} className="text-purple-400" />
            <span className="font-mono font-semibold">{formatTime(elapsedSeconds)}</span>
          </div>
        </div>

        {/* Right Header Status & Controls */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/5 text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                peerConnected ? "bg-emerald-400" : "bg-amber-400 animate-pulse"
              }`}
            />
            <span className="text-[11px] text-zinc-300 font-medium">
              {peerConnected ? `Peer: ${peerInfo.userName || "Connected"}` : "Waiting for Peer..."}
            </span>
          </div>

          <span
            className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border ${
              participantRole === "trainer"
                ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
                : "bg-blue-500/10 text-blue-400 border-blue-500/30"
            }`}
          >
            {participantRole === "trainer" ? "Faculty Trainer" : "Candidate Student"}
          </span>

          {participantRole === "trainer" && (
            <button
              onClick={() => {
                calculateWeightedScore();
                setActiveTab("rubric");
              }}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <FiSliders size={13} />
              <span>Evaluate & Conclude</span>
            </button>
          )}

          <button
            onClick={() => {
              if (confirm("Disconnect and leave this live session?")) {
                navigate("/dashboard");
              }
            }}
            className="px-3 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/30 text-xs font-bold transition flex items-center gap-1.5"
            title="Leave Room"
          >
            <FiPhoneOff size={13} />
            <span className="hidden sm:inline">Leave Room</span>
          </button>
        </div>
      </header>

      {/* 2. SPLIT-SCREEN MAIN STUDIO WORKSPACE */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* LEFT PANEL: Dual Video Tiles + Active Question (40% width on lg) */}
        <div className="w-full lg:w-[42%] border-r border-white/10 flex flex-col bg-[#0A0B10] overflow-hidden">
          {/* A. DUAL WEBRTC VIDEO TILES */}
          <div className="p-3.5 grid grid-cols-2 gap-2.5 bg-[#08090E] border-b border-white/10 shrink-0">
            {/* Local Video Tile */}
            <div className="relative aspect-video rounded-xl overflow-hidden bg-zinc-900 border border-white/10 flex items-center justify-center shadow-lg group">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover -scale-x-100 ${
                  isCameraOn ? "block" : "hidden"
                }`}
              />
              {!isCameraOn && (
                <div className="flex flex-col items-center justify-center text-zinc-500">
                  <FiVideoOff size={28} className="mb-1 text-zinc-600" />
                  <span className="text-[10px] uppercase font-bold">Camera Off</span>
                </div>
              )}
              <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-semibold text-white flex items-center gap-1 border border-white/10">
                <FiUser size={10} className="text-purple-400" />
                <span>You ({participantRole === "trainer" ? "Trainer" : "Student"})</span>
              </div>
              <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] text-zinc-300 border border-white/10">
                {isMicOn ? <FiMic size={11} className="text-emerald-400" /> : <FiMicOff size={11} className="text-red-400" />}
              </div>
            </div>

            {/* Remote Peer Video Tile */}
            <div className="relative aspect-video rounded-xl overflow-hidden bg-zinc-900 border border-white/10 flex items-center justify-center shadow-lg">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className={`w-full h-full object-cover ${
                  peerConnected && remoteStream ? "block" : "hidden"
                }`}
              />
              {(!peerConnected || !remoteStream) && (
                <div className="flex flex-col items-center justify-center text-zinc-500 p-2 text-center">
                  <div className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-1 animate-pulse">
                    <FiUser size={14} className="text-zinc-400" />
                  </div>
                  <span className="text-[11px] font-semibold text-zinc-400">
                    {participantRole === "trainer" ? "Waiting for Student" : "Waiting for Trainer"}
                  </span>
                  <span className="text-[9px] text-zinc-600 mt-0.5">Connecting peer WebRTC...</span>
                </div>
              )}
              <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-semibold text-white flex items-center gap-1 border border-white/10">
                <span className={`w-1.5 h-1.5 rounded-full ${peerConnected ? "bg-emerald-400" : "bg-amber-400"}`} />
                <span>
                  {peerInfo.userName || (participantRole === "trainer" ? scheduled?.studentName || "Candidate" : scheduled?.trainerName || "Faculty")}
                </span>
              </div>
            </div>
          </div>

          {/* Media Control Toolbar */}
          <div className="px-3.5 py-2 bg-[#0E1017] border-b border-white/10 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMic}
                className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                  isMicOn
                    ? "bg-zinc-800 hover:bg-zinc-700 text-white"
                    : "bg-red-600/30 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/30"
                }`}
                title={isMicOn ? "Mute Microphone" : "Unmute Microphone"}
              >
                {isMicOn ? <FiMic size={14} className="text-emerald-400" /> : <FiMicOff size={14} />}
                <span className="text-[11px]">{isMicOn ? "Mic On" : "Muted"}</span>
              </button>

              <button
                onClick={toggleCamera}
                className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                  isCameraOn
                    ? "bg-zinc-800 hover:bg-zinc-700 text-white"
                    : "bg-red-600/30 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/30"
                }`}
                title={isCameraOn ? "Turn Camera Off" : "Turn Camera On"}
              >
                {isCameraOn ? <FiVideo size={14} className="text-blue-400" /> : <FiVideoOff size={14} />}
                <span className="text-[11px]">{isCameraOn ? "Camera On" : "Camera Off"}</span>
              </button>
            </div>

            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
              P2P Encrypted Stream
            </span>
          </div>

          {/* B. ACTIVE QUESTION DISPLAY & SELECTOR */}
          <div className="flex-1 flex flex-col p-4 overflow-y-auto space-y-4">
            {/* Question Selector Strip */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <FiFileText size={13} className="text-purple-400" />
                <span>Interview Questions ({questions.length})</span>
              </span>

              {questions.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  {questions.map((q, idx) => (
                    <button
                      key={q._id || idx}
                      onClick={() => switchQuestion(idx)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition border ${
                        activeQuestionIndex === idx
                          ? "bg-purple-600 text-white border-purple-500"
                          : "bg-white/5 hover:bg-white/10 text-zinc-400 border-white/5"
                      }`}
                    >
                      Q{idx + 1}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Active Question Card */}
            <div className="bg-[#12141D] border border-white/10 rounded-2xl p-4.5 space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">
                  Question #{activeQuestionIndex + 1}
                </span>

                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                    activeQuestion.difficulty === "easy"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : activeQuestion.difficulty === "hard"
                      ? "bg-red-500/10 text-red-400 border-red-500/20"
                      : "bg-amber-500/10 text-amber-400 border-amber-500/20"
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
              <div className="bg-[#12141D] border border-purple-500/20 rounded-2xl p-4 space-y-3 mt-auto">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <FiPlus size={13} className="text-purple-400" />
                    <span>Push New Question to Student</span>
                  </span>
                  <select
                    value={newQuestionDifficulty}
                    onChange={(e) => setNewQuestionDifficulty(e.target.value)}
                    className="bg-[#1B1D27] border border-white/10 text-xs text-zinc-300 rounded-lg px-2 py-1 outline-none font-semibold"
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
                  className="w-full bg-[#181A24] border border-white/10 rounded-xl p-2.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-purple-500/50 resize-none"
                />

                <button
                  onClick={handlePushQuestion}
                  disabled={!newQuestionText.trim() || isPushingQuestion}
                  className="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md"
                >
                  <FiSend size={12} />
                  <span>Push to Room</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: Tabbed Workspace (Answer / Synced Monaco / Rubric) (58% width) */}
        <div className="w-full lg:w-[58%] flex flex-col bg-[#0D0E15] overflow-hidden">
          {/* Workspace Tabs Header */}
          <div className="h-11 border-b border-white/10 bg-[#0A0B10] px-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveTab("answer")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === "answer"
                    ? "bg-purple-600/20 text-purple-300 border border-purple-500/30"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <FiFileText size={13} />
                <span>Live Answer & Voice</span>
              </button>

              <button
                onClick={() => setActiveTab("code")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === "code"
                    ? "bg-purple-600/20 text-purple-300 border border-purple-500/30"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <FiCode size={13} />
                <span>Shared Monaco Code</span>
              </button>

              {participantRole === "trainer" ? (
                <button
                  onClick={() => setActiveTab("rubric")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    activeTab === "rubric"
                      ? "bg-emerald-600/20 text-emerald-300 border border-emerald-500/30"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <FiSliders size={13} />
                  <span>Rubric & Notes (Trainer Only)</span>
                </button>
              ) : (
                <button
                  onClick={() => setActiveTab("guide")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    activeTab === "guide"
                      ? "bg-blue-600/20 text-blue-300 border border-blue-500/30"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <FiHelpCircle size={13} />
                  <span>Live Interview Guide</span>
                </button>
              )}
            </div>

            {activeTab === "code" && (
              <div className="flex items-center gap-2">
                <select
                  value={language}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  className="bg-[#171822] border border-white/10 text-xs text-zinc-300 rounded-lg px-2 py-1 outline-none font-semibold cursor-pointer"
                >
                  {LANG_OPTIONS.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang.toUpperCase()}
                    </option>
                  ))}
                </select>

                <button
                  onClick={handleRunCode}
                  disabled={isRunningCode}
                  className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                >
                  {isRunningCode ? (
                    <FiRefreshCw size={11} className="animate-spin" />
                  ) : (
                    <FiPlay size={11} />
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
              <div className="flex-1 p-4 flex flex-col space-y-3 overflow-y-auto">
                <div className="flex items-center justify-between bg-[#13141F] border border-white/5 rounded-xl p-3 shrink-0">
                  <div>
                    <h4 className="text-xs font-bold text-white">
                      {participantRole === "student"
                        ? "Candidate Answer Space"
                        : "Candidate's Live Streamed Response"}
                    </h4>
                    <p className="text-[11px] text-zinc-400">
                      {participantRole === "student"
                        ? "Speak using speech-to-text dictation or type your detailed explanation below."
                        : "Watching candidate's verbal and typed response sync in real-time."}
                    </p>
                  </div>

                  {participantRole === "student" && speechSupported && (
                    <button
                      onClick={toggleDictation}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm ${
                        isDictating
                          ? "bg-red-600 text-white animate-pulse"
                          : "bg-purple-600 hover:bg-purple-500 text-white"
                      }`}
                    >
                      <FiMic size={13} />
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
                    className="w-full flex-1 min-h-[300px] bg-[#10111A] border border-white/10 rounded-2xl p-4 text-sm text-white placeholder-zinc-500 outline-none focus:border-purple-500/50 resize-none font-sans leading-relaxed"
                  />

                  {participantRole === "student" && (
                    <div className="mt-2 text-[11px] text-zinc-500 flex items-center justify-between">
                      <span>Live Synced with Trainer Room</span>
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
                <div className="h-44 border-t border-white/10 bg-[#090A0F] flex flex-col shrink-0">
                  <div className="h-8 border-b border-white/5 px-3 flex items-center justify-between bg-[#0E1017]">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCodeTab("output")}
                        className={`text-[11px] font-bold px-2 py-0.5 rounded transition ${
                          codeTab === "output" ? "bg-white/10 text-white" : "text-zinc-500"
                        }`}
                      >
                        Terminal Output
                      </button>
                      <button
                        onClick={() => setCodeTab("stdin")}
                        className={`text-[11px] font-bold px-2 py-0.5 rounded transition ${
                          codeTab === "stdin" ? "bg-white/10 text-white" : "text-zinc-500"
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

                  <div className="flex-1 p-3 overflow-y-auto font-mono text-xs text-zinc-300">
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
                        <span className="text-zinc-600">
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
              <div className="flex-1 p-5 overflow-y-auto space-y-6">
                <div className="bg-[#12131D] border border-purple-500/20 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <FiAward className="text-purple-400" />
                      <span>Live Candidate Evaluation Rubric</span>
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Adjust criteria sliders. Scoring saves directly to the student's unified performance record.
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-zinc-400 block font-semibold">Overall Score</span>
                    <span className="text-2xl font-black text-purple-400">{overallScore}/100</span>
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
                    <div key={crit.key} className="bg-[#11121A] border border-white/5 rounded-xl p-3.5 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-white">{crit.label}</span>
                        <span className="font-mono font-bold text-purple-400">{criteria[crit.key]}/100</span>
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
                        className="w-full accent-purple-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                      />
                      <p className="text-[10px] text-zinc-500">{crit.desc}</p>
                    </div>
                  ))}
                </div>

                {/* Auto Calculate Button */}
                <button
                  type="button"
                  onClick={calculateWeightedScore}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-semibold border border-white/10 transition"
                >
                  Recalculate Weighted Overall Score
                </button>

                {/* Strengths & Weaknesses Tags */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Strengths */}
                  <div className="bg-[#11121A] border border-white/5 rounded-xl p-3.5 space-y-2">
                    <span className="text-xs font-bold text-emerald-400 block">Candidate Strengths</span>
                    <div className="flex flex-wrap gap-1.5">
                      {strengths.map((s, i) => (
                        <span
                          key={i}
                          className="text-[11px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded-md flex items-center gap-1"
                        >
                          {s}
                          <button
                            onClick={() => setStrengths(strengths.filter((_, idx) => idx !== i))}
                            className="hover:text-white"
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
                        placeholder="Add strength tag..."
                        className="flex-1 bg-[#171924] border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white outline-none"
                      />
                      <button
                        type="submit"
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold"
                      >
                        Add
                      </button>
                    </form>
                  </div>

                  {/* Weaknesses */}
                  <div className="bg-[#11121A] border border-white/5 rounded-xl p-3.5 space-y-2">
                    <span className="text-xs font-bold text-amber-400 block">Areas for Improvement</span>
                    <div className="flex flex-wrap gap-1.5">
                      {weaknesses.map((w, i) => (
                        <span
                          key={i}
                          className="text-[11px] bg-amber-500/10 border border-amber-500/30 text-amber-300 px-2 py-0.5 rounded-md flex items-center gap-1"
                        >
                          {w}
                          <button
                            onClick={() => setWeaknesses(weaknesses.filter((_, idx) => idx !== i))}
                            className="hover:text-white"
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
                        placeholder="Add improvement tag..."
                        className="flex-1 bg-[#171924] border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white outline-none"
                      />
                      <button
                        type="submit"
                        className="px-2.5 py-1 rounded-lg bg-amber-600 text-white text-xs font-bold"
                      >
                        Add
                      </button>
                    </form>
                  </div>
                </div>

                {/* Summary Feedback */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-white block">
                    Summary Feedback (Shared with Candidate in Report)
                  </label>
                  <textarea
                    value={summaryFeedback}
                    onChange={(e) => setSummaryFeedback(e.target.value)}
                    placeholder="Provide constructive feedback for the candidate's development..."
                    rows={3}
                    className="w-full bg-[#11121A] border border-white/10 rounded-xl p-3 text-xs text-white placeholder-zinc-500 outline-none focus:border-purple-500/50 resize-none"
                  />
                </div>

                {/* Trainer Private Notes (Strictly Hidden from Student) */}
                <div className="bg-[#14121A] border border-amber-500/20 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                    <FiLock size={12} />
                    <span>Faculty Private Notes (Confidential — Strictly Redacted from Student)</span>
                  </div>
                  <textarea
                    value={trainerPrivateNotes}
                    onChange={(e) => setTrainerPrivateNotes(e.target.value)}
                    placeholder="Confidential notes for academic records / placement cell only..."
                    rows={2}
                    className="w-full bg-[#181520] border border-amber-500/20 rounded-lg p-2.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-amber-500/50 resize-none"
                  />
                </div>

                {/* Finalize Button */}
                <button
                  onClick={handleSubmitEvaluation}
                  disabled={isSubmittingEvaluation}
                  className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-sm font-bold transition flex items-center justify-center gap-2 shadow-xl"
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
                <div className="bg-[#12131D] border border-white/10 rounded-2xl p-5 space-y-3">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <FiHelpCircle className="text-blue-400" />
                    <span>Live Technical Interview Guidelines</span>
                  </h3>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    Welcome to your institutional live interview. Follow these best practices to maximize your performance:
                  </p>

                  <div className="space-y-2 text-xs text-zinc-400 pt-2">
                    <div className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5" />
                      <span>
                        <strong className="text-white">Communicate your thoughts clearly:</strong> Explain your approach before jumping into code.
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5" />
                      <span>
                        <strong className="text-white">Use Voice Dictation or Text:</strong> You can speak to dictate your answers or type them in the Answer space.
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5" />
                      <span>
                        <strong className="text-white">Shared Monaco Editor:</strong> The faculty trainer can see your code updates in real-time. Use the "Run" button to verify output.
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5" />
                      <span>
                        <strong className="text-white">Clarify Requirements:</strong> Feel free to ask the trainer questions if a problem statement is ambiguous.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. SESSION CONCLUSION & REPORT MODAL */}
      {showEndModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-[#10121A] border border-white/10 rounded-3xl p-6 text-white shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center mx-auto text-purple-400">
                <FiCheckCircle size={28} />
              </div>
              <h3 className="text-lg font-black text-white">Live Interview Concluded</h3>
              <p className="text-xs text-zinc-400">
                The session has been finalized and saved into the institutional performance directory.
              </p>
            </div>

            {sessionCompletedReport?.evaluation && (
              <div className="bg-[#171924] border border-white/5 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                  <span className="text-xs text-zinc-400 font-semibold">Overall Evaluation Score</span>
                  <span className="text-xl font-black text-purple-400">
                    {sessionCompletedReport.evaluation.overallScore || overallScore}/100
                  </span>
                </div>

                {sessionCompletedReport.evaluation.summaryFeedback && (
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">
                      Faculty Feedback
                    </span>
                    <p className="text-xs text-zinc-300 bg-black/30 p-2.5 rounded-xl border border-white/5">
                      {sessionCompletedReport.evaluation.summaryFeedback}
                    </p>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => navigate("/dashboard")}
              className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition shadow-lg flex items-center justify-center gap-2"
            >
              <span>Return to Dashboard</span>
              <FiChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default LiveInterviewRoom;
