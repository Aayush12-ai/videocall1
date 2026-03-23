import { useEffect, useRef, useState, useCallback } from "react";

interface WebRTCState {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  error: string | null;
  isConnected: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" }
  ]
};

export function useWebRTC(roomId: string, token: string, name: string) {
  const [state, setState] = useState<WebRTCState>({
    localStream: null,
    remoteStream: null,
    error: null,
    isConnected: false,
    isMuted: false,
    isVideoOff: false,
  });

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        // 1. Get Local Media
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        if (!mounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        localStreamRef.current = stream;
        setState(s => ({ ...s, localStream: stream }));

        // 2. Initialize Peer Connection
        const pc = new RTCPeerConnection(ICE_SERVERS);
        pcRef.current = pc;

        stream.getTracks().forEach(track => {
          pc.addTrack(track, stream);
        });

        pc.ontrack = (event) => {
          if (event.streams && event.streams[0]) {
            setState(s => ({ ...s, remoteStream: event.streams[0] }));
          }
        };

        pc.oniceconnectionstatechange = () => {
          if (pc.iceConnectionState === 'connected') {
            setState(s => ({ ...s, isConnected: true }));
          } else if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
            setState(s => ({ ...s, isConnected: false, remoteStream: null }));
          }
        };

        // 3. Initialize WebSocket Signaling
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        pc.onicecandidate = (event) => {
          if (event.candidate && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ice-candidate", candidate: event.candidate }));
          }
        };

        ws.onopen = () => {
          if (!mounted) return;
          ws.send(JSON.stringify({ type: "join", roomId, name, token }));
        };

        ws.onmessage = async (event) => {
          if (!mounted) return;
          try {
            const msg = JSON.parse(event.data);

            switch (msg.type) {
              case "peer-joined":
                // Existing peer creates the offer
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                ws.send(JSON.stringify({ type: "offer", sdp: pc.localDescription }));
                break;

              case "offer":
                await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                ws.send(JSON.stringify({ type: "answer", sdp: pc.localDescription }));
                break;

              case "answer":
                await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
                break;

              case "ice-candidate":
                if (msg.candidate) {
                  await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
                }
                break;

              case "peer-left":
                setState(s => ({ ...s, isConnected: false, remoteStream: null }));
                // In a production app, we might need to recreate the PC for the next peer
                break;
                
              case "error":
                setState(s => ({ ...s, error: msg.message || "Signaling error" }));
                break;
            }
          } catch (err) {
            console.error("Error processing signaling message", err);
          }
        };

        ws.onerror = () => {
          setState(s => ({ ...s, error: "Connection lost to signaling server" }));
        };

      } catch (err: any) {
        console.error("Media/WebRTC init error:", err);
        if (mounted) {
          setState(s => ({ ...s, error: err.message || "Failed to access camera/microphone" }));
        }
      }
    };

    init();

    return () => {
      mounted = false;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (pcRef.current) {
        pcRef.current.close();
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [roomId, token, name]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        const enabled = !audioTracks[0].enabled;
        audioTracks[0].enabled = enabled;
        setState(s => ({ ...s, isMuted: !enabled }));
      }
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        const enabled = !videoTracks[0].enabled;
        videoTracks[0].enabled = enabled;
        setState(s => ({ ...s, isVideoOff: !enabled }));
      }
    }
  }, []);

  return { ...state, toggleMute, toggleVideo };
}
