import { useEffect, useState } from 'react';
import { listDrafts, saveDraft, deleteDraft } from '../utils/api.js';

/**
 * 草稿面板：把编辑器内容存到云端(Cloudflare Worker + D1)，可加载/删除。
 * 无需登录——用浏览器本地生成的 owner id 区分各自草稿。
 *
 * props:
 *   editor       TipTap 实例(取/设内容)
 *   fileName     当前文件名(作为草稿标题)
 *   setFileName  加载草稿时回填标题
 */
export default function DraftsPanel({ editor, fileName, setFileName }) {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const refresh = async () => {
    setError('');
    try {
      const data = await listDrafts();
      setDrafts(data.drafts || []);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const onSave = async () => {
    if (!editor || loading) return;
    setLoading(true);
    setError('');
    setMsg('');
    try {
      const content = JSON.stringify(editor.getJSON());
      await saveDraft({ title: (fileName || '').trim() || '未命名草稿', content });
      setMsg('已保存 ✓');
      await refresh();
      setTimeout(() => setMsg(''), 2000);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const onLoad = (d) => {
    if (!editor) return;
    try {
      editor.commands.setContent(JSON.parse(d.content));
      setFileName?.(d.title || '未命名草稿');
    } catch {
      setError('这条草稿内容损坏，无法加载');
    }
  };

  const onDelete = async (id) => {
    try {
      await deleteDraft(id);
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  };

  const fmt = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  };

  return (
    <div className="drafts-panel">
      <div className="drafts-head">
        <span className="drafts-title">📁 我的草稿</span>
        <button className="draft-save-btn" onClick={onSave} disabled={loading}>
          {loading ? '保存中…' : '💾 保存当前为草稿'}
        </button>
        {msg && <span className="drafts-msg">{msg}</span>}
      </div>

      {error && <div className="drafts-error">⚠️ {error}</div>}

      {drafts.length === 0 ? (
        <div className="drafts-empty">还没有草稿，写点东西点「保存」试试～</div>
      ) : (
        <ul className="drafts-list">
          {drafts.map((d) => (
            <li key={d.id} className="draft-item">
              <div className="draft-info">
                <span className="draft-name">{d.title || '未命名草稿'}</span>
                <span className="draft-time">{fmt(d.updated_at)}</span>
              </div>
              <div className="draft-actions">
                <button className="draft-link" onClick={() => onLoad(d)}>
                  加载
                </button>
                <button className="draft-link danger" onClick={() => onDelete(d.id)}>
                  删除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
