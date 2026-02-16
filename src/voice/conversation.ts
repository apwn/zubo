import { tmpdir } from "os";
import { join } from "path";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { randomUUID } from "crypto";
import { getSttProvider } from "./stt";
import { getTtsProvider } from "./tts";
import { logger } from "../util/logger";

export interface VoiceConversationOpts {
  /** Send transcribed user text to the agent and return the agent's text reply. */
  onTranscript: (text: string) => Promise<string>;
  /** Milliseconds of silence before we stop recording (default 1500). */
  silenceThreshold?: number;
  /** Maximum recording length in milliseconds (default 30000). */
  maxRecordingMs?: number;
  /** Called when transcription is received — useful for printing user text. */
  onUserText?: (text: string) => void;
  /** Called when agent reply text is available (before TTS). */
  onAgentText?: (text: string) => void;
  /** Called on errors that are non-fatal (recording retry, etc). */
  onWarning?: (msg: string) => void;
}

type ResolvedOpts = Required<
  Pick<VoiceConversationOpts, "onTranscript" | "silenceThreshold" | "maxRecordingMs">
> & {
  onUserText: ((text: string) => void) | null;
  onAgentText: ((text: string) => void) | null;
  onWarning: ((msg: string) => void) | null;
};

export class VoiceConversation {
  private running = false;
  private opts: ResolvedOpts;

  constructor(opts: VoiceConversationOpts) {
    this.opts = {
      silenceThreshold: opts.silenceThreshold ?? 1500,
      maxRecordingMs: opts.maxRecordingMs ?? 30000,
      onTranscript: opts.onTranscript,
      onUserText: opts.onUserText ?? null,
      onAgentText: opts.onAgentText ?? null,
      onWarning: opts.onWarning ?? null,
    };
  }

  /**
   * Start the continuous voice conversation loop.
   * Blocks until stop() is called or the process is interrupted.
   *
   * Loop:
   *   1. Record audio from microphone (sox/rec with silence detection)
   *   2. Transcribe with STT provider
   *   3. Send transcript to agent via onTranscript callback
   *   4. Synthesize agent reply with TTS
   *   5. Play synthesized audio
   *   6. Repeat
   */
  async start(): Promise<void> {
    const stt = getSttProvider();
    const tts = getTtsProvider();

    if (!stt) {
      throw new Error(
        "No STT provider configured. Set voice.stt in config.json. " +
          "Supported providers: whisper (cloud), local (whisper.cpp)"
      );
    }
    if (!tts) {
      throw new Error(
        "No TTS provider configured. Set voice.tts in config.json. " +
          "Supported providers: openai, elevenlabs"
      );
    }

    // Verify recording tools are available
    await verifyRecordingTools();

    this.running = true;
    logger.info("Voice conversation started");

    while (this.running) {
      try {
        // 1. Record audio
        logger.debug("Listening...");
        const audioBuffer = await recordAudio(
          this.opts.maxRecordingMs,
          this.opts.silenceThreshold
        );

        if (!this.running) break;

        // Skip very short recordings (likely just noise)
        if (audioBuffer.length < 4000) {
          logger.debug("Recording too short, skipping", {
            bytes: audioBuffer.length,
          });
          continue;
        }

        // 2. Transcribe
        logger.debug("Transcribing...");
        const transcript = await stt.transcribe(audioBuffer, "wav");

        if (!this.running) break;

        // Skip empty or noise-only transcriptions
        const cleaned = transcript.trim();
        if (!cleaned || cleaned.length < 2 || isNoiseOnly(cleaned)) {
          logger.debug("Empty or noise-only transcription, skipping", {
            transcript: cleaned,
          });
          continue;
        }

        logger.info("User said", { text: cleaned });
        this.opts.onUserText?.(cleaned);

        // 3. Send to agent
        logger.debug("Processing with agent...");
        const agentReply = await this.opts.onTranscript(cleaned);

        if (!this.running) break;

        if (!agentReply || agentReply.trim().length === 0) {
          logger.debug("Agent returned empty reply, continuing");
          continue;
        }

        logger.info("Agent replied", {
          length: agentReply.length,
        });
        this.opts.onAgentText?.(agentReply);

        // 4. Synthesize speech
        logger.debug("Synthesizing speech...");
        const speechBuffer = await tts.synthesize(agentReply);

        if (!this.running) break;

        // 5. Play audio
        logger.debug("Playing response...");
        await playAudio(speechBuffer, tts.format);
      } catch (err: any) {
        if (!this.running) break;

        logger.error("Voice conversation loop error", { error: err.message });
        const msg = `Voice error: ${err.message}`;
        this.opts.onWarning?.(msg);

        // Brief pause before retrying to avoid tight error loops
        await sleep(1000);
      }
    }

    logger.info("Voice conversation stopped");
  }

