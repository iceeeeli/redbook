/**
 * Cloudflare Worker —— 小红书编辑器后端
 *
 * 路由：
 *   POST   /generate         调 DeepSeek 生成文案（带限流）
 *   GET    /drafts?owner=ID   列出某人的草稿
 *   POST   /drafts            保存/更新草稿 {owner, id?, title, content}
 *   DELETE /drafts?owner=ID&id=DID  删除草稿
 *
 * 绑定（见 wrangler.toml）：
 *   AI_LIMITER  —— 限流器（防止 DeepSeek 额度被刷）
 *   DB          —— D1 数据库（存草稿）
 *
 * Secret / vars：
 *   DEEPSEEK_API_KEY(secret), DEEPSEEK_MODEL, DEEPSEEK_BASE_URL, ALLOW_ORIGINS
 */

const SYSTEM_PROMPT = `你是一位资深小红书文案创作者。请根据用户给的主题/关键词，写一篇爆款小红书笔记，要求：
1. 标题吸引人、带 emoji、有钩子（可用数字、悬念、痛点）；
2. 正文口语化、真诚、分点或分段，适当用 emoji，避免过度营销感；
3. 结尾自然带 3-6 个相关话题标签（#xxx 形式）；
4. 直接输出笔记内容，不要任何多余解释、不要用"标题："这类前缀。`;

// 允许的前端来源（本地开发 + 线上 Pages）。ALLOW_ORIGINS 可用逗号分隔覆盖。
function resolveCors(request, env) {
  const origin = request.headers.get('Origin') || '';
  const list = (env.ALLOW_ORIGINS || 'https://iceeeeli.github.io')
    .split(',')
    .map((s) => s.trim());
  const allowLocalhost = /^http:\/\/localhost(:\d+)?$/.test(origin);
  const allowed = list.includes(origin) || list.includes('*') || allowLocalhost;
  return {
    'Access-Control-Allow-Origin': allowed ? origin || '*' : list[0],
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function json(payload, status, cors) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors },
  });
}

export default {
  async fetch(request, env) {
    const cors = resolveCors(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    try {
      if (path === '/generate' || path === '/') {
        if (request.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405, cors);
        return await handleGenerate(request, env, cors);
      }
      if (path === '/drafts') {
        return await handleDrafts(request, env, cors, url);
      }
      return json({ error: 'Not Found' }, 404, cors);
    } catch (err) {
      return json({ error: String(err) }, 500, cors);
    }
  },
};

// ---------- AI 生成（带限流）----------
async function handleGenerate(request, env, cors) {
  // 限流：按客户端 IP，超了返回 429
  if (env.AI_LIMITER) {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const { success } = await env.AI_LIMITER.limit({ key: `gen:${ip}` });
    if (!success) {
      return json({ error: '请求太频繁了，休息一下再试～（限流保护）' }, 429, cors);
    }
  }

  const KEY = env.DEEPSEEK_API_KEY;
  const MODEL = env.DEEPSEEK_MODEL || 'deepseek-chat';
  const BASE = env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
  if (!KEY) return json({ error: 'Worker 未配置 DEEPSEEK_API_KEY' }, 500, cors);

  const { topic } = await request.json();
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
    const errText = await upstream.text();
    return json({ error: `DeepSeek 报错 (${upstream.status}): ${errText}` }, 502, cors);
  }
  const data = await upstream.json();
  const text = data?.choices?.[0]?.message?.content?.trim() || '';
  return json({ text }, 200, cors);
}

// ---------- 草稿 CRUD（D1）----------
async function ensureTable(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS drafts (
       id TEXT PRIMARY KEY,
       owner TEXT NOT NULL,
       title TEXT,
       content TEXT,
       updated_at INTEGER
     )`
  ).run();
}

async function handleDrafts(request, env, cors, url) {
  if (!env.DB) return json({ error: 'Worker 未绑定 D1 数据库' }, 500, cors);
  await ensureTable(env);

  // 列出
  if (request.method === 'GET') {
    const owner = url.searchParams.get('owner');
    if (!owner) return json({ error: '缺少 owner' }, 400, cors);
    const { results } = await env.DB.prepare(
      'SELECT id, title, content, updated_at FROM drafts WHERE owner = ? ORDER BY updated_at DESC LIMIT 100'
    )
      .bind(owner)
      .all();
    return json({ drafts: results || [] }, 200, cors);
  }

  // 保存 / 更新
  if (request.method === 'POST') {
    const body = await request.json();
    const { owner, title = '', content = '' } = body;
    if (!owner) return json({ error: '缺少 owner' }, 400, cors);
    const id = body.id || crypto.randomUUID();
    const now = Date.now();
    await env.DB.prepare(
      `INSERT INTO drafts (id, owner, title, content, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET title=excluded.title, content=excluded.content, updated_at=excluded.updated_at`
    )
      .bind(id, owner, title, content, now)
      .run();
    return json({ id, updated_at: now }, 200, cors);
  }

  // 删除
  if (request.method === 'DELETE') {
    const owner = url.searchParams.get('owner');
    const id = url.searchParams.get('id');
    if (!owner || !id) return json({ error: '缺少 owner 或 id' }, 400, cors);
    await env.DB.prepare('DELETE FROM drafts WHERE id = ? AND owner = ?').bind(id, owner).run();
    return json({ ok: true }, 200, cors);
  }

  return json({ error: 'Method Not Allowed' }, 405, cors);
}
