import { tmpdir, homedir } from "os";
import { join } from "path";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { randomUUID } from "crypto";
import type { SttProvider } from "./stt";
import { logger } from "../util/logger";

/**
 * LocalWhisperProvider uses a local whisper.cpp binary for speech-to-text.
 *
 * Prerequisites:
 *   1. Install whisper.cpp: https://github.com/ggerganov/whisper.cpp
 *   2. Download a model:  ./models/download-ggml-model.sh base.en
 *   3. Provide the binary path and model path in config, or place them at default locations.
 *
 * Default binary: "whisper" (must be on PATH)
 * Default model:  ~/.zubo/models/ggml-base.en.bin
 */
export class LocalWhisperProvider implements SttProvider {
  private binaryPath: string;
  private modelPath: string;
  private language: string;

  constructor(opts: { binaryPath?: string; modelPath?: string; language?: string }) {
    this.binaryPath = opts.binaryPath || "whisper";
    this.modelPath =
      opts.modelPath || join(homedir(), ".zubo", "models", "ggml-base.en.bin");
    this.language = opts.language || "en";
  }

  async transcribe(audioBuffer: Buffer, format: string = "wav"): Promise<string> {
    // Validate model file exists
    if (!existsSync(this.modelPath)) {
      throw new Error(
        `Whisper model not found at ${this.modelPath}. ` +
          `Download one from https://github.com/ggerganov/whisper.cpp#quick-start ` +
          `or set voice.stt.modelPath in config.`
      );
    }

    // Create temp directory for this transcription
    const tempDir = join(tmpdir(), "zubo-stt");
    mkdirSync(tempDir, { recursive: true });

    const id = randomUUID().slice(0, 8);
    const inputFile = join(tempDir, `input-${id}.wav`);
    const outputBase = join(tempDir, `input-${id}`);
    const outputTxtFile = `${outputBase}.txt`;

    try {
      // If the input is not WAV, convert it to 16kHz mono WAV using sox/ffmpeg
      if (format !== "wav") {
        const rawInputFile = join(tempDir, `raw-${id}.${format}`);
        writeFileSync(rawInputFile, audioBuffer);

        // Try ffmpeg first, then sox
        const convertProc = Bun.spawnSync(
          [
            "ffmpeg",
            "-y",
            "-i",
            rawInputFile,
            "-ar",
            "16000",
            "-ac",
            "1",
            "-sample_fmt",
            "s16",
            inputFile,
          ],
          { stderr: "pipe" }
        );

        if (convertProc.exitCode !== 0) {
          // Fallback to sox
          const soxProc = Bun.spawnSync(
            ["sox", rawInputFile, "-r", "16000", "-c", "1", "-b", "16", inputFile],
            { stderr: "pipe" }
          );
          if (soxProc.exitCode !== 0) {
            throw new Error(
              `Failed to convert audio from ${format} to WAV. Install ffmpeg or sox.`
            );
          }
        }

        try {
          unlinkSync(rawInputFile);
        } catch {}
      } else {
        writeFileSync(inputFile, audioBuffer);
      }

      // Run whisper.cpp
      // whisper.cpp main binary usage:
      //   ./main -m <model> -f <wav_file> --output-txt --no-timestamps -l <lang>
      const args = [
        "-m",
        this.modelPath,
        "-f",
        inputFile,
        "--output-txt",
        "--no-timestamps",
        "-l",
        this.language,
      ];

      logger.debug("Running local whisper", {
        binary: this.binaryPath,
        args: args.join(" "),
      });

      const proc = Bun.spawnSync([this.binaryPath, ...args], {
        stderr: "pipe",
        stdout: "pipe",
        cwd: tempDir,
      });

      if (proc.exitCode !== 0) {
        const stderr = proc.stderr.toString();
        throw new Error(
          `Whisper.cpp exited with code ${proc.exitCode}: ${stderr.slice(0, 500)}`
        );
      }

      // whisper.cpp writes output to <inputfile>.txt
      let transcription = "";

      if (existsSync(outputTxtFile)) {
        transcription = readFileSync(outputTxtFile, "utf-8").trim();
      } else {
        // Some whisper.cpp builds print to stdout instead
        transcription = proc.stdout.toString().trim();

        // Strip timestamp lines if present: [00:00:00.000 --> 00:00:03.000] text
        transcription = transcription
          .split("\n")
          .map((line) => line.replace(/^\[[\d:.]+\s*-->\s*[\d:.]+\]\s*/, ""))
          .filter((line) => line.length > 0)
          .join(" ")
          .trim();
      }

      logger.debug("Local STT transcription", { length: transcription.length });
      return transcription;
    } finally {
      // Clean up temp files
      for (const f of [inputFile, outputTxtFile]) {
        try {
          if (existsSync(f)) unlinkSync(f);
        } catch {}
      }
    }
  }
}
