// Type declarations for optional channel dependencies.
// These modules are dynamically imported and gracefully handle missing packages.
declare module "@slack/bolt" {
  export class App {
    constructor(options: any);
    message(handler: (args: any) => Promise<void>): void;
    event(name: string, handler: (args: any) => Promise<void>): void;
    start(): Promise<void>;
    stop(): Promise<void>;
  }
}

declare module "@whiskeysockets/baileys" {
  export default function makeWASocket(options: any): any;
  export function useMultiFileAuthState(path: string): Promise<{ state: any; saveCreds: () => Promise<void> }>;
  export const DisconnectReason: { loggedOut: number };
}
