import type { ZuboConfig } from "../config/schema";
import type { MessageRouter } from "./router";
import { logger } from "../util/logger";

/** Stopper functions keyed by channel name */
const stoppers = new Map<string, () => void>();

/**
 * Dynamically start a single channel by name using the current config.
 * Handles import, adapter creation, router registration, and tracking.
 * Returns true if successfully started.
 */
export async function startChannel(
  name: string,
  config: ZuboConfig,
  router: MessageRouter
): Promise<boolean> {
  // If already running, stop first
  if (stoppers.has(name)) {
    await stopChannel(name, router);
  }

  try {
    switch (name) {
      case "telegram": {
        const tgToken =
          (config.channels?.telegram?.botToken) ||
          config.telegramBotToken;
        if (!tgToken) return false;
        const { createTelegramAdapter } = await import("./telegram");
        const tgConfig = {
          ...config,
          telegramBotToken: tgToken,
          telegramAllowedUsers:
            config.channels?.telegram?.allowedUsers ??
            config.telegramAllowedUsers ??
            [],
        };
        const adapter = createTelegramAdapter(tgToken, tgConfig, router);
        router.addAdapter(adapter);
        adapter.start();
        stoppers.set(name, () => adapter.stop());
        logger.info("Telegram channel started");
        return true;
      }

      case "discord": {
        const dc = config.channels?.discord;
        if (!dc?.botToken) return false;
        const { createDiscordAdapter } = await import("./discord");
        const adapter = createDiscordAdapter(
          dc.botToken,
          dc.allowedUsers ?? [],
          router
        );
        router.addAdapter(adapter);
        adapter.start();
        stoppers.set(name, () => adapter.stop());
        logger.info("Discord channel started");
        return true;
      }

      case "slack": {
        const sl = config.channels?.slack;
        if (!sl?.botToken) return false;
        const { createSlackAdapter } = await import("./slack");
        const adapter = createSlackAdapter(
          sl.botToken,
          sl.appToken,
          sl.allowedUsers ?? [],
          router
        );
        router.addAdapter(adapter);
        adapter.start();
        stoppers.set(name, () => adapter.stop());
        logger.info("Slack channel started");
        return true;
      }

      case "whatsapp": {
        const wa = config.channels?.whatsapp;
        if (!wa) return false;
        const { createWhatsAppAdapter } = await import("./whatsapp");
        const adapter = createWhatsAppAdapter(
          wa.allowedNumbers ?? [],
          wa.authDir,
          router
        );
        router.addAdapter(adapter);
        adapter.start();
        stoppers.set(name, () => adapter.stop());
        logger.info("WhatsApp channel started");
        return true;
      }

      case "signal": {
        const sig = config.channels?.signal;
        if (!sig?.phoneNumber) return false;
        const { createSignalAdapter } = await import("./signal");
        const adapter = createSignalAdapter(
          sig.phoneNumber,
          sig.allowedNumbers ?? [],
          sig.signalCliPath,
          router
        );
        router.addAdapter(adapter);
        adapter.start();
        stoppers.set(name, () => adapter.stop());
        logger.info("Signal channel started");
        return true;
      }

      case "email": {
        const em = config.channels?.email;
        if (!em?.imap?.host) return false;
        const { createEmailAdapter } = await import("./email");
        const adapter = createEmailAdapter(em as any, router);
        router.addAdapter(adapter);
        adapter.start();
        stoppers.set(name, () => adapter.stop());
        logger.info("Email channel started");
        return true;
      }

      default:
        logger.warn(`Unknown channel: ${name}`);
        return false;
    }
  } catch (err: any) {
    logger.error(`Failed to start channel "${name}"`, { error: err.message });
    return false;
  }
}

/**
 * Stop a running channel by name.
 */
export async function stopChannel(
  name: string,
  router: MessageRouter
): Promise<boolean> {
  const stopper = stoppers.get(name);
  if (stopper) {
    try {
      stopper();
    } catch (err: any) {
      logger.warn(`Error stopping channel "${name}"`, { error: err.message });
    }
    stoppers.delete(name);
  }
  router.removeAdapter(name);
  logger.info(`Channel "${name}" stopped`);
  return true;
}

/**
 * Get list of currently running channel names (excluding webchat).
 */
export function getRunningChannels(): string[] {
  return Array.from(stoppers.keys());
}
