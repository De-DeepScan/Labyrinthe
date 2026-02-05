import type { Socket } from "socket.io-client";

// =====================
// Types
// =====================

interface AudioConfig {
  enabled: boolean;
  debug: boolean;
}

interface PlayAmbientPayload {
  soundId: string;
  file: string;
  volume?: number;
}

interface StopAmbientPayload {
  soundId?: string;
}

interface PlayPresetPayload {
  presetIdx: number;
  file: string;
}

interface PausePresetPayload {
  presetIdx: number;
}

interface SeekPresetPayload {
  presetIdx: number;
  currentTime: number;
}

interface StopPresetPayload {
  presetIdx: number;
}

interface PlayTTSPayload {
  audioBase64: string;
  mimeType?: string;
}

interface VolumePayload {
  volume: number;
}

export interface AudioStatus {
  enabled: boolean;
  masterVolume: number;
  iaVolume: number;
  ambientVolume: number;
  activeAmbients: string[];
  activePresets: number[];
}

// =====================
// GamemasterAudio
// =====================

export class GamemasterAudio {
  private socket: Socket;
  private baseUrl: string;
  private config: AudioConfig = { enabled: true, debug: false };

  private masterVolume = 1;
  private iaVolume = 1;
  private ambientVolume = 1;

  private ambientAudios = new Map<string, HTMLAudioElement>();
  private presetAudios = new Map<number, HTMLAudioElement>();
  private ttsAudio: HTMLAudioElement | null = null;

  private visibilityHandler: (() => void) | null = null;

  // Ducking state: saved volumes before ducking
  private isDucked = false;
  private savedAmbientVolumes = new Map<string, number>();
  private savedPresetVolumes = new Map<number, number>();
  private savedTtsVolume = 0;

  constructor(socket: Socket, backofficeUrl: string) {
    this.socket = socket;
    this.baseUrl = backofficeUrl;
    this.setupListeners();
    this.setupVisibilityHandler();
  }

  // =====================
  // Public API
  // =====================

  get enabled(): boolean {
    return this.config.enabled;
  }

  get status(): AudioStatus {
    return {
      enabled: this.config.enabled,
      masterVolume: this.masterVolume,
      iaVolume: this.iaVolume,
      ambientVolume: this.ambientVolume,
      activeAmbients: [...this.ambientAudios.keys()],
      activePresets: [...this.presetAudios.keys()],
    };
  }

