import React from "react";
import {
  FiMic,
  FiMicOff,
  FiVideo,
  FiVideoOff,
  FiUser,
} from "react-icons/fi";

export default function LiveVideoPanel({
  localVideoRef,
  remoteVideoRef,
  localStream,
  remoteStream,
  isCameraOn,
  isMicOn,
  peerConnected,
  peerInfo,
  participantRole,
  scheduled,
  toggleMic,
  toggleCamera,
}) {
  return (
    <div className="flex flex-col shrink-0">
      {/* Dual Video Stream Tiles */}
      <div className="p-4 grid grid-cols-2 gap-3 bg-white border-b border-gray-200">
        {/* Local Stream Video Tile */}
        <div className="relative aspect-video rounded-2xl overflow-hidden bg-[#111318] border border-gray-200 flex items-center justify-center shadow-md">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className={`w-full h-full object-cover scale-x-[-1] ${
              isCameraOn ? "block" : "hidden"
            }`}
          />
          {!isCameraOn && (
            <div className="flex flex-col items-center justify-center text-zinc-400">
              <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center mb-1">
                <FiUser size={18} className="text-zinc-200" />
              </div>
              <span className="text-[11px] font-bold text-zinc-300">Camera Off</span>
            </div>
          )}
          <div className="absolute top-2.5 left-2.5 bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[10px] font-bold text-white flex items-center gap-1.5 border border-white/10">
            <FiUser size={11} className="text-zinc-300" />
            <span>You ({participantRole === "trainer" ? "Trainer" : "Student"})</span>
          </div>
          <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-lg text-[10px] text-zinc-300 border border-white/10">
            {isMicOn ? (
              <FiMic size={12} className="text-emerald-400" />
            ) : (
              <FiMicOff size={12} className="text-red-400" />
            )}
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
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                peerConnected ? "bg-emerald-400" : "bg-amber-400 animate-pulse"
              }`}
            />
            <span>
              {peerInfo?.userName ||
                (participantRole === "trainer"
                  ? scheduled?.studentName || "Candidate"
                  : scheduled?.trainerName || "Faculty")}
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
    </div>
  );
}
