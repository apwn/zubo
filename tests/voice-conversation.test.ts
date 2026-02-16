import { describe, test, expect } from "bun:test";
import { LocalWhisperProvider } from "../src/voice/local-stt";
import { VoiceConversation } from "../src/voice/conversation";

/**
 * Replicate the isNoiseOnly function from conversation.ts since it is not exported.
 * This must stay in sync with the source implementation.
 */
function isNoiseOnly(text: string): boolean {
  const lower = text.toLowerCase().trim();
  const noisePatterns = [
    /^\[.*\]$/,                            // [BLANK_AUDIO], [Music], etc.
    /^\(.*\)$/,                            // (silence), (noise), etc.
    /^\.+$/,                               // Just dots
    /^(um+|uh+|ah+|oh+|hmm+|hm+)\.?$/i,  // Filler sounds
    /^thank you\.?$/i,                     // Common whisper hallucination
    /^thanks for watching\.?$/i,           // Common whisper hallucination
    /^you$/i,                              // Common whisper hallucination
    /^bye\.?$/i,                           // Too short to be meaningful
  ];
  return noisePatterns.some((p) => p.test(lower));
}

describe("Voice Conversation", () => {
  // ── LocalWhisperProvider ──

  describe("LocalWhisperProvider", () => {
    test("constructor accepts config with binaryPath, modelPath, language", () => {
      const provider = new LocalWhisperProvider({
        binaryPath: "/usr/local/bin/whisper",
        modelPath: "/tmp/models/ggml-base.en.bin",
        language: "en",
      });
      expect(provider).toBeDefined();
      expect(provider).toBeInstanceOf(LocalWhisperProvider);
    });

    test("constructor works with empty config (uses defaults)", () => {
      const provider = new LocalWhisperProvider({});
      expect(provider).toBeDefined();
      expect(provider).toBeInstanceOf(LocalWhisperProvider);
    });

    test("constructor works with partial config", () => {
      const provider = new LocalWhisperProvider({ language: "de" });
      expect(provider).toBeDefined();
    });

    test("transcribe is a function", () => {
      const provider = new LocalWhisperProvider({});
      expect(typeof provider.transcribe).toBe("function");
    });
  });

  // ── VoiceConversation class ──

  describe("VoiceConversation", () => {
    test("class exists and can be instantiated with mock callbacks", () => {
      const vc = new VoiceConversation({
        onTranscript: async (text: string) => `Reply to: ${text}`,
      });
      expect(vc).toBeDefined();
      expect(vc).toBeInstanceOf(VoiceConversation);
    });

    test("can be instantiated with all optional callbacks", () => {
      const vc = new VoiceConversation({
        onTranscript: async (text: string) => "agent reply",
        silenceThreshold: 2000,
        maxRecordingMs: 15000,
        onUserText: (text: string) => {},
        onAgentText: (text: string) => {},
        onWarning: (msg: string) => {},
      });
      expect(vc).toBeDefined();
    });

    test("isRunning returns false before start is called", () => {
      const vc = new VoiceConversation({
        onTranscript: async () => "",
      });
      expect(vc.isRunning()).toBe(false);
    });

    test("stop is a function", () => {
      const vc = new VoiceConversation({
        onTranscript: async () => "",
      });
      expect(typeof vc.stop).toBe("function");
    });

    test("start is a function", () => {
      const vc = new VoiceConversation({
        onTranscript: async () => "",
      });
      expect(typeof vc.start).toBe("function");
    });

    test("stop can be called even if not started", () => {
      const vc = new VoiceConversation({
        onTranscript: async () => "",
      });
      // Should not throw
      vc.stop();
      expect(vc.isRunning()).toBe(false);
    });
  });

  // ── Noise filtering (isNoiseOnly) ──

  describe("isNoiseOnly - Whisper hallucination filter", () => {
    describe("should filter out noise / hallucinations", () => {
      test("filters [BLANK_AUDIO]", () => {
        expect(isNoiseOnly("[BLANK_AUDIO]")).toBe(true);
      });

      test("filters [Music]", () => {
        expect(isNoiseOnly("[Music]")).toBe(true);
      });

      test("filters [SOUND]", () => {
        expect(isNoiseOnly("[SOUND]")).toBe(true);
      });

      test("filters (silence)", () => {
        expect(isNoiseOnly("(silence)")).toBe(true);
      });

      test("filters (noise)", () => {
        expect(isNoiseOnly("(noise)")).toBe(true);
      });

      test("filters dots-only strings", () => {
        expect(isNoiseOnly("...")).toBe(true);
        expect(isNoiseOnly(".")).toBe(true);
        expect(isNoiseOnly("..........")).toBe(true);
      });

      test("filters 'Thank you.'", () => {
        expect(isNoiseOnly("Thank you.")).toBe(true);
        expect(isNoiseOnly("Thank you")).toBe(true);
        expect(isNoiseOnly("thank you")).toBe(true);
        expect(isNoiseOnly("THANK YOU.")).toBe(true);
      });

      test("filters 'Thanks for watching.'", () => {
        expect(isNoiseOnly("Thanks for watching.")).toBe(true);
        expect(isNoiseOnly("Thanks for watching")).toBe(true);
        expect(isNoiseOnly("thanks for watching.")).toBe(true);
      });

      test("filters 'you' (common hallucination)", () => {
        expect(isNoiseOnly("you")).toBe(true);
        expect(isNoiseOnly("You")).toBe(true);
      });

      test("filters 'bye'", () => {
        expect(isNoiseOnly("bye")).toBe(true);
        expect(isNoiseOnly("Bye.")).toBe(true);
        expect(isNoiseOnly("BYE")).toBe(true);
      });

      test("filters single-word filler sounds", () => {
        expect(isNoiseOnly("um")).toBe(true);
        expect(isNoiseOnly("umm")).toBe(true);
        expect(isNoiseOnly("ummm")).toBe(true);
        expect(isNoiseOnly("uh")).toBe(true);
        expect(isNoiseOnly("uhh")).toBe(true);
        expect(isNoiseOnly("ah")).toBe(true);
        expect(isNoiseOnly("ahh")).toBe(true);
        expect(isNoiseOnly("oh")).toBe(true);
        expect(isNoiseOnly("ohh")).toBe(true);
        expect(isNoiseOnly("hmm")).toBe(true);
        expect(isNoiseOnly("hmmm")).toBe(true);
        expect(isNoiseOnly("hm")).toBe(true);
      });

      test("filters filler sounds with trailing period", () => {
        expect(isNoiseOnly("um.")).toBe(true);
        expect(isNoiseOnly("uh.")).toBe(true);
        expect(isNoiseOnly("hmm.")).toBe(true);
      });

      test("filters are case-insensitive", () => {
        expect(isNoiseOnly("UM")).toBe(true);
        expect(isNoiseOnly("Uh")).toBe(true);
        expect(isNoiseOnly("AH")).toBe(true);
        expect(isNoiseOnly("HMM")).toBe(true);
      });
    });

    describe("should allow real speech through", () => {
      test("allows normal sentences", () => {
        expect(isNoiseOnly("What is the weather today?")).toBe(false);
      });

      test("allows short real words", () => {
        expect(isNoiseOnly("yes")).toBe(false);
        expect(isNoiseOnly("no")).toBe(false);
        expect(isNoiseOnly("hello")).toBe(false);
      });

      test("allows 'thank you' embedded in a longer phrase", () => {
        expect(isNoiseOnly("Thank you for helping me")).toBe(false);
      });

      test("allows sentences containing brackets but not fully wrapped", () => {
        expect(isNoiseOnly("I said [hello] to them")).toBe(false);
      });

      test("allows multi-word phrases", () => {
        expect(isNoiseOnly("Please set a reminder")).toBe(false);
      });

      test("allows numbers and real content", () => {
        expect(isNoiseOnly("Call 555-1234")).toBe(false);
      });

      test("allows 'goodbye' (distinct from 'bye')", () => {
        expect(isNoiseOnly("goodbye")).toBe(false);
      });

      test("allows 'thanks' alone (not hallucination pattern)", () => {
        expect(isNoiseOnly("thanks")).toBe(false);
      });
    });
  });
});
