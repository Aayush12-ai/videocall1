import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Mic, MicOff, Video as VideoIcon, VideoOff, Phone, AlertCircle } from "lucide-react";
import { useWebRTC } from "@/hooks/use-webrtc";
import { VideoPlayer } from "@/components/video-player";
import { motion } from "framer-motion";

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
    toggleMute,
    toggleVideo
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
    <div className="h-screen w-full bg-black flex flex-col relative overflow-hidden">
      
      {/* Main Video Area */}
      <div className="flex-1 relative p-4 pb-24 md:pb-28">
        {/* Remote Video (Full Screen) */}
        <div className="w-full h-full rounded-3xl overflow-hidden bg-zinc-900 border border-white/5 relative">
          {remoteStream ? (
            <VideoPlayer 
              stream={remoteStream} 
              className="w-full h-full !rounded-none" 
              name="Guest" 
            />
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

        {/* Local Video (PiP) */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="absolute bottom-28 right-8 md:bottom-32 md:right-10 w-32 md:w-48 aspect-[3/4] md:aspect-video rounded-2xl overflow-hidden shadow-2xl border-2 border-white/10 bg-zinc-800 z-10"
        >
          <VideoPlayer 
            stream={localStream} 
            muted 
            mirrored
            className="w-full h-full !rounded-none"
          />
        </motion.div>
      </div>

      {/* Control Bar */}
      <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-black/80 to-transparent flex justify-center pb-8">
        <div className="glass-panel px-6 py-4 rounded-3xl flex items-center gap-4 md:gap-6 shadow-[0_10_40px_rgba(0,0,0,0.5)]">
          
          <button
            onClick={toggleMute}
            className={`w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-full transition-all ${
              isMuted ? 'bg-destructive text-white' : 'bg-secondary hover:bg-secondary/80 text-foreground'
            }`}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <MicOff className="w-5 h-5 md:w-6 md:h-6" /> : <Mic className="w-5 h-5 md:w-6 md:h-6" />}
          </button>

          <button
            onClick={toggleVideo}
            className={`w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-full transition-all ${
              isVideoOff ? 'bg-destructive text-white' : 'bg-secondary hover:bg-secondary/80 text-foreground'
            }`}
            title={isVideoOff ? "Turn on camera" : "Turn off camera"}
          >
            {isVideoOff ? <VideoOff className="w-5 h-5 md:w-6 md:h-6" /> : <VideoIcon className="w-5 h-5 md:w-6 md:h-6" />}
          </button>

          <div className="w-px h-8 bg-white/10 mx-2" />

          <button
            onClick={() => setLocation("/")}
            className="w-16 h-12 md:w-20 md:h-14 flex items-center justify-center rounded-full bg-destructive hover:bg-destructive/90 text-white transition-all shadow-lg shadow-destructive/20 hover:scale-105 active:scale-95"
            title="Leave call"
          >
            <Phone className="w-6 h-6 md:w-7 md:h-7 rotate-[135deg]" />
          </button>

        </div>
      </div>

      {/* Connection Status Indicator */}
      {isConnected && (
        <div className="absolute top-6 left-6 px-3 py-1.5 bg-black/40 backdrop-blur-md border border-white/10 rounded-full flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_#22c55e] animate-pulse" />
          <span className="text-xs font-medium text-white/80 tracking-wide">CONNECTED</span>
        </div>
      )}

    </div>
  );
}
