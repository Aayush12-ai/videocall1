import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import {
  Mic, MicOff, Video as VideoIcon, VideoOff, Phone,
  AlertCircle, Monitor, MonitorOff, MonitorX, Check, X,
} from "lucide-react";
import { useWebRTC } from "@/hooks/use-webrtc";
import { VideoPlayer } from "@/components/video-player";
import { motion, AnimatePresence } from "framer-motion";

export function Call() {
  const params = useParams();
  const roomId = params.roomId || "";
  const [, setLocation] = useLocation();

  const [token, setToken] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const t = searchParams.get("token");
    const n = searchParams.get("name");

    if (!t || !n) {
      setLocation("/");
      return;
    }

    setToken(t);
    setName(n);
  }, [setLocation]);

  const {
    localStream,
    remoteStream,
    error,
    isConnected,
    isMuted,
    isVideoOff,
    isScreenSharing,
    remoteIsScreenSharing,
    screenShareRequest,
    screenShareRequestPending,
    screenShareDenied,
    isHost,
    toggleMute,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    approveScreenShare,
    denyScreenShare,
  } = useWebRTC(roomId, token, name);

  if (!token || !name) return null;

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="bg-destructive/10 border border-destructive/20 p-8 rounded-3xl max-w-md w-full text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-xl font-semibold">Connection Error</h2>
          <p className="text-muted-foreground">{error}</p>
          <button
            onClick={() => setLocation("/")}
            className="px-6 py-3 bg-secondary hover:bg-secondary/80 rounded-xl transition-colors font-medium mt-4"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-black flex flex-col overflow-hidden">

      {/* Host: permission request overlay from guest */}
      <AnimatePresence>
        {screenShareRequest && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl px-5 py-4 flex items-center gap-4 max-w-sm w-full"
          >
            <Monitor className="w-5 h-5 text-blue-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {screenShareRequest.name} wants to share their screen
              </p>
              <p className="text-xs text-zinc-400 mt-0.5">Allow screen sharing?</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={approveScreenShare}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-green-600 hover:bg-green-500 text-white transition-colors"
                title="Allow"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={denyScreenShare}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-700 hover:bg-zinc-600 text-white transition-colors"
                title="Deny"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Guest: "waiting for permission" / "denied" toast */}
      <AnimatePresence>
        {(screenShareRequestPending || screenShareDenied) && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`absolute top-4 left-1/2 -translate-x-1/2 z-50 border rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-3 max-w-xs w-full ${
              screenShareDenied
                ? "bg-destructive/10 border-destructive/30"
                : "bg-zinc-900 border-white/10"
            }`}
          >
            {screenShareDenied ? (
              <>
                <MonitorX className="w-5 h-5 text-destructive shrink-0" />
                <p className="text-sm text-white">Screen share was denied</p>
              </>
            ) : (
              <>
                <Monitor className="w-5 h-5 text-blue-400 animate-pulse shrink-0" />
                <p className="text-sm text-white">Waiting for host to approve...</p>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video Area */}
      <div className="relative flex-1 p-3 min-h-0">

        {/* Remote Video */}
        <div className="w-full h-full rounded-2xl overflow-hidden bg-zinc-900 border border-white/5">
          {remoteStream ? (
            <div className="relative w-full h-full">
              <VideoPlayer
                stream={remoteStream}
                className="w-full h-full !rounded-none"
                name={remoteIsScreenSharing ? undefined : "Guest"}
              />
              {remoteIsScreenSharing && (
                <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-sm font-medium flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-blue-400" />
                  <span>Screen share</span>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground space-y-4">
              <div className="relative">
                <div className="w-24 h-24 rounded-full border-2 border-dashed border-muted-foreground/30 animate-[spin_4s_linear_infinite]" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center">
                    <VideoIcon className="w-6 h-6 text-muted-foreground/50" />
                  </div>
                </div>
              </div>
              <p className="font-medium">Waiting for others to join...</p>
              <p className="text-sm opacity-50 text-center max-w-xs px-4">
                Share the room link and password with the person you want to talk to.
              </p>
            </div>
          )}
        </div>

        {/* Local Video PiP */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="absolute top-6 right-6 w-36 md:w-52 aspect-video rounded-xl overflow-hidden shadow-2xl border-2 border-white/10 bg-zinc-800 z-10"
        >
          <VideoPlayer
            stream={localStream}
            muted
            mirrored={!isScreenSharing}
            className="w-full h-full !rounded-none"
          />
          {isScreenSharing && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5 flex items-center gap-1">
              <Monitor className="w-3 h-3 text-blue-400" />
              <span className="text-xs text-white/80">Sharing</span>
            </div>
          )}
        </motion.div>

        {/* Connection status badge */}
        {isConnected && (
          <div className="absolute top-6 left-6 px-3 py-1.5 bg-black/50 backdrop-blur-md border border-white/10 rounded-full flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e] animate-pulse" />
            <span className="text-xs font-medium text-white/80 tracking-wide">CONNECTED</span>
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="shrink-0 flex justify-center items-center py-4 px-6 bg-black/80 backdrop-blur-sm border-t border-white/5">
        <div className="flex items-center gap-3 md:gap-4">

          <button
            onClick={toggleMute}
            className={`w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-full transition-all ${
              isMuted
                ? "bg-destructive text-white"
                : "bg-white/10 hover:bg-white/20 text-white"
            }`}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <MicOff className="w-5 h-5 md:w-6 md:h-6" /> : <Mic className="w-5 h-5 md:w-6 md:h-6" />}
          </button>

          <button
            onClick={toggleVideo}
            className={`w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-full transition-all ${
              isVideoOff
                ? "bg-destructive text-white"
                : "bg-white/10 hover:bg-white/20 text-white"
            }`}
            title={isVideoOff ? "Turn on camera" : "Turn off camera"}
          >
            {isVideoOff ? <VideoOff className="w-5 h-5 md:w-6 md:h-6" /> : <VideoIcon className="w-5 h-5 md:w-6 md:h-6" />}
          </button>

          {/* Screen share button */}
          <button
            onClick={isScreenSharing ? stopScreenShare : startScreenShare}
            disabled={screenShareRequestPending}
            className={`w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              isScreenSharing
                ? "bg-blue-600 hover:bg-blue-500 text-white"
                : "bg-white/10 hover:bg-white/20 text-white"
            }`}
            title={
              isScreenSharing
                ? "Stop sharing"
                : isHost
                ? "Share screen"
                : screenShareRequestPending
                ? "Waiting for approval..."
                : "Request screen share"
            }
          >
            {isScreenSharing ? (
              <MonitorOff className="w-5 h-5 md:w-6 md:h-6" />
            ) : (
              <Monitor className="w-5 h-5 md:w-6 md:h-6" />
            )}
          </button>

          <div className="w-px h-8 bg-white/10" />

          <button
            onClick={() => setLocation("/")}
            className="w-16 h-12 md:w-20 md:h-14 flex items-center justify-center rounded-full bg-destructive hover:bg-destructive/90 text-white transition-all shadow-lg shadow-destructive/30 hover:scale-105 active:scale-95"
            title="Leave call"
          >
            <Phone className="w-6 h-6 md:w-7 md:h-7 rotate-[135deg]" />
          </button>

        </div>
      </div>

    </div>
  );
}
