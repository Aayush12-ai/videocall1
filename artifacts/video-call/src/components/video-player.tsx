import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { User } from "lucide-react";

interface VideoPlayerProps {
  stream: MediaStream | null;
  muted?: boolean;
  className?: string;
  mirrored?: boolean;
  name?: string;
}

export function VideoPlayer({ stream, muted = false, className, mirrored = false, name }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  if (!stream) {
    return (
      <div className={cn("bg-secondary/50 flex flex-col items-center justify-center rounded-2xl overflow-hidden", className)}>
        <div className="bg-secondary p-6 rounded-full mb-4">
          <User className="w-12 h-12 text-muted-foreground" />
        </div>
        {name && <p className="text-muted-foreground font-medium">{name}</p>}
      </div>
    );
  }

  return (
    <div className={cn("relative rounded-2xl overflow-hidden bg-black", className)}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className={cn(
          "w-full h-full object-cover",
          mirrored && "-scale-x-100"
        )}
      />
      {name && (
        <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-sm font-medium">
          {name}
        </div>
      )}
    </div>
  );
}