  configure(config: Partial<AudioConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.enabled === false) this.stopAll();
  }

  enable(): void {
    this.config.enabled = true;
    this.socket.emit("register-audio-player", {});
  }

  disable(): void {
    this.config.enabled = false;
    this.stopAll();
  }

  register(): void {
    if (this.config.enabled) {
      console.log("[gamemaster:audio:labyrinthe] Registering as audio player");
      this.socket.emit("register-audio-player", {});
    }
  }

  stopAll(): void {
    for (const audio of this.ambientAudios.values()) {
      audio.pause();
      audio.src = "";
    }
    this.ambientAudios.clear();

    for (const audio of this.presetAudios.values()) {
      audio.pause();
      audio.src = "";
    }
    this.presetAudios.clear();

    if (this.ttsAudio) {
      this.ttsAudio.pause();
      this.ttsAudio.src = "";
      this.ttsAudio = null;
    }

    this.log("All audio stopped");
  }

  destroy(): void {
    this.stopAll();
    if (this.visibilityHandler) {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
      this.visibilityHandler = null;
    }
    this.socket.off("audio:play-ambient");
    this.socket.off("audio:stop-ambient");
    this.socket.off("audio:volume-ambient");
    this.socket.off("audio:set-ambient-volume");
    this.socket.off("audio:play-preset");
    this.socket.off("audio:pause-preset");
    this.socket.off("audio:resume-preset");
    this.socket.off("audio:seek-preset");
    this.socket.off("audio:stop-preset");
    this.socket.off("audio:play-tts");
    this.socket.off("audio:master-volume");
    this.socket.off("audio:volume-ia");
    this.socket.off("audio:stop-all");
    this.socket.off("audio:duck-ambient");
    this.socket.off("audio:unduck-ambient");
  }

  // =====================
  // Volume helpers
  // =====================

  private applyPresetVolume(): void {
    for (const a of this.presetAudios.values()) {
      a.volume = Math.min(1, this.iaVolume * this.masterVolume);
    }
  }

  private applyTtsVolume(): void {
    if (this.ttsAudio) {
      this.ttsAudio.volume = Math.min(1, this.iaVolume * this.masterVolume);
    }
  }

  private applyAmbientVolume(): void {
    for (const a of this.ambientAudios.values()) {
      a.volume = Math.min(1, this.ambientVolume * this.masterVolume);
    }
  }

  // =====================
  // Internals
  // =====================

  private log(msg: string, ...args: unknown[]): void {
    if (this.config.debug) {
      console.log(`[gamemaster:audio] ${msg}`, ...args);
    }
  }

  private setupVisibilityHandler(): void {
    if (typeof document === "undefined") return;
    this.visibilityHandler = () => {
      if (document.visibilityState === "visible") {
        for (const a of this.ambientAudios.values()) {
          if (a.paused && a.src) a.play().catch(() => {});
        }
      }
    };
    document.addEventListener("visibilitychange", this.visibilityHandler);
  }

  private setupListeners(): void {
    const s = this.socket;
    console.log("[gamemaster:audio:labyrinthe] Setting up listeners");

    // --- Ambient ---

    s.on("audio:play-ambient", (data: PlayAmbientPayload) => {
      if (!this.config.enabled) return;
      const { soundId, file, volume } = data;
      this.log("Play ambient:", soundId);

      const existing = this.ambientAudios.get(soundId);
      if (existing) {
        existing.pause();
        existing.src = "";
      }

      const audio = new Audio();
      audio.loop = true;
      this.ambientAudios.set(soundId, audio);
      audio.src = `${this.baseUrl}/audio/ambient/${file}`;
      audio.play().catch((e) => this.log("Play error:", e.message));
      audio.volume =
        volume != null
          ? Math.min(1, volume * this.masterVolume)
          : Math.min(1, this.ambientVolume * this.masterVolume);
    });

    s.on("audio:stop-ambient", (data: StopAmbientPayload) => {
      if (data?.soundId && this.ambientAudios.has(data.soundId)) {
        this.ambientAudios.get(data.soundId)!.pause();
        this.ambientAudios.delete(data.soundId);
        this.log("Stop ambient:", data.soundId);
      } else {
        for (const a of this.ambientAudios.values()) a.pause();
        this.ambientAudios.clear();
        this.log("Stop all ambient");
      }
    });

    s.on("audio:volume-ambient", (data: VolumePayload) => {
      this.ambientVolume = data.volume;
      this.applyAmbientVolume();
      this.log("Ambient volume:", Math.round(this.ambientVolume * 100) + "%");
    });

    s.on(
      "audio:set-ambient-volume",
      (data: { soundId: string; volume: number }) => {
        const audio = this.ambientAudios.get(data.soundId);
        if (audio) {
          audio.volume = Math.min(1, data.volume * this.masterVolume);
          this.log(
            "Ambient",
            data.soundId,
            "volume:",
            Math.round(data.volume * 100) + "%",
          );
        }
      },
    );

    // --- Presets ---

    s.on("audio:play-preset", (data: PlayPresetPayload) => {
      if (!this.config.enabled) return;
      const { presetIdx, file } = data;
      this.log("Play preset:", presetIdx, file);

      const existing = this.presetAudios.get(presetIdx);
      if (existing) {
        existing.pause();
        existing.src = "";
      }

      const audio = new Audio();
      audio.volume = Math.min(1, this.iaVolume * this.masterVolume);

      audio.addEventListener("timeupdate", () => {
        if (!audio.paused && s.connected) {
          s.emit("audio:preset-progress", {
            presetIdx,
            currentTime: audio.currentTime,
            duration: audio.duration || 0,
          });
        }
      });

      audio.addEventListener("ended", () => {
        s.emit("audio:preset-progress", {
          presetIdx,
          currentTime: audio.duration || 0,
          duration: audio.duration || 0,
          ended: true,
        });
        this.presetAudios.delete(presetIdx);
      });

      this.presetAudios.set(presetIdx, audio);
      audio.src = `${this.baseUrl}/audio/presets/${file}`;
      audio.play().catch((e) => this.log("Play error:", e.message));
    });

    s.on("audio:pause-preset", (data: PausePresetPayload) => {
      this.log("Pause preset:", data.presetIdx);
      this.presetAudios.get(data.presetIdx)?.pause();
    });

    s.on("audio:resume-preset", (data: PausePresetPayload) => {
      this.log("Resume preset:", data.presetIdx);
      this.presetAudios
        .get(data.presetIdx)
        ?.play()
        .catch((e) => this.log("Resume error:", e.message));
    });

    s.on("audio:seek-preset", (data: SeekPresetPayload) => {
      this.log("Seek preset:", data.presetIdx, "to", data.currentTime);
      const audio = this.presetAudios.get(data.presetIdx);
      if (audio && typeof data.currentTime === "number") {
        audio.currentTime = data.currentTime;
      }
    });

    s.on("audio:stop-preset", (data: StopPresetPayload) => {
      this.log("Stop preset:", data.presetIdx);
      const audio = this.presetAudios.get(data.presetIdx);
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
        this.presetAudios.delete(data.presetIdx);
      }
    });

    // --- TTS ---

    s.on("audio:play-tts", (data: PlayTTSPayload) => {
      if (!this.config.enabled) return;
      this.log("Play TTS");

      if (this.ttsAudio) this.ttsAudio.pause();

      this.ttsAudio = new Audio();
      const mimeType = data.mimeType || "audio/mpeg";
      this.ttsAudio.src = `data:${mimeType};base64,${data.audioBase64}`;
      this.ttsAudio.play().catch((e) => this.log("Play error:", e.message));
      this.applyTtsVolume();

      this.ttsAudio.onended = () => {
        this.ttsAudio = null;
      };
    });

    // --- Volume controls ---

    s.on("audio:master-volume", (data: VolumePayload) => {
      this.masterVolume = data.volume;
      this.log("Master volume:", Math.round(this.masterVolume * 100) + "%");
      this.applyPresetVolume();
      this.applyTtsVolume();
      this.applyAmbientVolume();
    });

    s.on("audio:volume-ia", (data: VolumePayload) => {
      this.iaVolume = data.volume;
      this.log("IA volume:", Math.round(this.iaVolume * 100) + "%");
      this.applyPresetVolume();
      this.applyTtsVolume();
    });

    // --- Stop all ---

    s.on("audio:stop-all", () => {
      this.log("Stop all audio");
      this.stopAll();
    });

    // --- Ducking (lower ambient when TTS plays) ---

    s.on("audio:duck-ambient", (data: { factor: number }) => {
      console.log("[gamemaster:audio:labyrinthe] DUCK EVENT RECEIVED", data);
      if (this.isDucked) {
        console.log("[gamemaster:audio:labyrinthe] Already ducked, ignoring");
        return;
      }
      this.isDucked = true;
      const factor = data.factor ?? 0.8;
      this.log("Duck all audio by factor:", factor);
      console.log("[gamemaster:audio:labyrinthe] Presets count:", this.presetAudios.size);
      console.log("[gamemaster:audio:labyrinthe] Ambients count:", this.ambientAudios.size);

      // Save and reduce ambient volumes
      for (const [soundId, audio] of this.ambientAudios) {
        this.savedAmbientVolumes.set(soundId, audio.volume);
        audio.volume = Math.min(1, audio.volume * factor);
      }

      // Save and reduce preset volumes (ARIA voice)
      for (const [presetIdx, audio] of this.presetAudios) {
        this.savedPresetVolumes.set(presetIdx, audio.volume);
        audio.volume = Math.min(1, audio.volume * factor);
      }

      // Save and reduce TTS volume (ARIA TTS)
      if (this.ttsAudio) {
        this.savedTtsVolume = this.ttsAudio.volume;
        this.ttsAudio.volume = Math.min(1, this.ttsAudio.volume * factor);
      }
    });

    s.on("audio:unduck-ambient", () => {
      if (!this.isDucked) return; // Not ducked
      this.isDucked = false;
      this.log("Unduck all audio - restoring volumes");

      // Restore ambient volumes
      for (const [soundId, savedVolume] of this.savedAmbientVolumes) {
        const audio = this.ambientAudios.get(soundId);
        if (audio) {
          audio.volume = savedVolume;
        }
      }
      this.savedAmbientVolumes.clear();

      // Restore preset volumes
      for (const [presetIdx, savedVolume] of this.savedPresetVolumes) {
        const audio = this.presetAudios.get(presetIdx);
        if (audio) {
          audio.volume = savedVolume;
        }
      }
      this.savedPresetVolumes.clear();

      // Restore TTS volume
      if (this.ttsAudio && this.savedTtsVolume > 0) {
        this.ttsAudio.volume = this.savedTtsVolume;
      }
      this.savedTtsVolume = 0;
    });
  }
}
