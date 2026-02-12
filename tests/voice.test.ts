import { describe, it, expect } from "bun:test";
import type { SttProvider } from "../src/voice/stt";
import type { TtsProvider } from "../src/voice/tts";

describe("Voice", () => {
  describe("STT provider interface", () => {
    it("should define the SttProvider interface correctly", () => {
      // Verify the interface by creating a mock implementation
      const mockStt: SttProvider = {
        async transcribe(audioBuffer: Buffer, format?: string): Promise<string> {
          return "test transcription";
        },
      };

      expect(typeof mockStt.transcribe).toBe("function");
    });

    it("should have a whisper provider class", async () => {
      const { WhisperApiProvider } = await import("../src/voice/stt");
      const provider = new WhisperApiProvider("test-key");
      expect(typeof provider.transcribe).toBe("function");
    });
  });

  describe("TTS provider interface", () => {
    it("should define the TtsProvider interface correctly", () => {
      const mockTts: TtsProvider = {
        format: "mp3",
        async synthesize(text: string): Promise<Buffer> {
          return Buffer.from("audio-data");
        },
      };

      expect(typeof mockTts.synthesize).toBe("function");
      expect(mockTts.format).toBe("mp3");
    });

    it("should have OpenAI and ElevenLabs provider classes", async () => {
      const { OpenAiTtsProvider, ElevenLabsTtsProvider } = await import("../src/voice/tts");
      const openai = new OpenAiTtsProvider("test-key");
      expect(openai.format).toBe("mp3");

      const eleven = new ElevenLabsTtsProvider("test-key");
      expect(eleven.format).toBe("mp3");
    });
  });

  describe("Voice endpoint content-type", () => {
    it("should accept audio/webm format indicator", () => {
      // Verify that the STT interface accepts format parameter
      const mockStt: SttProvider = {
        async transcribe(audioBuffer: Buffer, format?: string): Promise<string> {
          expect(format).toBe("webm");
          return "transcribed text";
        },
      };
      mockStt.transcribe(Buffer.from(""), "webm");
    });
  });
});
