export {};

const command = process.argv[2];

switch (command) {
  case "setup": {
    const { runSetup } = await import("./setup");
    await runSetup();
    break;
  }
  case "start": {
    const { startOrba } = await import("./start");
    await startOrba();
    break;
  }
  default:
    console.log("Usage: bun run src/index.ts <setup|start>");
    console.log("  setup  - Configure Orba (API keys, Telegram token)");
    console.log("  start  - Start the Orba agent");
    process.exit(1);
}