  stop(): void {
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check if common recording tools are available. */
async function verifyRecordingTools(): Promise<void> {
  // Check for sox/rec
  const recCheck = Bun.spawnSync(["which", "rec"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const soxCheck = Bun.spawnSync(["which", "sox"], {
    stdout: "pipe",
    stderr: "pipe",
  });

  if (recCheck.exitCode !== 0 && soxCheck.exitCode !== 0) {
    throw new Error(
      "Recording requires 'sox' to be installed.\n" +
        "  macOS:  brew install sox\n" +
        "  Ubuntu: sudo apt install sox\n" +
        "  Arch:   sudo pacman -S sox"
    );
  }
}

/**
 * Record audio from the default microphone using sox/rec.
 *
 * Records 16kHz mono 16-bit WAV. Uses sox's built-in silence detection:
 *   - Start recording when sound is detected above 3% threshold
 *   - Stop recording after `silenceMs` milliseconds of silence below 3% threshold
 *   - Hard stop after `maxMs` milliseconds regardless
 *
 * Returns a Buffer containing WAV audio data.
 */
async function recordAudio(maxMs: number, silenceMs: number): Promise<Buffer> {
  const tempDir = join(tmpdir(), "zubo-voice");
  mkdirSync(tempDir, { recursive: true });

  const id = randomUUID().slice(0, 8);
  const outputFile = join(tempDir, `rec-${id}.wav`);

  // Calculate silence duration in seconds for sox
  const silenceSec = (silenceMs / 1000).toFixed(1);
  const maxSec = (maxMs / 1000).toFixed(0);

  // rec command:
  //   -q            quiet (no progress)
  //   -r 16000      16kHz sample rate (whisper standard)
  //   -c 1          mono
  //   -b 16         16-bit
  //   -t wav        WAV format
  //   outputFile    where to write
  //   trim 0 <max>  hard max recording limit
  //   silence 1 0.1 3%   start recording when above 3% for 0.1s
  //   1 <sil> 3%         stop recording after <sil>s below 3%
  const args = [
    "-q",
    "-r",
    "16000",
    "-c",
    "1",
    "-b",
    "16",
    "-t",
    "wav",
    outputFile,
    "trim",
    "0",
    maxSec,
    "silence",
    "1",
    "0.1",
    "3%",
    "1",
    silenceSec,
    "3%",
  ];

  logger.debug("Recording audio", { file: outputFile, maxSec, silenceSec });

  const proc = Bun.spawn(["rec", ...args], {
    stderr: "pipe",
    stdout: "pipe",
  });

  // Set up a hard timeout in case silence detection doesn't trigger
  const timeoutId = setTimeout(() => {
    try {
      proc.kill("SIGTERM");
    } catch {}
  }, maxMs + 2000);

  const exitCode = await proc.exited;
  clearTimeout(timeoutId);

  // exitCode might be non-zero if we killed the process, which is fine
  if (exitCode !== 0 && exitCode !== null) {
    logger.debug("rec exited with code", { exitCode });
  }

  // Read the recorded file
  let audioBuffer: Buffer;
  try {
    if (!existsSync(outputFile)) {
      throw new Error("Recording file not created — microphone may not be available");
    }
    audioBuffer = Buffer.from(readFileSync(outputFile));
  } finally {
    try { unlinkSync(outputFile); } catch {}
  }

  logger.debug("Recorded audio", { bytes: audioBuffer.length });
  return audioBuffer;
}

/**
 * Play an audio buffer through the system speakers.
 *
 * Writes the buffer to a temp file, then plays it using:
 *   - macOS: afplay
 *   - Linux: aplay (WAV) or sox play (other formats)
 *   - Fallback: sox play
 */
async function playAudio(buffer: Buffer, format: string): Promise<void> {
  const tempDir = join(tmpdir(), "zubo-voice");
  mkdirSync(tempDir, { recursive: true });

  const id = randomUUID().slice(0, 8);
  const tempFile = join(tempDir, `play-${id}.${format}`);

  try {
    writeFileSync(tempFile, buffer);

    let proc: ReturnType<typeof Bun.spawn>;

    if (process.platform === "darwin") {
      // macOS: afplay handles mp3, wav, aac, etc.
      proc = Bun.spawn(["afplay", tempFile], {
        stderr: "pipe",
        stdout: "pipe",
      });
    } else if (format === "wav") {
      // Linux: try aplay for WAV
      proc = Bun.spawn(["aplay", "-q", tempFile], {
        stderr: "pipe",
        stdout: "pipe",
      });
    } else {
      // Fallback: sox play
      proc = Bun.spawn(["play", "-q", tempFile], {
        stderr: "pipe",
        stdout: "pipe",
      });
    }

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      logger.warn("Audio playback exited with error", { exitCode, format });
    }
  } finally {
    try {
      if (existsSync(tempFile)) unlinkSync(tempFile);
    } catch {}
  }
}

/**
 * Detect if a transcription is just noise artifacts from whisper.
 * Whisper sometimes hallucinates short phrases for silence/noise.
 */
function isNoiseOnly(text: string): boolean {
  const lower = text.toLowerCase().trim();
  const noisePatterns = [
    /^\[.*\]$/,                          // [BLANK_AUDIO], [Music], etc.
    /^\(.*\)$/,                          // (silence), (noise), etc.
    /^\.+$/,                             // Just dots
    /^(um+|uh+|ah+|oh+|hmm+|hm+)\.?$/i,  // Filler sounds
    /^thank you\.?$/i,                   // Common whisper hallucination
    /^thanks for watching\.?$/i,         // Common whisper hallucination
    /^you$/i,                            // Common whisper hallucination
    /^bye\.?$/i,                         // Too short to be meaningful
  ];
  return noisePatterns.some((p) => p.test(lower));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
