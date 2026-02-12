import { z } from "zod";

const providerConfigSchema = z.object({
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  model: z.string(),
  streaming: z.boolean().optional(),
});

export type ProviderConfig = z.infer<typeof providerConfigSchema>;

export const configSchema = z.object({
  // Legacy fields (still work for backward compat)
  anthropicApiKey: z.string().optional(),
  model: z.string().optional(),

  // Multi-provider system
  providers: z.record(z.string(), providerConfigSchema).optional(),
  activeProvider: z.string().optional(),
  failover: z.array(z.string()).optional(),

  // Telegram
  telegramBotToken: z.string().min(1),
  telegramAllowedUsers: z.array(z.number()).default([]),

  // Agent
  maxTurns: z.number().default(50),
  createdAt: z.string().default(() => new Date().toISOString()),
});

export type OrbaConfig = z.infer<typeof configSchema>;
