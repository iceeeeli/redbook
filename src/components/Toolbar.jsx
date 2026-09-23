import { useRef } from 'react';

/** 单个工具栏按钮 */
function Btn({ onClick, active, disabled, title, children }) {
  return (
    <button
      type="button"
      className={`tb-btn${active ? ' is-active' : ''}`}
      onMouseDown={(e) => e.preventDefault()} // 防止点击按钮时编辑器失焦
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}

export default function Toolbar({ editor }) {
  const fileInputRef = useRef(null);

  if (!editor) return null;

  // 选图片 → 读为 base64 → 插入编辑器（base64 内联，导出 Word 时图片不会丢）
  const onPickImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      editor.chain().focus().setImage({ src: reader.result }).run();
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // 允许重复选同一张图
  };

  return (
    <div className="toolbar">
      <Btn title="标题1" active={editor.isActive('heading', { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</Btn>
      <Btn title="标题2" active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</Btn>
      <Btn title="标题3" active={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</Btn>

      <span className="tb-sep" />

      <Btn title="加粗" active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></Btn>
      <Btn title="斜体" active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></Btn>
      <Btn title="下划线" active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></Btn>
      <Btn title="删除线" active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}><s>S</s></Btn>

      <span className="tb-sep" />

      <Btn title="无序列表" active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}>• 列表</Btn>
      <Btn title="有序列表" active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. 列表</Btn>
      <Btn title="引用" active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}>❝ 引用</Btn>

      <span className="tb-sep" />

      <Btn title="插入图片" onClick={() => fileInputRef.current?.click()}>🖼 图片</Btn>
      <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={onPickImage} />

      <span className="tb-sep" />

      <Btn title="撤销" disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}>↶</Btn>
      <Btn title="重做" disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}>↷</Btn>
    </div>
  );
}
