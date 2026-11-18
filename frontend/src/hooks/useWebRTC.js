import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Resolves STUN/TURN ICE servers configuration.
 * Reads VITE_ICE_SERVERS_JSON from environment if available (for restrictive college NAT/firewalls),
 * falling back to Google public STUN servers.
 */
export const getIceServers = () => {
  try {
    const envIce = import.meta.env.VITE_ICE_SERVERS_JSON;
    if (envIce) {
      const parsed = typeof envIce === "string" ? JSON.parse(envIce) : envIce;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return { iceServers: parsed };
      }
    }
  } catch (err) {
    console.warn("Failed to parse VITE_ICE_SERVERS_JSON, falling back to default STUN:", err);
  }

  return {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  };
};

export function useWebRTC() {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [peerConnected, setPeerConnected] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const streamRef = useRef(null);

  // Setup local media stream with camera + mic, falling back to audio-only if needed
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

          if (localVideoRef.current) {
            localVideoRef.current.srcObject = audioOnly;
          }
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

  // Sync video elements when stream states update
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Toggle Camera
  const toggleCamera = useCallback(() => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOn(videoTrack.enabled);
      }
    }
  }, []);

  // Toggle Microphone
  const toggleMic = useCallback(() => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
      }
    }
  }, []);

  // Stop tracks and close peer connection
  const cleanupMedia = useCallback(() => {
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
    setLocalStream(null);
    setRemoteStream(null);
    setPeerConnected(false);
  }, []);

  return {
    localStream,
    remoteStream,
    setRemoteStream,
    isCameraOn,
    setIsCameraOn,
    isMicOn,
    setIsMicOn,
    peerConnected,
    setPeerConnected,
    localVideoRef,
    remoteVideoRef,
    pcRef,
    streamRef,
    toggleCamera,
    toggleMic,
    cleanupMedia,
  };
}
