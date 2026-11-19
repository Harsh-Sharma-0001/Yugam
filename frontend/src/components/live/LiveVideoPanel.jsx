import React from "react";
import {
  FiMic,
  FiMicOff,
  FiVideo,
  FiVideoOff,
  FiUser,
  FiRefreshCw,
  FiLock,
} from "react-icons/fi";

export default function LiveVideoPanel({
  localVideoRef,
  remoteVideoRef,
  localStream,
  remoteStream,
  isCameraOn,
  isMicOn,
  peerConnected,
  isPeerConnected,
  isPeerInRoom,
  peerInfo,
  participantRole,
  scheduled,
  toggleMic,
  toggleCamera,
}) {
  const isPeerOnline = Boolean(peerConnected || isPeerConnected || isPeerInRoom);
  const peerName =
    peerInfo?.userName ||
    (participantRole === "trainer"
      ? scheduled?.studentName || "Candidate Student"
      : scheduled?.trainerName || "Faculty Trainer");

  return (
    <div className="flex flex-col shrink-0 p-4 bg-white border-b border-gray-200">
      {/* Dual Obsidian Video Stage */}
      <div className="bg-[#111318] border border-white/10 rounded-2xl p-3 shadow-md flex flex-col gap-3">
        {/* Video Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Local Stream Video Tile */}
          <div className="relative aspect-video rounded-xl overflow-hidden bg-[#161822] border border-white/10 flex items-center justify-center shadow-inner group">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-300 ${
                isCameraOn && localStream ? "opacity-100 block" : "opacity-0 hidden"
              }`}
            />
            {(!isCameraOn || !localStream) && (
              <div className="flex flex-col items-center justify-center text-zinc-400 p-2">
                <div className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-1.5 shadow-sm">
                  <FiUser size={20} className="text-zinc-200" />
                </div>
                <span className="text-[11px] font-bold text-zinc-300">Camera Off</span>
                <span className="text-[9px] text-zinc-500 mt-0.5">Local Preview Inactive</span>
              </div>
            )}

            {/* Local Nameplate */}
            <div className="absolute top-2.5 left-2.5 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-bold text-white flex items-center gap-1.5 border border-white/10 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              <span>You ({participantRole === "trainer" ? "Trainer" : "Student"})</span>
            </div>

            {/* Mic Status Indicator */}
            <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 bg-black/75 backdrop-blur-md px-2 py-1 rounded-lg text-[10px] border border-white/10 shadow-xs">
              {isMicOn ? (
                <FiMic size={12} className="text-emerald-400" />
              ) : (
                <FiMicOff size={12} className="text-red-400" />
              )}
              <span className={`text-[9px] font-bold ${isMicOn ? "text-emerald-400" : "text-red-400"}`}>
                {isMicOn ? "LIVE" : "MUTED"}
              </span>
            </div>
          </div>

          {/* Remote Peer Video Tile */}
          <div className="relative aspect-video rounded-xl overflow-hidden bg-[#161822] border border-white/10 flex items-center justify-center shadow-inner group">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                isPeerOnline && remoteStream ? "opacity-100 block" : "opacity-0 hidden"
              }`}
            />

            {/* Case 1: Peer is connected, but camera stream is shared or inactive (Single PC / camera off) */}
            {isPeerOnline && !remoteStream && (
              <div className="flex flex-col items-center justify-center text-zinc-300 p-3 text-center">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-1.5 shadow-xs">
                  <FiUser size={20} className="text-emerald-400" />
                </div>
                <span className="text-xs font-bold text-white truncate max-w-[140px]">
                  {peerName}
                </span>
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-semibold mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Connected via Live Room</span>
                </div>
                <span className="text-[9px] text-zinc-400 mt-0.5">Audio / Workspace Synced</span>
              </div>
            )}

            {/* Case 2: Peer is not in the room yet */}
            {!isPeerOnline && (
              <div className="flex flex-col items-center justify-center text-zinc-400 p-3 text-center">
                <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-1.5 animate-pulse shadow-sm">
                  <FiUser size={18} className="text-zinc-300" />
                </div>
                <span className="text-xs font-bold text-zinc-200">
                  {participantRole === "trainer" ? "Waiting for Student" : "Waiting for Trainer"}
                </span>
                <span className="text-[9px] text-zinc-500 mt-0.5">Connecting peer WebRTC...</span>
              </div>
            )}

            {/* Remote Nameplate */}
            <div className="absolute top-2.5 left-2.5 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-bold text-white flex items-center gap-1.5 border border-white/10 shadow-xs">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isPeerOnline ? "bg-emerald-400" : "bg-amber-400 animate-pulse"
                }`}
              />
              <span className="truncate max-w-[130px]">{peerName}</span>
            </div>
          </div>
        </div>

        {/* Sleek Floating Media Control Dock */}
        <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMic}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs ${
                isMicOn
                  ? "bg-white/10 hover:bg-white/20 text-white border border-white/15"
                  : "bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30"
              }`}
              title={isMicOn ? "Mute Microphone" : "Unmute Microphone"}
            >
              {isMicOn ? (
                <FiMic size={13} className="text-emerald-400" />
              ) : (
                <FiMicOff size={13} className="text-red-400" />
              )}
              <span className="text-[11px]">{isMicOn ? "Mic On" : "Muted"}</span>
            </button>

            <button
              onClick={toggleCamera}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs ${
                isCameraOn
                  ? "bg-white/10 hover:bg-white/20 text-white border border-white/15"
                  : "bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30"
              }`}
              title={isCameraOn ? "Turn Camera Off" : "Turn Camera On"}
            >
              {isCameraOn ? (
                <FiVideo size={13} className="text-blue-400" />
              ) : (
                <FiVideoOff size={13} className="text-red-400" />
              )}
              <span className="text-[11px]">{isCameraOn ? "Camera On" : "Camera Off"}</span>
            </button>

            <button
              onClick={() => {
                if (typeof toggleCamera === "function") {
                  toggleCamera();
                  setTimeout(() => toggleCamera(), 400);
                }
              }}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 transition cursor-pointer shadow-xs"
              title="Reconnect media streams"
            >
              <FiRefreshCw size={11} className="text-zinc-400" />
              <span className="text-[10px] hidden sm:inline">Reconnect</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 uppercase tracking-wider font-bold">
            <FiLock size={11} className="text-emerald-400" />
            <span>P2P Encrypted • Live Sync</span>
          </div>
        </div>
      </div>
    </div>
  );
}
