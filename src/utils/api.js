// 后端(EdgeOne 边缘函数)地址：AI 生成走它；草稿走浏览器本地存储。
// 线上由 CI 注入 VITE_API_BASE；本地缺省回退到已部署的 Worker(或改成你的 EdgeOne 域名)。
const API_BASE =
  import.meta.env.VITE_API_BASE || 'https://redbook-deepseek-proxy.iceeeeli.workers.dev';

// ---------- AI 生成（走后端，藏 key + 跨域） ----------
export async function generateCopy(topic) {
  const res = await fetch(`${API_BASE}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `请求失败 (${res.status})`);
  return data;
}

// ---------- 草稿：浏览器本地存储（localStorage） ----------
// 无需后端/数据库，立即可用；代价是只存在当前浏览器、不跨设备同步。
// 将来若开通了云端 KV，可把下面三个函数换回 fetch 版实现云同步。
const DRAFTS_KEY = 'redbook_drafts';

function readAll() {
  try {
    const arr = JSON.parse(localStorage.getItem(DRAFTS_KEY) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeAll(arr) {
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(arr));
}

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'd-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function listDrafts() {
  const drafts = readAll().sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0));
  return { drafts };
}

export async function saveDraft({ id, title, content }) {
  const arr = readAll();
  const now = Date.now();
  const theId = id || newId();
  const i = arr.findIndex((d) => d.id === theId);
  const item = { id: theId, title, content, updated_at: now };
  if (i >= 0) arr[i] = item;
  else arr.push(item);
  writeAll(arr);
  return { id: theId, updated_at: now };
}

export async function deleteDraft(id) {
  writeAll(readAll().filter((d) => d.id !== id));
  return { ok: true };
}
