export {};

const command = process.argv[2];

switch (command) {
  case "setup": {
    const { runSetup } = await import("./setup");
    await runSetup();
    break;
  }
  case "start": {
    const isDaemon = process.argv.includes("--daemon");
    const { startOrba } = await import("./start");
    await startOrba(isDaemon);
    break;
  }
  case "stop": {
    const { stopDaemon } = await import("./start");
    stopDaemon();
    break;
  }
  case "status": {
    const { showStatus } = await import("./status");
    showStatus();
    break;
  }
  case "logs": {
    const follow = process.argv.includes("--follow") || process.argv.includes("-f");
    const { showLogs } = await import("./logs");
    await showLogs(follow);
    break;
  }
  default:
    console.log("Usage: bun run src/index.ts <command>\n");
    console.log("Commands:");
    console.log("  setup              Configure Orba (API keys, Telegram token)");
    console.log("  start              Start the Orba agent");
    console.log("  start --daemon     Start in background");
    console.log("  stop               Stop the background daemon");
    console.log("  status             Show config and runtime status");
    console.log("  logs               Show last 50 log lines");
    console.log("  logs --follow      Stream logs live");
    process.exit(1);
}
