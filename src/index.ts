#!/usr/bin/env bun
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
    const { startZubo } = await import("./start");
    await startZubo(isDaemon);
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
  case "model": {
    const { runModelCommand } = await import("./model");
    runModelCommand(process.argv.slice(3));
    break;
  }
  case "skills": {
    const { runSkillsCommand } = await import("./skills");
    await runSkillsCommand(process.argv.slice(3));
    break;
  }
  case "install": {
    const skillName = process.argv[3];
    if (!skillName) {
      console.log("Usage: zubo install <skill-name>");
      process.exit(1);
    }
    const { handleRegistryInstall } = await import("./registry/cli");
    await handleRegistryInstall(skillName);
    break;
  }
  case "search": {
    const query = process.argv.slice(3).join(" ");
    if (!query) {
      console.log("Usage: zubo search <query>");
      process.exit(1);
    }
    const { handleRegistrySearch } = await import("./registry/cli");
    await handleRegistrySearch(query);
    break;
  }
  case "publish": {
    const pubName = process.argv[3] ?? "";
    const { handleRegistryPublish } = await import("./registry/cli");
    await handleRegistryPublish(pubName);
    break;
  }
  default:
    console.log("Usage: zubo <command>\n");
    console.log("Commands:");
    console.log("  setup              Configure Zubo (API keys, Telegram token)");
    console.log("  start              Start the Zubo agent");
    console.log("  start --daemon     Start in background");
    console.log("  stop               Stop the background daemon");
    console.log("  status             Show config and runtime status");
    console.log("  logs               Show last 50 log lines");
    console.log("  logs --follow      Stream logs live");
    console.log("  model              Show active LLM provider/model");
    console.log("  model <p/m>        Switch provider/model (e.g. ollama/llama3.3)");
    console.log("  model --list       List all configured providers");
    console.log("  skills             Manage skills (interactive menu)");
    console.log("  skills list        List installed skills");
    console.log("  skills new         Create a new skill");
    console.log("  skills reinstall   Reinstall built-in skills");
    console.log("  skills remove      Remove a skill");
    console.log("  install <skill>    Install a skill from the registry");
    console.log("  search <query>     Search the skill registry");
    console.log("  publish            How to publish a skill");
    process.exit(1);
}
