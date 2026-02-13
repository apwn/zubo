# Zubo — Dockerfile
# Runs the Zubo AI agent using the official Bun runtime image.
# Persistent data (config, database, memory, skills) lives in /root/.zubo
# and should be mounted as a volume.

FROM oven/bun:1

WORKDIR /app

# Install dependencies first (layer cache optimisation)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy the rest of the project
COPY . .

# Webchat dashboard port
EXPOSE 8787

# Persistent storage mount point — config.json, zubo.db, workspace, logs, etc.
VOLUME /root/.zubo

# Start the agent
CMD ["bun", "run", "src/index.ts", "start"]
