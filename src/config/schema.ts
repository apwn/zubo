import { z } from "zod";

export const configSchema = z.object({
  anthropicApiKey: z.string().min(1),
  telegramBotToken: z.string().min(1),
  telegramAllowedUsers: z.array(z.number()).default([]),
  model: z.string().default("claude-sonnet-4-5-20250929"),
  maxTurns: z.number().default(50),
  createdAt: z.string().default(() => new Date().toISOString()),
});

export type OrbaConfig = z.infer<typeof configSchema>;
