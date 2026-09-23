import { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';
import Toolbar from './components/Toolbar.jsx';
import AiPanel from './components/AiPanel.jsx';
import DraftsPanel from './components/DraftsPanel.jsx';
import { exportJsonToWord } from './utils/exportWord.js';

// 把 AI 返回的纯文本（含换行）转成 TipTap 能插入的 HTML 段落
function textToHtml(text) {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${line.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`)
    .join('');
}

const DEFAULT_CONTENT = `
  <h1>🌟 3 步搞定春日通勤穿搭</h1>
  <p>姐妹们！这套<strong>初春通勤 look</strong> 真的绝了，显瘦又高级～</p>
  <h2>单品清单</h2>
  <ul>
    <li>燕麦色针织开衫</li>
    <li>白色微喇西裤</li>
    <li>乐福鞋 + 托特包</li>
  </ul>
  <blockquote>Tips：整体配色控制在 3 色以内，高级感 up！</blockquote>
  <p>#通勤穿搭 #春日穿搭 #显瘦</p>
`;

export default function App() {
  const [fileName, setFileName] = useState('小红书文案');

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Image.configure({ inline: false, allowBase64: true }),
    ],
    content: DEFAULT_CONTENT,
  });

  const handleExport = async () => {
    if (!editor) return;
    await exportJsonToWord(editor.getJSON(), fileName.trim() || '文档');
  };

  // AI 生成的文案追加到编辑器末尾
  const handleAiInsert = (text) => {
    if (!editor) return;
    editor.chain().focus('end').insertContent(textToHtml(text)).run();
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1>📝 小红书文案编辑器</h1>
        <p className="subtitle">富文本编辑 · 一键导出 Word（纯前端）</p>
      </header>

      <AiPanel onInsert={handleAiInsert} />

      <div className="editor-card">
        <Toolbar editor={editor} />
        <EditorContent editor={editor} className="editor-body" />
      </div>

      <div className="export-bar">
        <input
          className="filename-input"
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
          placeholder="文件名"
        />
        <span className="ext">.docx</span>
        <button className="export-btn" onClick={handleExport}>
          ⬇ 导出 Word
        </button>
      </div>

      <DraftsPanel editor={editor} fileName={fileName} setFileName={setFileName} />
    </div>
  );
}
