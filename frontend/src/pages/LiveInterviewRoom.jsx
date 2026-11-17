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
  leaveLiveRoomApi,
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

  // Synchronized Call-Ended Overlay State
  const [callEndedState, setCallEndedState] = useState({
    active: false,
    leftByName: "",
    leftByRole: "",
    reason: "",
    countdown: 3,
  });

  const triggerCallEnded = ({ leftByName, leftByRole, reason, isLocal }) => {
    if (isLocal && socketRef.current && room?._id) {
      socketRef.current.emit("workspace:peer-left", {
        liveId: room._id,
        leftByName: leftByName || user?.name || (participantRole === "trainer" ? "Faculty Trainer" : "Candidate Student"),
        leftByRole: leftByRole || participantRole,
        reason: reason || "left",
      });
      if (room?._id) {
        leaveLiveRoomApi(room._id).catch(() => {});
      }
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (_) {}
      });
    }

    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch (_) {}
    }

    setCallEndedState({
      active: true,
      leftByName: leftByName || (participantRole === "trainer" ? "Candidate Student" : "Faculty Trainer"),
      leftByRole: leftByRole || "participant",
      reason: reason || "ended",
      countdown: 3,
    });
  };

  // Countdown timer for automatic redirect to dashboard
  useEffect(() => {
    if (!callEndedState.active) return;
    const interval = setInterval(() => {
      setCallEndedState((prev) => {
        if (prev.countdown <= 1) {
          clearInterval(interval);
          navigate("/dashboard", { replace: true });
          return { ...prev, countdown: 0 };
        }
        return { ...prev, countdown: prev.countdown - 1 };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [callEndedState.active, navigate]);

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
      triggerCallEnded({
        leftByName: report?.evaluation?.evaluatedBy || "Technical Trainer",
        leftByRole: "trainer",
        reason: "concluded",
        isLocal: false,
      });
    });

    // Workspace: Participant left the room / concluded session
    socket.on("workspace:peer-left", ({ leftByName, leftByRole, reason }) => {
      triggerCallEnded({
        leftByName,
        leftByRole,
        reason,
        isLocal: false,
      });
    });

    // Peer disconnected
    socket.on("user:left", (data) => {
      setPeerConnected(false);
      triggerCallEnded({
        leftByName: data?.userName || (participantRole === "trainer" ? "Candidate Student" : "Faculty Trainer"),
        leftByRole: data?.role || "participant",
        reason: "left",
        isLocal: false,
      });
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
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center text-gray-900 px-4">
        <div className="w-12 h-12 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin mb-4" />
        <h2 className="text-lg font-black text-gray-900 tracking-wide">Connecting to Live Interview Studio...</h2>
        <p className="text-xs text-gray-500 mt-1">Establishing encrypted WebRTC & Socket signaling channels</p>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center text-gray-900 px-4">
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-3xl p-8 text-center shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-4 text-red-600">
            <FiAlertCircle size={26} />
          </div>
          <h3 className="text-base font-black text-gray-900">Live Room Access Error</h3>
          <p className="text-xs text-gray-600 mt-2 leading-relaxed">{error}</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-bold transition shadow-sm cursor-pointer"
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
    <div className="min-h-screen bg-[#F8F9FA] text-gray-900 flex flex-col font-sans select-none overflow-hidden relative">
      {/* 0. CALL-ENDED OVERLAY & COUNTDOWN REDIRECT */}
      {callEndedState.active && (
        <div className="fixed inset-0 z-[100] bg-gray-900/60 backdrop-blur-md flex flex-col items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-gray-200 rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-5 text-red-600 shadow-xs">
              <FiPhoneOff size={28} />
            </div>

            <h2 className="text-xl font-black text-gray-900 tracking-tight mb-2">
              Interview Call Ended
            </h2>

            <p className="text-xs text-gray-600 max-w-sm mx-auto leading-relaxed mb-6">
              {callEndedState.reason === "concluded"
                ? `${callEndedState.leftByName} has evaluated and concluded this live session.`
                : `${callEndedState.leftByName} has left the live interview room.`}
            </p>

            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden mb-3 border border-gray-200">
              <div
                className="h-full bg-gray-900 transition-all duration-1000 ease-linear rounded-full"
                style={{ width: `${(callEndedState.countdown / 3) * 100}%` }}
              />
            </div>

            <p className="text-[11px] text-gray-500 font-semibold mb-6">
              Redirecting to Dashboard in {callEndedState.countdown}s...
            </p>

            <button
              onClick={() => navigate("/dashboard", { replace: true })}
              className="w-full py-3.5 px-4 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-black transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <FiArrowLeft size={14} />
              <span>Return to Dashboard Now</span>
            </button>
          </div>
        </div>
      )}

      {/* 1. STUDIO HEADER */}
      <header className="h-16 border-b border-gray-200 bg-white/95 backdrop-blur-md px-5 flex items-center justify-between shrink-0 z-30 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (window.confirm("Are you sure you want to conclude and exit the live interview room?")) {
                triggerCallEnded({
                  leftByName: user?.name || (participantRole === "trainer" ? "Faculty Trainer" : "Candidate Student"),
                  leftByRole: participantRole,
                  reason: "left",
                  isLocal: true,
                });
              }
            }}
            className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 transition cursor-pointer"
            title="Exit Room"
          >
            <FiArrowLeft size={16} />
          </button>

          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
            </span>
            <h1 className="text-sm font-black text-gray-900 tracking-wide flex items-center gap-2">
              <span>YUGAM LIVE STUDIO</span>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-gray-900 text-white uppercase shadow-xs">
                {scheduled?.role || "Technical Interview"}
              </span>
            </h1>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs text-gray-700 bg-gray-100 px-3 py-1.5 rounded-full border border-gray-200 shadow-xs">
            <FiClock size={13} className="text-gray-500" />
            <span className="font-mono font-bold">{formatTime(elapsedSeconds)}</span>
          </div>
        </div>

        {/* Right Header Status & Controls */}
        <div className="flex items-center gap-2.5">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${
              peerConnected
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                peerConnected ? "bg-emerald-500" : "bg-amber-500 animate-pulse"
              }`}
            />
            <span className="text-[11px]">
              {peerConnected ? `Peer: ${peerInfo.userName || "Connected"}` : "Waiting for Peer..."}
            </span>
          </div>

          <span
            className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl border ${
              participantRole === "trainer"
                ? "bg-purple-50 text-purple-700 border-purple-200"
                : "bg-blue-50 text-blue-700 border-blue-200"
            }`}
          >
            {participantRole === "trainer" ? "👨‍🏫 FACULTY TRAINER" : "🎓 CANDIDATE STUDENT"}
          </span>

          {participantRole === "trainer" && (
            <button
              onClick={() => {
                calculateWeightedScore();
                setActiveTab("rubric");
              }}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <FiSliders size={13} />
              <span>Evaluate & Conclude</span>
            </button>
          )}

          <button
            onClick={() => {
              if (window.confirm("Disconnect and conclude this live session?")) {
                triggerCallEnded({
                  leftByName: user?.name || (participantRole === "trainer" ? "Faculty Trainer" : "Candidate Student"),
                  leftByRole: participantRole,
                  reason: "left",
                  isLocal: true,
                });
              }
            }}
            className="px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-200 hover:border-red-600 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Leave Room"
          >
            <FiPhoneOff size={13} />
            <span className="hidden sm:inline">Leave Room</span>
          </button>
        </div>
      </header>

      {/* 2. SPLIT-SCREEN MAIN STUDIO WORKSPACE */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-[#F8F9FA]">
        {/* LEFT PANEL: Dual Video Tiles + Active Question (42% width on lg) */}
        <div className="w-full lg:w-[42%] border-r border-gray-200 flex flex-col bg-white overflow-hidden shadow-xs">
          {/* A. DUAL WEBRTC VIDEO TILES */}
          <div className="p-4 grid grid-cols-2 gap-3 bg-gray-50 border-b border-gray-200 shrink-0">
            {/* Local Video Tile */}
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-[#111318] border border-gray-200 flex items-center justify-center shadow-md group">
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
                  <FiVideoOff size={28} className="mb-1 text-zinc-400" />
                  <span className="text-[10px] uppercase font-bold text-zinc-400">Camera Off</span>
                </div>
              )}
              <div className="absolute top-2.5 left-2.5 bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[10px] font-bold text-white flex items-center gap-1.5 border border-white/10">
                <FiUser size={11} className="text-zinc-300" />
                <span>You ({participantRole === "trainer" ? "Trainer" : "Student"})</span>
              </div>
              <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-lg text-[10px] text-zinc-300 border border-white/10">
                {isMicOn ? <FiMic size={12} className="text-emerald-400" /> : <FiMicOff size={12} className="text-red-400" />}
              </div>
            </div>

            {/* Remote Peer Video Tile */}
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-[#111318] border border-gray-200 flex items-center justify-center shadow-md">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className={`w-full h-full object-cover ${
                  peerConnected && remoteStream ? "block" : "hidden"
                }`}
              />
              {(!peerConnected || !remoteStream) && (
                <div className="flex flex-col items-center justify-center text-zinc-400 p-2 text-center">
                  <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center mb-1.5 animate-pulse">
                    <FiUser size={15} className="text-white" />
                  </div>
                  <span className="text-[11px] font-bold text-zinc-200">
                    {participantRole === "trainer" ? "Waiting for Student" : "Waiting for Trainer"}
                  </span>
                  <span className="text-[9px] text-zinc-400 mt-0.5">Connecting peer WebRTC...</span>
                </div>
              )}
              <div className="absolute top-2.5 left-2.5 bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[10px] font-bold text-white flex items-center gap-1.5 border border-white/10">
                <span className={`w-1.5 h-1.5 rounded-full ${peerConnected ? "bg-emerald-400" : "bg-amber-400 animate-pulse"}`} />
                <span>
                  {peerInfo.userName || (participantRole === "trainer" ? scheduled?.studentName || "Candidate" : scheduled?.trainerName || "Faculty")}
                </span>
              </div>
            </div>
          </div>

          {/* Media Control Toolbar */}
          <div className="px-4 py-2.5 bg-white border-b border-gray-200 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMic}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  isMicOn
                    ? "bg-gray-100 hover:bg-gray-200 text-gray-900 border border-gray-200"
                    : "bg-red-50 hover:bg-red-100 text-red-600 border border-red-200"
                }`}
                title={isMicOn ? "Mute Microphone" : "Unmute Microphone"}
              >
                {isMicOn ? <FiMic size={14} className="text-emerald-600" /> : <FiMicOff size={14} />}
                <span className="text-[11px]">{isMicOn ? "Mic On" : "Muted"}</span>
              </button>

              <button
                onClick={toggleCamera}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  isCameraOn
                    ? "bg-gray-100 hover:bg-gray-200 text-gray-900 border border-gray-200"
                    : "bg-red-50 hover:bg-red-100 text-red-600 border border-red-200"
                }`}
                title={isCameraOn ? "Turn Camera Off" : "Turn Camera On"}
              >
                {isCameraOn ? <FiVideo size={14} className="text-blue-600" /> : <FiVideoOff size={14} />}
                <span className="text-[11px]">{isCameraOn ? "Camera On" : "Camera Off"}</span>
              </button>
            </div>

            <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">
              🔒 P2P Encrypted Stream
            </span>
          </div>

          {/* B. ACTIVE QUESTION DISPLAY & SELECTOR */}
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

        {/* RIGHT PANEL: Tabbed Workspace (Answer / Synced Monaco / Rubric) (58% width) */}
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
                  {LANG_OPTIONS.map((lang) => (
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
                      <span className="w-2 h-2 rounded-full bg-blue-500 mt-1 shrink-0" />
                      <span>
                        <strong className="text-gray-900">Use Voice Dictation or Text:</strong> You can speak to dictate your answers or type them in the Answer space.
                      </span>
                    </div>
                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-100">
                      <span className="w-2 h-2 rounded-full bg-blue-500 mt-1 shrink-0" />
                      <span>
                        <strong className="text-gray-900">Shared Monaco Editor:</strong> The faculty trainer can see your code updates in real-time. Use the "Run" button to verify output.
                      </span>
                    </div>
                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-100">
                      <span className="w-2 h-2 rounded-full bg-blue-500 mt-1 shrink-0" />
                      <span>
                        <strong className="text-gray-900">Clarify Requirements:</strong> Feel free to ask the trainer questions if a problem statement is ambiguous.
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
        <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white border border-gray-200 rounded-3xl p-7 text-gray-900 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-600 shadow-xs">
                <FiCheckCircle size={28} />
              </div>
              <h3 className="text-lg font-black text-gray-900">Live Interview Concluded</h3>
              <p className="text-xs text-gray-500">
                The session has been finalized and saved into the institutional performance directory.
              </p>
            </div>

            {sessionCompletedReport?.evaluation && (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-gray-200 pb-2.5">
                  <span className="text-xs text-gray-600 font-semibold">Overall Evaluation Score</span>
                  <span className="text-2xl font-black text-emerald-600">
                    {sessionCompletedReport.evaluation.overallScore || overallScore}/100
                  </span>
                </div>

                {sessionCompletedReport.evaluation.summaryFeedback && (
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase font-bold block mb-1">
                      Faculty Feedback
                    </span>
                    <p className="text-xs text-gray-700 bg-white p-3 rounded-xl border border-gray-200 shadow-2xs">
                      {sessionCompletedReport.evaluation.summaryFeedback}
                    </p>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => navigate("/dashboard")}
              className="w-full py-3.5 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-black transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
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
