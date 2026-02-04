import type { Socket } from "socket.io-client";

const rtcConfig: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const PING_INTERVAL = 30_000;

export class GamemasterWebcam {
  private socket: Socket;
  private cameraId: string;
  private stream: MediaStream | null = null;
  private pc: RTCPeerConnection | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(socket: Socket, cameraId: string) {
    this.socket = socket;
    this.cameraId = cameraId;
    this.init();
    this.setupListeners();
    this.startPing();
  }

  private async init() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      console.log(`[webrtc:${this.cameraId}] Webcam stream acquired`);
    } catch (err) {
      console.error(`[webrtc:${this.cameraId}] Failed to access webcam:`, err);
    }
  }

  private startPing() {
    // Send initial ping
    this.sendPing();
    // Re-ping on reconnect
    this.socket.on("connect", () => this.sendPing());
    // Ping every 30s
    this.pingTimer = setInterval(() => this.sendPing(), PING_INTERVAL);
  }

  private sendPing() {
    if (this.socket.connected) {
      this.socket.emit("webrtc:camera-ping", { cameraId: this.cameraId });
    }
  }

  private setupListeners() {
    this.socket.on(
      "webrtc:request-offer",
      (data: { cameraId: string }) => {
        if (data.cameraId === this.cameraId) {
          this.handleRequestOffer();
        }
      },
    );

    this.socket.on(
      "webrtc:answer",
      (data: { cameraId: string; sdp: RTCSessionDescriptionInit }) => {
        if (data.cameraId === this.cameraId) {
          this.handleAnswer(data);
        }
      },
    );

    this.socket.on(
      "webrtc:ice-candidate",
      (data: { cameraId: string; candidate: RTCIceCandidateInit }) => {
        if (data.cameraId === this.cameraId) {
          this.handleIceCandidate(data);
        }
      },
    );
  }

  private cleanup() {
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
  }

  private async handleRequestOffer() {
    if (!this.stream) {
      console.warn(
        `[webrtc:${this.cameraId}] No webcam stream available, ignoring request-offer`,
      );
      return;
    }

    this.cleanup();

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
        `[webrtc:${this.cameraId}] Connection state: ${pc.connectionState}`,
      );
      if (
        pc.connectionState === "failed" ||
        pc.connectionState === "disconnected" ||
        pc.connectionState === "closed"
      ) {
        this.cleanup();
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
      console.error(
        `[webrtc:${this.cameraId}] Failed to create offer:`,
        err,
      );
      this.cleanup();
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
        console.error(
          `[webrtc:${this.cameraId}] Failed to set answer:`,
          err,
        ),
      );
  }

  private handleIceCandidate(data: { candidate: RTCIceCandidateInit }) {
    if (!this.pc) return;
    this.pc
      .addIceCandidate(new RTCIceCandidate(data.candidate))
      .catch((err) =>
        console.error(
          `[webrtc:${this.cameraId}] Failed to add ICE candidate:`,
          err,
        ),
      );
  }
}
