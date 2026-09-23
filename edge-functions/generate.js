// EdgeOne 边缘函数：DeepSeek 文案生成代理  → 路由 /generate
// 环境变量(控制台配)：DEEPSEEK_API_KEY(必填)、DEEPSEEK_MODEL、DEEPSEEK_BASE_URL、ALLOW_ORIGINS
// KV 绑定(可选，用于限流)：REDBOOK_KV

const SYSTEM_PROMPT = `你是一位资深小红书文案创作者。请根据用户给的主题/关键词，写一篇爆款小红书笔记，要求：
1. 标题吸引人、带 emoji、有钩子（可用数字、悬念、痛点）；
2. 正文口语化、真诚、分点或分段，适当用 emoji，避免过度营销感；
3. 结尾自然带 3-6 个相关话题标签（#xxx 形式）；
4. 直接输出笔记内容，不要任何多余解释、不要用"标题："这类前缀。`;

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const list = ((env && env.ALLOW_ORIGINS) || 'https://iceeeeli.github.io')
    .split(',')
    .map((s) => s.trim());
  const ok = list.includes(origin) || list.includes('*') || /^http:\/\/localhost(:\d+)?$/.test(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin || '*' : list[0],
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

// 基于 KV 的尽力而为限流：同一 IP 60 秒内最多 15 次。KV 拿不到就放行。
async function isRateLimited(env, request) {
  const KV = env && env.REDBOOK_KV;
  const ip =
    request.headers.get('EO-Connecting-IP') ||
    request.headers.get('x-forwarded-for') ||
    '';
  if (!KV || !ip) return false;
  const now = Date.now();
  let rec = null;
  try {
    rec = await KV.get('rl:' + ip, { type: 'json' });
  } catch {
    return false;
  }
  let count = 1;
  let start = now;
  if (rec && now - rec.t < 60000) {
    count = rec.c + 1;
    start = rec.t;
  }
  try {
    await KV.put('rl:' + ip, JSON.stringify({ c: count, t: start }));
  } catch {
    /* 忽略写失败 */
  }
  return count > 15;
}

export async function onRequestOptions({ request, env }) {
  return new Response(null, { headers: corsHeaders(request, env) });
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);

  if (await isRateLimited(env, request)) {
    return json({ error: '请求太频繁了，休息一下再试～（限流保护）' }, 429, cors);
  }

  const KEY = env.DEEPSEEK_API_KEY;
  const MODEL = env.DEEPSEEK_MODEL || 'deepseek-chat';
  const BASE = env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
  if (!KEY) return json({ error: '未配置 DEEPSEEK_API_KEY' }, 500, cors);

  let topic;
  try {
    ({ topic } = await request.json());
  } catch {
    return json({ error: '请求体无效' }, 400, cors);
  }
  if (!topic || !topic.trim()) return json({ error: '请填写主题 / 关键词' }, 400, cors);

  const upstream = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `主题/关键词：${topic}` },
      ],
      max_tokens: 800,
      temperature: 0.85,
      stream: false,
    }),
  });

  if (!upstream.ok) {
    const t = await upstream.text();
    return json({ error: `DeepSeek 报错 (${upstream.status}): ${t}` }, 502, cors);
  }
  const data = await upstream.json();
  const text = data?.choices?.[0]?.message?.content?.trim() || '';
  return json({ text }, 200, cors);
}
