import { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import { leaveLiveRoomApi } from "../apis/interview.api";
import { getIceServers } from "./useWebRTC";

export function useRoomSocket({
  roomId,
  participantRole,
  userName,
  pcRef,
  streamRef,
  onRemoteStream,
  onPeerConnected,
  onQuestionPushed,
  onActiveQuestionSwitched,
  onAnswerUpdated,
  onCodeUpdated,
  onCodeOutput,
  onSessionEnded,
  onCallEnded,
} = {}) {
  const [peerInfo, setPeerInfo] = useState({ userName: "", role: "" });
  const [isPeerInRoom, setIsPeerInRoom] = useState(false);
  const [participants, setParticipants] = useState([]);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!roomId) return;

    const socketUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:6000";
    const socket = io(socketUrl, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    // Initialize RTCPeerConnection with configurable STUN/TURN servers (P2-03)
    let pc = pcRef?.current;
    if (!pc) {
      pc = new RTCPeerConnection(getIceServers());
      if (pcRef) {
        pcRef.current = pc;
      }
    }

    // Attach local stream tracks to RTCPeerConnection if available
    if (pc && streamRef?.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          pc.addTrack(track, streamRef.current);
        } catch (_) {}
      });
    }

    if (pc) {
      // Handle remote media track arrival
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          if (onRemoteStream) onRemoteStream(event.streams[0]);
          if (onPeerConnected) onPeerConnected(true);
        }
      };

      // Handle ICE Candidate generation
      pc.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          socketRef.current.emit("webrtc:ice-candidate", {
            liveId: roomId,
            candidate: event.candidate,
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          if (onPeerConnected) onPeerConnected(true);
        } else if (
          pc.connectionState === "disconnected" ||
          pc.connectionState === "failed" ||
          pc.connectionState === "closed"
        ) {
          if (onPeerConnected) onPeerConnected(false);
        }
      };
    }

    // Join room upon socket connect
    socket.on("connect", () => {
      socket.emit("room:join", {
        liveId: roomId,
        role: participantRole,
        userName: userName || (participantRole === "trainer" ? "Trainer" : "Student"),
      });
    });

    // Authoritative room presence update from Socket.IO server
    const handlePresence = (presence) => {
      if (!presence) return;
      const list = Array.isArray(presence.participants) ? presence.participants : [];
      setParticipants(list);

      const myId = socket.id;
      const otherPeers = list.filter((p) => p.socketId !== myId);

      if (otherPeers.length > 0) {
        setIsPeerInRoom(true);
        const activePeer = otherPeers[0];
        setPeerInfo((prev) => ({
          userName: activePeer.userName || activePeer.name || prev.userName,
          role: activePeer.role || prev.role,
        }));
      } else {
        setIsPeerInRoom(false);
      }
    };

    socket.on("room:presence", handlePresence);
    socket.on("room:participants", handlePresence);

    // When another peer joins the room
    socket.on("user:joined", async (peer) => {
      setIsPeerInRoom(true);
      setPeerInfo({ userName: peer.userName, role: peer.role });

      // Faculty Trainer initiates the WebRTC offer
      if (participantRole === "trainer" && pcRef?.current) {
        try {
          const offer = await pcRef.current.createOffer();
          await pcRef.current.setLocalDescription(offer);
          socket.emit("webrtc:offer", {
            liveId: roomId,
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
        setIsPeerInRoom(true);
        setPeerInfo({ userName: peers[0].userName, role: peers[0].role });
      }
    });

    // Incoming WebRTC Offer
    socket.on("webrtc:offer", async ({ senderSocketId, sdp }) => {
      if (!pcRef?.current) return;
      try {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        socket.emit("webrtc:answer", {
          liveId: roomId,
          targetSocketId: senderSocketId,
          sdp: answer,
        });
      } catch (e) {
        console.error("Error handling WebRTC offer:", e);
      }
    });

    // Incoming WebRTC Answer
    socket.on("webrtc:answer", async ({ sdp }) => {
      if (!pcRef?.current) return;
      try {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
      } catch (e) {
        console.error("Error handling WebRTC answer:", e);
      }
    });

    // Incoming ICE Candidate
    socket.on("webrtc:ice-candidate", async ({ candidate }) => {
      if (!pcRef?.current) return;
      try {
        if (candidate) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (e) {
        console.error("Error adding ICE candidate:", e);
      }
    });

    // Workspace: Question pushed
    socket.on("workspace:question-pushed", (data) => {
      if (onQuestionPushed) onQuestionPushed(data);
    });

    // Workspace: Question switched
    socket.on("workspace:active-question-switched", (data) => {
      if (onActiveQuestionSwitched) onActiveQuestionSwitched(data);
    });

    // Workspace: Live answer update
    socket.on("workspace:answer-updated", (data) => {
      if (onAnswerUpdated) onAnswerUpdated(data);
    });

    // Workspace: Code update
    socket.on("workspace:code-updated", (data) => {
      if (onCodeUpdated) onCodeUpdated(data);
    });

    // Workspace: Code output
    socket.on("workspace:code-output", (data) => {
      if (onCodeOutput) onCodeOutput(data);
    });

    // Workspace: Session concluded by trainer
    socket.on("workspace:session-ended", ({ report }) => {
      if (onSessionEnded) onSessionEnded(report);
      if (onCallEnded) {
        onCallEnded({
          leftByName: report?.evaluation?.evaluatedBy || "Technical Trainer",
          leftByRole: "trainer",
          reason: "concluded",
          isLocal: false,
        });
      }
    });

    // Workspace: Participant left the room
    socket.on("workspace:peer-left", ({ leftByName, leftByRole, reason }) => {
      if (onCallEnded) {
        onCallEnded({
          leftByName,
          leftByRole,
          reason,
          isLocal: false,
        });
      }
    });

    // Peer disconnected
    socket.on("user:left", (data) => {
      setIsPeerInRoom(false);
      if (onPeerConnected) onPeerConnected(false);
      if (onCallEnded) {
        onCallEnded({
          leftByName:
            data?.userName || (participantRole === "trainer" ? "Candidate Student" : "Faculty Trainer"),
          leftByRole: data?.role || "participant",
          reason: "left",
          isLocal: false,
        });
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [roomId, participantRole, userName]);

  // Emitters
  const pushQuestion = useCallback(
    (questionText, difficulty = "medium") => {
      if (!socketRef.current || !roomId || !questionText.trim()) return;
      socketRef.current.emit("workspace:question-push", {
        liveId: roomId,
        questionText: questionText.trim(),
        difficulty,
      });
    },
    [roomId]
  );

  const switchActiveQuestion = useCallback(
    (questionIndex) => {
      if (!socketRef.current || !roomId) return;
      socketRef.current.emit("workspace:active-question", {
        liveId: roomId,
        questionIndex,
      });
    },
    [roomId]
  );

  const updateAnswer = useCallback(
    (questionIndex, answerText) => {
      if (!socketRef.current || !roomId) return;
      socketRef.current.emit("workspace:answer-update", {
        liveId: roomId,
        questionIndex,
        answerText,
      });
    },
    [roomId]
  );

  const updateCode = useCallback(
    (codeText, codeLanguage) => {
      if (!socketRef.current || !roomId) return;
      socketRef.current.emit("workspace:code-update", {
        liveId: roomId,
        code: codeText,
        language: codeLanguage,
      });
    },
    [roomId]
  );

  const notifySessionEnded = useCallback(
    (report) => {
      if (!socketRef.current || !roomId) return;
      socketRef.current.emit("workspace:session-ended", {
        liveId: roomId,
        report,
      });
    },
    [roomId]
  );

  const leaveRoom = useCallback(
    (reason = "left") => {
      if (socketRef.current && roomId) {
        socketRef.current.emit("workspace:peer-left", {
          liveId: roomId,
          leftByName: userName || (participantRole === "trainer" ? "Faculty Trainer" : "Candidate Student"),
          leftByRole: participantRole,
          reason,
        });
      }
      if (roomId) {
        leaveLiveRoomApi(roomId).catch(() => {});
      }
    },
    [roomId, participantRole, userName]
  );

  return {
    socketRef,
    peerInfo,
    setPeerInfo,
    isPeerInRoom,
    participants,
    pushQuestion,
    switchActiveQuestion,
    updateAnswer,
    updateCode,
    notifySessionEnded,
    leaveRoom,
  };
}
