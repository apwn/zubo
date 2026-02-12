export default async function (input: Record<string, unknown>): Promise<string> {
  const command = input.command as string;
  const timeout = (input.timeout as number) || 30000;

  const proc = Bun.spawn(["sh", "-c", command], {
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env },
  });

  // Set up timeout
  const timer = setTimeout(() => {
    try {
      proc.kill();
    } catch {}
  }, timeout);

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  clearTimeout(timer);

  return JSON.stringify({
    exitCode,
    stdout: stdout.slice(0, 50000),
    stderr: stderr.slice(0, 10000),
  });
}
