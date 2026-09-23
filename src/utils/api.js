// 后端(Cloudflare Worker)地址：dev 和线上都直连 Worker
// 线上由 CI 注入 VITE_API_BASE；缺省回退到已部署的 Worker
const API_BASE =
  import.meta.env.VITE_API_BASE || 'https://redbook-deepseek-proxy.iceeeeli.workers.dev';

// 每个浏览器一个稳定的 owner id（无需登录即可区分各自的草稿）
export function getOwnerId() {
  let id = localStorage.getItem('redbook_owner');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('redbook_owner', id);
  }
  return id;
}

async function req(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `请求失败 (${res.status})`);
  return data;
}

// AI 生成文案
export function generateCopy(topic) {
  return req('/generate', { method: 'POST', body: JSON.stringify({ topic }) });
}

// 草稿：列出 / 保存 / 删除
export function listDrafts() {
  return req(`/drafts?owner=${encodeURIComponent(getOwnerId())}`);
}

export function saveDraft({ id, title, content }) {
  return req('/drafts', {
    method: 'POST',
    body: JSON.stringify({ owner: getOwnerId(), id, title, content }),
  });
}

export function deleteDraft(id) {
  return req(`/drafts?owner=${encodeURIComponent(getOwnerId())}&id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
