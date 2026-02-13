import { InferenceSession, Tensor } from "onnxruntime-node";
import { paths } from "../config/paths";
import { join } from "path";
import { existsSync } from "fs";
import { logger } from "../util/logger";

const MODEL_NAME = "all-MiniLM-L6-v2";
const MODEL_URL = `https://huggingface.co/sentence-transformers/${MODEL_NAME}/resolve/main/onnx/model.onnx`;
const TOKENIZER_URL = `https://huggingface.co/sentence-transformers/${MODEL_NAME}/resolve/main/tokenizer.json`;
const EMBEDDING_DIM = 384;

let session: InferenceSession | null = null;
let vocab: Map<string, number> | null = null;

async function downloadFile(url: string, dest: string) {
  if (existsSync(dest)) return;
  logger.info(`Downloading ${url}...`);
  const resp = await fetch(url, { redirect: "follow" });
  if (!resp.ok) throw new Error(`Failed to download ${url}: ${resp.status}`);
  const contentLength = resp.headers.get("content-length");
  if (contentLength) {
    logger.info(`Download size: ${(Number(contentLength) / 1024 / 1024).toFixed(1)} MB`);
  }
  const buffer = await resp.arrayBuffer();
  await Bun.write(dest, buffer);
  logger.info(`Saved to ${dest} (${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB)`);
}

async function ensureModel(): Promise<string> {
  const modelDir = join(paths.models, MODEL_NAME);
  Bun.spawnSync(["mkdir", "-p", modelDir]);

  const modelPath = join(modelDir, "model.onnx");
  const tokenizerPath = join(modelDir, "tokenizer.json");

  await Promise.all([
    downloadFile(MODEL_URL, modelPath),
    downloadFile(TOKENIZER_URL, tokenizerPath),
  ]);

  return modelDir;
}

/**
 * WordPiece tokenization matching BERT/MiniLM expectations.
 * 1. Lowercase + strip accents
 * 2. Split on whitespace and punctuation
 * 3. For each word, greedily match longest vocab prefix, then continue with ## prefixed subwords
 */
function wordPieceTokenize(
  text: string,
  vocabMap: Map<string, number>,
  maxLen: number = 128
): { inputIds: number[]; attentionMask: number[] } {
  const CLS = vocabMap.get("[CLS]") ?? 101;
  const SEP = vocabMap.get("[SEP]") ?? 102;
  const UNK = vocabMap.get("[UNK]") ?? 100;
  const PAD = vocabMap.get("[PAD]") ?? 0;

  // Basic pre-tokenization: lowercase, split on whitespace and punctuation
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // strip accents

  // Split into words, keeping punctuation as separate tokens
  const words = normalized.match(/[a-z0-9]+|[^\s\w]/g) || [];

  const tokens: number[] = [CLS];

  for (const word of words) {
    if (tokens.length >= maxLen - 1) break;

    // WordPiece: greedily match longest subword from vocab
    let start = 0;
    let isBad = false;
    const subTokens: number[] = [];

    while (start < word.length) {
      let end = word.length;
      let found = false;

      while (start < end) {
        let substr = word.slice(start, end);
        if (start > 0) substr = "##" + substr;

        const id = vocabMap.get(substr);
        if (id !== undefined) {
          subTokens.push(id);
          found = true;
          break;
        }
        end--;
      }

      if (!found) {
        isBad = true;
        break;
      }
      start = end;
    }

    if (isBad) {
      tokens.push(UNK);
    } else {
      for (const st of subTokens) {
        if (tokens.length >= maxLen - 1) break;
        tokens.push(st);
      }
    }
  }

  tokens.push(SEP);

  const attentionMask = new Array(maxLen).fill(0);
  for (let i = 0; i < tokens.length; i++) attentionMask[i] = 1;

  while (tokens.length < maxLen) tokens.push(PAD);

  return { inputIds: tokens, attentionMask };
}

async function loadVocab(modelDir: string): Promise<Map<string, number>> {
  const tokenizerPath = join(modelDir, "tokenizer.json");
  const raw = await Bun.file(tokenizerPath).json();
  const map = new Map<string, number>();

  if (raw.model?.vocab) {
    for (const [token, id] of Object.entries(raw.model.vocab)) {
      map.set(token, id as number);
    }
  }

  return map;
}

export async function initEmbedder(): Promise<boolean> {
  try {
    const modelDir = await ensureModel();
    const modelPath = join(modelDir, "model.onnx");

    // Dispose existing session to prevent memory leak on re-initialization
    if (session) {
      try { (session as any).dispose?.(); } catch { /* ignore */ }
    }

    session = await InferenceSession.create(modelPath, {
      executionProviders: ["cpu"],
    });
    vocab = await loadVocab(modelDir);

    logger.info("Embedder initialized", {
      model: MODEL_NAME,
      dim: EMBEDDING_DIM,
      vocabSize: vocab.size,
    });
    return true;
  } catch (err: any) {
    logger.warn("Failed to initialize embedder, falling back to FTS-only", {
      error: err.message,
    });
    return false;
  }
}

export async function embed(text: string): Promise<Float32Array | null> {
  if (!session || !vocab) return null;

  const { inputIds, attentionMask } = wordPieceTokenize(text, vocab);
  const seqLen = inputIds.length;

  const inputIdsTensor = new Tensor(
    "int64",
    BigInt64Array.from(inputIds.map(BigInt)),
    [1, seqLen]
  );
  const attentionMaskTensor = new Tensor(
    "int64",
    BigInt64Array.from(attentionMask.map(BigInt)),
    [1, seqLen]
  );
  const tokenTypeIds = new Tensor(
    "int64",
    new BigInt64Array(seqLen),
    [1, seqLen]
  );

  const feeds: Record<string, Tensor> = {
    input_ids: inputIdsTensor,
    attention_mask: attentionMaskTensor,
    token_type_ids: tokenTypeIds,
  };

  const output = await session.run(feeds);

  const lastHidden = output["last_hidden_state"];
  if (!lastHidden) return null;

  const data = lastHidden.data as Float32Array;
  const embedding = new Float32Array(EMBEDDING_DIM);

  // Mean pooling over non-padding tokens
  let count = 0;
  for (let i = 0; i < seqLen; i++) {
    if (attentionMask[i] === 1) {
      for (let j = 0; j < EMBEDDING_DIM; j++) {
        embedding[j] += data[i * EMBEDDING_DIM + j];
      }
      count++;
    }
  }
  for (let j = 0; j < EMBEDDING_DIM; j++) {
    embedding[j] /= count;
  }

  // L2 normalize
  let norm = 0;
  for (let j = 0; j < EMBEDDING_DIM; j++) norm += embedding[j] * embedding[j];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let j = 0; j < EMBEDDING_DIM; j++) embedding[j] /= norm;
  }

  return embedding;
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // Already L2-normalized, so dot product = cosine similarity
}

export function isEmbedderReady(): boolean {
  return session !== null && vocab !== null;
}
