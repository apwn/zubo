async function safeApiError(res: Response, service: string): Promise<string> {
  const body = await res.text().catch(() => "");
  console.error(`[${service}] API error ${res.status}: ${body.slice(0, 500)}`);
  return JSON.stringify({ error: `${service} API error: ${res.status} ${res.statusText}` });
}

function safeExceptionError(err: any, service: string): string {
  console.error(`[${service}] Request failed: ${err.message}`);
  return JSON.stringify({ error: `${service} request failed. Check logs for details.` });
}

const API = "https://api.twitter.com/2";

export default async function (input: Record<string, unknown>): Promise<string> {
  const bearer = (globalThis as any).Zubo?.getSecret?.("twitter_bearer_token");
  if (!bearer) {
    return JSON.stringify({ error: "Twitter bearer token not configured. Use secret_set to store 'twitter_bearer_token'." });
  }

  const { action, text, query, tweet_id, max_results } = input as {
    action: string; text?: string; query?: string; tweet_id?: string; max_results?: number;
  };

  const readHeaders: Record<string, string> = {
    Authorization: `Bearer ${bearer}`,
  };

  try {
    switch (action) {
      case "timeline": {
        // Get authenticated user's timeline (home timeline requires user context)
        const meRes = await fetch(`${API}/users/me`, { headers: readHeaders });
        if (!meRes.ok) return await safeApiError(meRes, "Twitter");
        const me = (await meRes.json()) as any;
        const res = await fetch(`${API}/users/${me.data.id}/tweets?max_results=${max_results || 10}&tweet.fields=created_at,public_metrics`, { headers: readHeaders });
        if (!res.ok) return await safeApiError(res, "Twitter");
        const data = (await res.json()) as any;
        return JSON.stringify(data.data?.map((t: any) => ({ id: t.id, text: t.text, created_at: t.created_at, metrics: t.public_metrics })) ?? []);
      }
      case "search": {
        if (!query) return JSON.stringify({ error: "query required" });
        const res = await fetch(`${API}/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=${max_results || 10}&tweet.fields=created_at,author_id,public_metrics`, { headers: readHeaders });
        if (!res.ok) return await safeApiError(res, "Twitter");
        const data = (await res.json()) as any;
        return JSON.stringify(data.data?.map((t: any) => ({ id: t.id, text: t.text, author_id: t.author_id, created_at: t.created_at })) ?? []);
      }
      case "post": {
        if (!text) return JSON.stringify({ error: "text required" });
        const apiKey = (globalThis as any).Zubo?.getSecret?.("twitter_api_key");
        const apiSecret = (globalThis as any).Zubo?.getSecret?.("twitter_api_secret");
        const accessToken = (globalThis as any).Zubo?.getSecret?.("twitter_access_token");
        const accessSecret = (globalThis as any).Zubo?.getSecret?.("twitter_access_secret");
        if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
          return JSON.stringify({ error: "Twitter OAuth credentials not configured. Need twitter_api_key, twitter_api_secret, twitter_access_token, twitter_access_secret." });
        }
        // Use OAuth 1.0a -- simplified via fetch with pre-computed header
        const oauthHeader = computeOAuth1Header("POST", `${API}/tweets`, {}, apiKey, apiSecret, accessToken, accessSecret);
        const res = await fetch(`${API}/tweets`, {
          method: "POST",
          headers: { Authorization: oauthHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) return await safeApiError(res, "Twitter");
        const data = (await res.json()) as any;
        return JSON.stringify({ posted: true, id: data.data?.id, text: data.data?.text });
      }
      case "reply": {
        if (!text || !tweet_id) return JSON.stringify({ error: "text and tweet_id required" });
        const apiKey = (globalThis as any).Zubo?.getSecret?.("twitter_api_key");
        const apiSecret = (globalThis as any).Zubo?.getSecret?.("twitter_api_secret");
        const accessToken = (globalThis as any).Zubo?.getSecret?.("twitter_access_token");
        const accessSecret = (globalThis as any).Zubo?.getSecret?.("twitter_access_secret");
        if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
          return JSON.stringify({ error: "Twitter OAuth credentials not configured." });
        }
        const oauthHeader = computeOAuth1Header("POST", `${API}/tweets`, {}, apiKey, apiSecret, accessToken, accessSecret);
        const res = await fetch(`${API}/tweets`, {
          method: "POST",
          headers: { Authorization: oauthHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ text, reply: { in_reply_to_tweet_id: tweet_id } }),
        });
        if (!res.ok) return await safeApiError(res, "Twitter");
        const data = (await res.json()) as any;
        return JSON.stringify({ replied: true, id: data.data?.id });
      }
      default:
        return JSON.stringify({ error: `Unknown action: ${action}` });
    }
  } catch (err: any) {
    return safeExceptionError(err, "Twitter");
  }
}

// Minimal OAuth 1.0a header computation
function computeOAuth1Header(
  method: string, url: string, params: Record<string, string>,
  consumerKey: string, consumerSecret: string,
  tokenKey: string, tokenSecret: string
): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomUUID().replace(/-/g, "");

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_token: tokenKey,
    oauth_version: "1.0",
  };

  const allParams = { ...params, ...oauthParams };
  const sortedKeys = Object.keys(allParams).sort();
  const paramString = sortedKeys.map(k => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`).join("&");

  const baseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;

  // Use Web Crypto for HMAC-SHA1
  const encoder = new TextEncoder();
  const keyData = encoder.encode(signingKey);
  const msgData = encoder.encode(baseString);

  // Sync HMAC-SHA1 using Bun's crypto
  const hmac = new Bun.CryptoHasher("sha1", keyData);
  hmac.update(msgData);
  const signature = Buffer.from(hmac.digest()).toString("base64");

  oauthParams.oauth_signature = signature;

  const headerParts = Object.keys(oauthParams).sort().map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`);
  return `OAuth ${headerParts.join(", ")}`;
}
