import type { Socket } from "socket.io-client";

const rtcConfig: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const PING_INTERVAL = 30_000;
const STREAM_ACQUIRE_RETRY_DELAY = 5_000;

export class GamemasterWebcam {
  private socket: Socket;
  private cameraId: string;
  private stream: MediaStream | null = null;
  private pc: RTCPeerConnection | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private streamReady = false;
  private acquiringStream = false;

  constructor(socket: Socket, cameraId: string) {
    this.socket = socket;
    this.cameraId = cameraId;
    this.setupListeners();
    this.init();
  }

  private async init() {
    await this.acquireStream();
    this.startPing();

    // Re-acquire stream on reconnect if needed
    this.socket.on("connect", () => {
      this.sendPing();
      if (!this.streamReady) {
        this.acquireStream();
      }
    });
  }

  private async acquireStream(): Promise<void> {
    if (this.acquiringStream) return;
    this.acquiringStream = true;

    try {
      // Stop any existing tracks before acquiring new stream
      if (this.stream) {
        this.stream.getTracks().forEach((track) => track.stop());
        this.stream = null;
      }

      this.stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      this.streamReady = true;
      this.setupTrackListeners();
      console.log(`[webrtc:${this.cameraId}] Stream acquired`);

      // Notify that stream is available so viewer can request an offer
      if (this.socket.connected) {
        this.socket.emit("webrtc:stream-available", {
          cameraId: this.cameraId,
        });
        // Also send a ping to update online status
        this.sendPing();
      }
    } catch (err) {
      this.streamReady = false;
      console.error(`[webrtc:${this.cameraId}] Failed to access webcam:`, err);
      // Retry after delay
      setTimeout(() => {
        this.acquiringStream = false;
        this.acquireStream();
      }, STREAM_ACQUIRE_RETRY_DELAY);
      return;
    }

    this.acquiringStream = false;
  }

  private setupTrackListeners() {
    if (!this.stream) return;
    this.stream.getVideoTracks().forEach((track) => {
      track.onended = () => {
        console.warn(`[webrtc:${this.cameraId}] Track ended, reacquiring...`);
        this.streamReady = false;
        this.cleanupPeerConnection();
        this.sendPing(); // Update status to offline
        this.acquireStream();
      };
    });
  }

  private startPing() {
    this.sendPing();
    this.pingTimer = setInterval(() => this.sendPing(), PING_INTERVAL);
  }

  private sendPing() {
    if (this.socket.connected) {
      this.socket.emit("webrtc:camera-ping", {
        cameraId: this.cameraId,
        hasStream: this.streamReady,
      });
    }
  }

  private setupListeners() {
    this.socket.on("webrtc:request-offer", (data: { cameraId: string }) => {
      if (data.cameraId === this.cameraId) {
        this.handleRequestOffer();
      }
    });

    this.socket.on(
      "webrtc:answer",
      (data: { cameraId: string; sdp: RTCSessionDescriptionInit }) => {
        if (data.cameraId === this.cameraId) {
          this.handleAnswer(data);
        }
      }
    );

    this.socket.on(
      "webrtc:ice-candidate",
      (data: { cameraId: string; candidate: RTCIceCandidateInit }) => {
        if (data.cameraId === this.cameraId) {
          this.handleIceCandidate(data);
        }
      }
    );
  }

  private cleanupPeerConnection() {
    if (this.pc) {
      this.pc.onicecandidate = null;
      this.pc.onconnectionstatechange = null;
      this.pc.close();
      this.pc = null;
    }
  }

  private async handleRequestOffer() {
    if (!this.stream || !this.streamReady) {
      console.warn(
        `[webrtc:${this.cameraId}] No webcam stream available, ignoring request-offer`
      );
      return;
    }

    // Check if stream tracks are still active
    const videoTrack = this.stream.getVideoTracks()[0];
    if (!videoTrack || videoTrack.readyState !== "live") {
      console.warn(
        `[webrtc:${this.cameraId}] Stream track not live, reacquiring...`
      );
      this.streamReady = false;
      this.sendPing();
      this.acquireStream();
      return;
    }

    this.cleanupPeerConnection();

    const pc = new RTCPeerConnection(rtcConfig);
    this.pc = pc;

    this.stream.getTracks().forEach((track) => {
      pc.addTrack(track, this.stream!);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit("webrtc:ice-candidate", {
          cameraId: this.cameraId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(
        `[webrtc:${this.cameraId}] Connection state: ${pc.connectionState}`
      );
      if (
        pc.connectionState === "failed" ||
        pc.connectionState === "disconnected" ||
        pc.connectionState === "closed"
      ) {
        this.cleanupPeerConnection();
      }
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.socket.emit("webrtc:offer", {
        cameraId: this.cameraId,
        sdp: pc.localDescription,
      });
      console.log(`[webrtc:${this.cameraId}] Offer sent`);
    } catch (err) {
      console.error(`[webrtc:${this.cameraId}] Failed to create offer:`, err);
      this.cleanupPeerConnection();
    }
  }

  private handleAnswer(data: { sdp: RTCSessionDescriptionInit }) {
    if (!this.pc) {
      console.warn(`[webrtc:${this.cameraId}] No peer connection for answer`);
      return;
    }
    this.pc
      .setRemoteDescription(new RTCSessionDescription(data.sdp))
      .then(() => console.log(`[webrtc:${this.cameraId}] Answer set`))
      .catch((err) =>
        console.error(`[webrtc:${this.cameraId}] Failed to set answer:`, err)
      );
  }

  private handleIceCandidate(data: { candidate: RTCIceCandidateInit }) {
    if (!this.pc) return;
    this.pc
      .addIceCandidate(new RTCIceCandidate(data.candidate))
      .catch((err) =>
        console.error(
          `[webrtc:${this.cameraId}] Failed to add ICE candidate:`,
          err
        )
      );
  }

  destroy() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    this.cleanupPeerConnection();
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.streamReady = false;
  }
}
