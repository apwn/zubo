export interface InboundMessage {
  channel: string;
  userId: string;
  sessionKey: string;
  text: string;
}

export interface ChannelAdapter {
  start(): void;
  stop(): void;
  sendMessage(sessionKey: string, text: string): Promise<void>;
}
