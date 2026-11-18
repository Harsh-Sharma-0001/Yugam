import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  FiPhoneOff,
  FiClock,
  FiArrowLeft,
  FiSliders,
} from "react-icons/fi";
import {
  joinLiveRoom,
  completeLiveRoom,
} from "../apis/interview.api";

// Modularized Custom Hooks & Components
import { useWebRTC } from "../hooks/useWebRTC";
import { useCodeExecution, DEFAULT_CODE_BY_LANG, LANG_OPTIONS } from "../hooks/useCodeExecution";
import { useRoomSocket } from "../hooks/useRoomSocket";
import LiveVideoPanel from "../components/live/LiveVideoPanel";
import QuestionWorkspace from "../components/live/QuestionWorkspace";
import TrainerEvaluation from "../components/live/TrainerEvaluation";

function LiveInterviewRoom({ user }) {
  const { scheduleId } = useParams();
  const navigate = useNavigate();

  // Initialization State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [room, setRoom] = useState(null);
  const [scheduled, setScheduled] = useState(null);
  const [participantRole, setParticipantRole] = useState("student"); // "trainer" | "student"

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

  // 1. WebRTC Media Stream Management
  const {
    localStream,
    remoteStream,
    setRemoteStream,
    isCameraOn,
    isMicOn,
    peerConnected,
    setPeerConnected,
    localVideoRef,
    remoteVideoRef,
    pcRef,
    streamRef,
    toggleCamera,
    toggleMic,
    cleanupMedia,
  } = useWebRTC();

  // Call Ended Trigger
  const triggerCallEnded = useCallback(
    ({ leftByName, leftByRole, reason, isLocal } = {}) => {
      if (isLocal && socketRef?.current && room?._id) {
        socketRef.current.emit("workspace:peer-left", {
          liveId: room._id,
          leftByName: leftByName || user?.name || (participantRole === "trainer" ? "Faculty Trainer" : "Candidate Student"),
          leftByRole: leftByRole || participantRole,
          reason: reason || "left",
        });
      }

      cleanupMedia();

      setCallEndedState({
        active: true,
        leftByName: leftByName || (participantRole === "trainer" ? "Candidate Student" : "Faculty Trainer"),
        leftByRole: leftByRole || "participant",
        reason: reason || "ended",
        countdown: 3,
      });
    },
    [cleanupMedia, participantRole, room?._id, user?.name]
  );

  // 2. Code Execution Hook
  const {
    language,
    code,
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
    setCode,
    setLanguage,
  } = useCodeExecution({
    onCodeBroadcast: (newCode, newLang) => {
      if (socketRef?.current && room?._id) {
        socketRef.current.emit("workspace:code-update", {
          liveId: room._id,
          code: newCode,
          language: newLang,
        });
      }
    },
  });

  // 3. Socket.IO Signaling & Workspace State Synchronization
  const {
    socketRef,
    peerInfo,
    pushQuestion,
    switchActiveQuestion,
    updateAnswer,
  } = useRoomSocket({
    roomId: room?._id,
    participantRole,
    userName: user?.name,
    pcRef,
    streamRef,
    onRemoteStream: setRemoteStream,
    onPeerConnected: setPeerConnected,
    onQuestionPushed: ({ questions: updatedQuestions, activeQuestionIndex: newIdx }) => {
      setQuestions(updatedQuestions);
      setActiveQuestionIndex(newIdx);
      const curQ = updatedQuestions[newIdx];
      setStudentAnswer(curQ?.studentAnswer || "");
    },
    onActiveQuestionSwitched: ({ questionIndex }) => {
      setActiveQuestionIndex(questionIndex);
      setQuestions((prev) => {
        const curQ = prev[questionIndex];
        if (curQ) setStudentAnswer(curQ.studentAnswer || "");
        return prev;
      });
    },
    onAnswerUpdated: ({ questionIndex, answerText }) => {
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
    },
    onCodeUpdated: ({ code: remoteCode, language: remoteLang }) => {
      setCode(remoteCode);
      if (remoteLang) setLanguage(remoteLang);
    },
    onCodeOutput: ({ output, status }) => {
      setCodeOutput({
        stdout: output,
        status: status || { description: "Executed" },
      });
    },
    onSessionEnded: (report) => {
      setSessionCompletedReport(report || {});
      setShowEndModal(true);
    },
    onCallEnded: triggerCallEnded,
  });

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

  // 4. Initialize Room Session via REST
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
  }, [scheduleId, setCode, setLanguage]);

  // Speech-to-Text Dictation
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
          updateAnswer(activeQuestionIndex, updated);
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

  // Student Typed Answer Change
  const handleAnswerChange = (val) => {
    setStudentAnswer(val);
    updateAnswer(activeQuestionIndex, val);
  };

  // Trainer Pushing New Question
  const handlePushQuestion = () => {
    if (!newQuestionText.trim()) return;
    setIsPushingQuestion(true);
    pushQuestion(newQuestionText.trim(), newQuestionDifficulty);
    setNewQuestionText("");
    setIsPushingQuestion(false);
  };

  // Switch Active Question
  const switchQuestion = (index) => {
    setActiveQuestionIndex(index);
    if (questions[index]) {
      setStudentAnswer(questions[index].studentAnswer || "");
    }
    switchActiveQuestion(index);
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
      if (speechRecognitionRef.current) speechRecognitionRef.current.stop();
      cleanupMedia();
    };
  }, [cleanupMedia]);

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center text-gray-900 px-4">
        <div className="w-12 h-12 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin mb-4" />
        <h2 className="text-base font-black tracking-tight text-gray-900">
          Entering Yugam Live Studio...
        </h2>
        <p className="text-xs text-gray-500 mt-1">Verifying room credentials and setting up WebRTC...</p>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-3xl p-8 text-center shadow-xl space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto text-red-600 shadow-xs">
            <FiPhoneOff size={24} />
          </div>
          <h2 className="text-lg font-black text-gray-900">Live Room Access Error</h2>
          <p className="text-xs text-gray-600 leading-relaxed">{error}</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="w-full py-3 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-black transition shadow-md cursor-pointer"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

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
            <FiPhoneOff size={14} />
            <span className="hidden sm:inline">Leave Room</span>
          </button>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE CANVAS */}
      <QuestionWorkspace
        videoPanel={
          <LiveVideoPanel
            localVideoRef={localVideoRef}
            remoteVideoRef={remoteVideoRef}
            localStream={localStream}
            remoteStream={remoteStream}
            isCameraOn={isCameraOn}
            isMicOn={isMicOn}
            peerConnected={peerConnected}
            peerInfo={peerInfo}
            participantRole={participantRole}
            scheduled={scheduled}
            toggleMic={toggleMic}
            toggleCamera={toggleCamera}
          />
        }
        questions={questions}
        activeQuestionIndex={activeQuestionIndex}
        switchQuestion={switchQuestion}
        participantRole={participantRole}
        newQuestionText={newQuestionText}
        setNewQuestionText={setNewQuestionText}
        newQuestionDifficulty={newQuestionDifficulty}
        setNewQuestionDifficulty={setNewQuestionDifficulty}
        isPushingQuestion={isPushingQuestion}
        handlePushQuestion={handlePushQuestion}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        studentAnswer={studentAnswer}
        handleAnswerChange={handleAnswerChange}
        isDictating={isDictating}
        toggleDictation={toggleDictation}
        speechSupported={speechSupported}
        language={language}
        code={code}
        stdin={stdin}
        setStdin={setStdin}
        codeTab={codeTab}
        setCodeTab={setCodeTab}
        isRunningCode={isRunningCode}
        codeOutput={codeOutput}
        handleLanguageChange={handleLanguageChange}
        handleCodeChange={handleCodeChange}
        handleRunCode={() => handleRunCode({ socket: socketRef.current, roomId: room?._id })}
        langOptions={LANG_OPTIONS}
        criteria={criteria}
        setCriteria={setCriteria}
        overallScore={overallScore}
        calculateWeightedScore={calculateWeightedScore}
        strengths={strengths}
        setStrengths={setStrengths}
        newStrengthInput={newStrengthInput}
        setNewStrengthInput={setNewStrengthInput}
        handleAddStrength={handleAddStrength}
        weaknesses={weaknesses}
        setWeaknesses={setWeaknesses}
        newWeaknessInput={newWeaknessInput}
        setNewWeaknessInput={setNewWeaknessInput}
        handleAddWeakness={handleAddWeakness}
        summaryFeedback={summaryFeedback}
        setSummaryFeedback={setSummaryFeedback}
        trainerPrivateNotes={trainerPrivateNotes}
        setTrainerPrivateNotes={setTrainerPrivateNotes}
        handleSubmitEvaluation={handleSubmitEvaluation}
        isSubmittingEvaluation={isSubmittingEvaluation}
      />

      {/* 3. SESSION CONCLUSION & REPORT MODAL */}
      <TrainerEvaluation
        showEndModal={showEndModal}
        sessionCompletedReport={sessionCompletedReport}
        overallScore={overallScore}
        onReturnToDashboard={() => navigate("/dashboard")}
      />
    </div>
  );
}

export default LiveInterviewRoom;
