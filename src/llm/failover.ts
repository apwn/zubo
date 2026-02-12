import type { LlmProvider, LlmRequest, LlmResponse } from "./provider";
import { logger } from "../util/logger";

export class FailoverProvider implements LlmProvider {
  providerName: string;
  model: string;

  constructor(
    private primary: LlmProvider,
    private fallbacks: LlmProvider[]
  ) {
    this.providerName = primary.providerName;
    this.model = primary.model;
  }

  async chat(request: LlmRequest): Promise<LlmResponse> {
    try {
      return await this.primary.chat(request);
    } catch (err: any) {
      logger.warn(`Primary provider (${this.primary.providerName}) failed`, {
        error: err.message,
      });

      for (const fb of this.fallbacks) {
        try {
          logger.info(`Trying fallback: ${fb.providerName}/${fb.model}`);
          const result = await fb.chat(request);
          this.providerName = fb.providerName;
          this.model = fb.model;
          return result;
        } catch (fbErr: any) {
          logger.warn(`Fallback ${fb.providerName} also failed`, {
            error: fbErr.message,
          });
        }
      }

      throw new Error(
        `All providers failed. Primary: ${err.message}`
      );
    }
  }
}
