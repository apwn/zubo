import { mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const GENERATED_DIR = join(homedir(), ".zubo", "uploads", "generated");

interface ImageGenConfig {
  provider: string;
  apiKey: string;
  model?: string;
  defaultSize?: string;
}

function getConfig(): ImageGenConfig {
  const configPath = join(homedir(), ".zubo", "config.json");
  try {
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    const ig = config.imageGeneration;
    if (!ig?.provider) {
      throw new Error("Image generation not configured. Add imageGeneration.provider and apiKey to your config.");
    }

    // Try to find API key from provider config if not set directly
    let apiKey = ig.apiKey;
    if (!apiKey && config.providers?.[ig.provider]?.apiKey) {
      apiKey = config.providers[ig.provider].apiKey;
    }
    if (!apiKey && ig.provider === "openai" && config.providers?.openai?.apiKey) {
      apiKey = config.providers.openai.apiKey;
    }
    if (!apiKey) {
      throw new Error(`No API key found for image generation provider "${ig.provider}". Set imageGeneration.apiKey in config.`);
    }

    return {
      provider: ig.provider,
      apiKey,
      model: ig.model,
      defaultSize: ig.defaultSize,
    };
  } catch (err: any) {
    if (err.message?.includes("not configured") || err.message?.includes("No API key")) throw err;
    throw new Error("Failed to read image generation config: " + err.message);
  }
}

async function generateOpenAI(config: ImageGenConfig, prompt: string, size: string, style: string, n: number): Promise<string[]> {
  const model = config.model || "dall-e-3";
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt,
      n: model === "dall-e-3" ? 1 : Math.min(n, 4),
      size,
      style,
      response_format: "b64_json",
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI image generation failed (${res.status}): ${err.slice(0, 300)}`);
  }

  const data = await res.json() as { data: { b64_json: string }[] };
  return data.data.map(d => d.b64_json);
}

async function generateFal(config: ImageGenConfig, prompt: string, size: string, n: number): Promise<string[]> {
  const model = config.model || "fal-ai/flux-pro/v1.1";
  const [width, height] = size.split("x").map(Number);

  const res = await fetch(`https://fal.run/${model}`, {
    method: "POST",
    headers: {
      "Authorization": `Key ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      image_size: { width: width || 1024, height: height || 1024 },
      num_images: Math.min(n, 4),
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`fal.ai image generation failed (${res.status}): ${err.slice(0, 300)}`);
  }

  const data = await res.json() as { images: { url: string }[] };
  // Download images and convert to base64
  const results: string[] = [];
  for (const img of data.images) {
    const imgRes = await fetch(img.url, { signal: AbortSignal.timeout(30000) });
    const buf = Buffer.from(await imgRes.arrayBuffer());
    results.push(buf.toString("base64"));
  }
  return results;
}

async function generateTogether(config: ImageGenConfig, prompt: string, size: string, n: number): Promise<string[]> {
  const model = config.model || "black-forest-labs/FLUX.1-schnell-Free";
  const [width, height] = size.split("x").map(Number);

  const res = await fetch("https://api.together.xyz/v1/images/generations", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt,
      n: Math.min(n, 4),
      width: width || 1024,
      height: height || 1024,
      response_format: "b64_json",
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Together AI image generation failed (${res.status}): ${err.slice(0, 300)}`);
  }

  const data = await res.json() as { data: { b64_json: string }[] };
  return data.data.map(d => d.b64_json);
}

export default async function (input: Record<string, unknown>): Promise<string> {
  const prompt = input.prompt as string;
  if (!prompt) throw new Error("'prompt' is required.");
  if (prompt.length > 4000) throw new Error("Prompt too long (max 4000 characters).");

  const config = getConfig();
  const size = (input.size as string) || config.defaultSize || "1024x1024";
  const style = (input.style as string) || "vivid";
  const n = Math.min(Math.max((input.n as number) || 1, 1), 4);

  let b64Images: string[];

  switch (config.provider) {
    case "openai":
      b64Images = await generateOpenAI(config, prompt, size, style, n);
      break;
    case "fal":
      b64Images = await generateFal(config, prompt, size, n);
      break;
    case "together":
      b64Images = await generateTogether(config, prompt, size, n);
      break;
    default:
      throw new Error(`Unknown provider: "${config.provider}". Use openai, fal, or together.`);
  }

  // Save images to disk
  mkdirSync(GENERATED_DIR, { recursive: true });
  const savedPaths: string[] = [];

  for (let i = 0; i < b64Images.length; i++) {
    const filename = `img_${Date.now()}_${i}.png`;
    const filePath = join(GENERATED_DIR, filename);
    writeFileSync(filePath, Buffer.from(b64Images[i], "base64"));
    savedPaths.push(filePath);
  }

  return JSON.stringify({
    generated: savedPaths.length,
    files: savedPaths,
    prompt: prompt.slice(0, 100),
    provider: config.provider,
  });
}
