// EdgeOne 边缘函数：草稿云存储  → 路由 /drafts
// KV 绑定(控制台配)：REDBOOK_KV
// 存储方案：每个 owner 一个键 drafts:{owner} → 该用户全部草稿的 JSON 数组

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

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'd-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function readDrafts(KV, owner) {
  try {
    const arr = await KV.get('drafts:' + owner, { type: 'json' });
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeDrafts(KV, owner, arr) {
  return KV.put('drafts:' + owner, JSON.stringify(arr));
}

export async function onRequestOptions({ request, env }) {
  return new Response(null, { headers: corsHeaders(request, env) });
}

// 列出
export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  const KV = env.REDBOOK_KV;
  if (!KV) return json({ error: '未绑定 KV(REDBOOK_KV)' }, 500, cors);
  const owner = new URL(request.url).searchParams.get('owner');
  if (!owner) return json({ error: '缺少 owner' }, 400, cors);
  const drafts = (await readDrafts(KV, owner)).sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0));
  return json({ drafts }, 200, cors);
}

// 保存 / 更新
export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  const KV = env.REDBOOK_KV;
  if (!KV) return json({ error: '未绑定 KV(REDBOOK_KV)' }, 500, cors);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: '请求体无效' }, 400, cors);
  }
  const { owner, title = '', content = '' } = body || {};
  if (!owner) return json({ error: '缺少 owner' }, 400, cors);

  const id = body.id || uuid();
  const now = Date.now();
  const drafts = await readDrafts(KV, owner);
  const i = drafts.findIndex((d) => d.id === id);
  const item = { id, title, content, updated_at: now };
  if (i >= 0) drafts[i] = item;
  else drafts.push(item);
  await writeDrafts(KV, owner, drafts);
  return json({ id, updated_at: now }, 200, cors);
}

// 删除
export async function onRequestDelete({ request, env }) {
  const cors = corsHeaders(request, env);
  const KV = env.REDBOOK_KV;
  if (!KV) return json({ error: '未绑定 KV(REDBOOK_KV)' }, 500, cors);
  const sp = new URL(request.url).searchParams;
  const owner = sp.get('owner');
  const id = sp.get('id');
  if (!owner || !id) return json({ error: '缺少 owner 或 id' }, 400, cors);
  const drafts = (await readDrafts(KV, owner)).filter((d) => d.id !== id);
  await writeDrafts(KV, owner, drafts);
  return json({ ok: true }, 200, cors);
}
