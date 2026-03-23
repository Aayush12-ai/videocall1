import { useEffect, useRef, useState, useCallback } from "react";

interface WebRTCState {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  error: string | null;
  isConnected: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  remoteIsScreenSharing: boolean;
  screenShareRequest: { name: string } | null;
  screenShareRequestPending: boolean;
  screenShareDenied: boolean;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" }
  ]
};

export function useWebRTC(roomId: string, token: string, name: string) {
  const isHost = token === "host";

  const [state, setState] = useState<WebRTCState>({
    localStream: null,
    remoteStream: null,
    error: null,
    isConnected: false,
    isMuted: false,
    isVideoOff: false,
    isScreenSharing: false,
    remoteIsScreenSharing: false,
    screenShareRequest: null,
    screenShareRequestPending: false,
    screenShareDenied: false,
  });

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const sendWs = useCallback((data: object) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }, []);

  const stopScreenShareInternal = useCallback(async (notify = true) => {
    const pc = pcRef.current;
    const cameraStream = localStreamRef.current;
    const screenStream = screenStreamRef.current;

    if (screenStream) {
      screenStream.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }

    if (pc && cameraStream) {
      const cameraTrack = cameraStream.getVideoTracks()[0];
      const videoSender = pc.getSenders().find(s => s.track?.kind === "video");
      if (videoSender && cameraTrack) {
        await videoSender.replaceTrack(cameraTrack);
      }
    }

    const videoOnlyStream = cameraStream
      ? new MediaStream(cameraStream.getVideoTracks())
      : null;

    setState(s => ({
      ...s,
      isScreenSharing: false,
      localStream: videoOnlyStream,
    }));

    if (notify) {
      sendWs({ type: "screen-share-stop" });
    }
  }, [sendWs]);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
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

        const videoOnlyStream = new MediaStream(stream.getVideoTracks());
        setState(s => ({ ...s, localStream: videoOnlyStream }));

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
          if (pc.iceConnectionState === "connected") {
            setState(s => ({ ...s, isConnected: true }));
          } else if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
            setState(s => ({ ...s, isConnected: false, remoteStream: null }));
          }
        };

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
              case "peer-joined": {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                ws.send(JSON.stringify({ type: "offer", sdp: pc.localDescription }));
                break;
              }

              case "offer": {
                await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                ws.send(JSON.stringify({ type: "answer", sdp: pc.localDescription }));
                break;
              }

              case "answer": {
                await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
                break;
              }

              case "ice-candidate": {
                if (msg.candidate) {
                  await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
                }
                break;
              }

              case "peer-left": {
                setState(s => ({
                  ...s,
                  isConnected: false,
                  remoteStream: null,
                  remoteIsScreenSharing: false,
                  screenShareRequest: null,
                }));
                break;
              }

              case "screen-share-request": {
                // Only hosts should receive this
                if (isHost) {
                  setState(s => ({ ...s, screenShareRequest: { name: msg.name || "Guest" } }));
                }
                break;
              }

              case "screen-share-approved": {
                // Guest receives this — they are cleared to start sharing
                setState(s => ({ ...s, screenShareRequestPending: false, screenShareDenied: false }));
                // Now actually start the screen share
                try {
                  const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                  if (!mounted) {
                    screenStream.getTracks().forEach(t => t.stop());
                    return;
                  }
                  screenStreamRef.current = screenStream;
                  const screenTrack = screenStream.getVideoTracks()[0];

                  const videoSender = pc.getSenders().find(s => s.track?.kind === "video");
                  if (videoSender) {
                    await videoSender.replaceTrack(screenTrack);
                  }

                  setState(s => ({
                    ...s,
                    isScreenSharing: true,
                    localStream: new MediaStream([screenTrack]),
                  }));

                  ws.send(JSON.stringify({ type: "screen-share-started" }));

                  screenTrack.onended = () => {
                    stopScreenShareInternal(true);
                  };
                } catch {
                  setState(s => ({ ...s, screenShareRequestPending: false }));
                }
                break;
              }

              case "screen-share-denied": {
                setState(s => ({
                  ...s,
                  screenShareRequestPending: false,
                  screenShareDenied: true,
                }));
                // Auto-clear the denied message after 3s
                setTimeout(() => {
                  setState(s => ({ ...s, screenShareDenied: false }));
                }, 3000);
                break;
              }

              case "screen-share-started": {
                setState(s => ({ ...s, remoteIsScreenSharing: true }));
                break;
              }

              case "screen-share-stop": {
                setState(s => ({ ...s, remoteIsScreenSharing: false }));
                break;
              }

              case "error": {
                setState(s => ({ ...s, error: msg.message || "Signaling error" }));
                break;
              }
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
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
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

  const startScreenShare = useCallback(async () => {
    if (isHost) {
      // Host shares immediately without permission
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];

        const pc = pcRef.current;
        if (pc) {
          const videoSender = pc.getSenders().find(s => s.track?.kind === "video");
          if (videoSender) {
            await videoSender.replaceTrack(screenTrack);
          }
        }

        setState(s => ({
          ...s,
          isScreenSharing: true,
          localStream: new MediaStream([screenTrack]),
        }));

        sendWs({ type: "screen-share-started" });

        screenTrack.onended = () => {
          stopScreenShareInternal(true);
        };
      } catch {
        // User cancelled the picker — do nothing
      }
    } else {
      // Guest must request permission first
      setState(s => ({ ...s, screenShareRequestPending: true, screenShareDenied: false }));
      sendWs({ type: "screen-share-request", name });
    }
  }, [isHost, name, sendWs, stopScreenShareInternal]);

  const stopScreenShare = useCallback(() => {
    stopScreenShareInternal(true);
  }, [stopScreenShareInternal]);

  const approveScreenShare = useCallback(() => {
    setState(s => ({ ...s, screenShareRequest: null }));
    sendWs({ type: "screen-share-approved" });
  }, [sendWs]);

  const denyScreenShare = useCallback(() => {
    setState(s => ({ ...s, screenShareRequest: null }));
    sendWs({ type: "screen-share-denied" });
  }, [sendWs]);

  return {
    ...state,
    isHost,
    toggleMute,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    approveScreenShare,
    denyScreenShare,
  };
}
