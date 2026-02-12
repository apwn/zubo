export interface InboundAttachment {
  filename: string;
  mimeType: string;
  size: number;
  filePath: string;
}

export interface InboundMessage {
  channel: string;
  userId: string;
  sessionKey: string;
  text: string;
  attachments?: InboundAttachment[];
}

export interface ChannelAdapter {
  channelName: string;
  start(): void;
  stop(): void;
  sendMessage(sessionKey: string, text: string): Promise<void>;
}
