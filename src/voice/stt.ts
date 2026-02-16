import { logger } from "../util/logger";
import { LocalWhisperProvider } from "./local-stt";

export interface SttProvider {
  transcribe(audioBuffer: Buffer, format?: string): Promise<string>;
}

export class WhisperApiProvider implements SttProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = "whisper-1") {
    this.apiKey = apiKey;
    this.model = model;
  }

  async transcribe(audioBuffer: Buffer, format: string = "webm"): Promise<string> {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(audioBuffer)], { type: `audio/${format}` });
    formData.append("file", blob, `audio.${format}`);
    formData.append("model", this.model);

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Whisper API error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as { text: string };
    logger.debug("STT transcription", { length: data.text.length });
    return data.text;
  }
}

let sttProvider: SttProvider | null = null;

export function initStt(config: {
  provider: string;
  apiKey?: string;
  model?: string;
  binaryPath?: string;
  modelPath?: string;
  language?: string;
}): void {
  switch (config.provider) {
    case "whisper":
    case "openai":
      if (!config.apiKey) {
        logger.warn("STT provider 'whisper' (cloud) requires an apiKey");
        return;
      }
      sttProvider = new WhisperApiProvider(config.apiKey, config.model);
      logger.info("STT initialized: Whisper API (cloud)");
      break;
    case "local":
    case "whisper-local":
    case "whisper.cpp":
      sttProvider = new LocalWhisperProvider({
        binaryPath: config.binaryPath,
        modelPath: config.modelPath,
        language: config.language,
      });
      logger.info("STT initialized: Local Whisper (whisper.cpp)");
      break;
    default:
      logger.warn(
        `Unknown STT provider: "${config.provider}". Supported: whisper, openai, local, whisper-local`
      );
  }
}

export function getSttProvider(): SttProvider | null {
  return sttProvider;
}
