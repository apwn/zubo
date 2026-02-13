import { logger } from "../util/logger";

export interface TtsProvider {
  synthesize(text: string): Promise<Buffer>;
  format: string;
}

export class OpenAiTtsProvider implements TtsProvider {
  private apiKey: string;
  private model: string;
  private voice: string;
  format = "mp3";

  constructor(apiKey: string, voice: string = "alloy", model: string = "tts-1") {
    this.apiKey = apiKey;
    this.voice = voice;
    this.model = model;
  }

  async synthesize(text: string): Promise<Buffer> {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        input: text,
        voice: this.voice,
        response_format: "mp3",
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI TTS error ${res.status}: ${errText}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    logger.debug("TTS synthesis complete", { bytes: arrayBuffer.byteLength });
    return Buffer.from(arrayBuffer);
  }
}

export class ElevenLabsTtsProvider implements TtsProvider {
  private apiKey: string;
  private voice: string;
  format = "mp3";

  constructor(apiKey: string, voice: string = "21m00Tcm4TlvDq8ikWAM") {
    this.apiKey = apiKey;
    this.voice = voice;
  }

  async synthesize(text: string): Promise<Buffer> {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${this.voice}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": this.apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_monolingual_v1",
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`ElevenLabs TTS error ${res.status}: ${errText}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    logger.debug("ElevenLabs TTS complete", { bytes: arrayBuffer.byteLength });
    return Buffer.from(arrayBuffer);
  }
}

let ttsProvider: TtsProvider | null = null;

export function initTts(config: { provider: string; apiKey: string; voice?: string }): void {
  switch (config.provider) {
    case "openai":
      ttsProvider = new OpenAiTtsProvider(config.apiKey, config.voice);
      logger.info("TTS initialized: OpenAI");
      break;
    case "elevenlabs":
      ttsProvider = new ElevenLabsTtsProvider(config.apiKey, config.voice);
      logger.info("TTS initialized: ElevenLabs");
      break;
    default:
      logger.warn(`Unknown TTS provider: "${config.provider}". Supported: openai, elevenlabs`);
  }
}

export function getTtsProvider(): TtsProvider | null {
  return ttsProvider;
}
