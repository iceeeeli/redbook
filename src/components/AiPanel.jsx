import { useState } from 'react';
import { generateCopy } from '../utils/api.js';

/**
 * AI 生成文案面板：输入主题 → 调用 /api/generate（后端代理 DeepSeek）→
 * 把生成结果通过 onInsert 回调交给编辑器。
 */
export default function AiPanel({ onInsert }) {
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    if (!topic.trim() || loading) return;
    setLoading(true);
    setError('');
    try {
      const data = await generateCopy(topic.trim());
      if (!data.text) throw new Error('生成内容为空，请重试');
      onInsert(data.text);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    // Ctrl / Cmd + Enter 快捷生成
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') generate();
  };

  return (
    <div className="ai-panel">
      <div className="ai-row">
        <input
          className="ai-input"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="输入主题 / 关键词，例如：春日通勤穿搭、平价咖啡机测评…"
          disabled={loading}
        />
        <button className="ai-btn" onClick={generate} disabled={loading}>
          {loading ? '咪咪思考中…' : '✨ AI 生成文案'}
        </button>
      </div>
      {error && <div className="ai-error">⚠️ {error}</div>}
      <div className="ai-hint">由 DeepSeek 生成 · 会追加到编辑器内容后面 · Ctrl/⌘+Enter 快捷生成</div>
    </div>
  );
}
