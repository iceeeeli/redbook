import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  ImageRun,
  BorderStyle,
} from 'docx';
import { saveAs } from 'file-saver';

const HEADING = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
};

// TipTap 行内节点（text + marks）→ docx TextRun[]
function runsFromInline(nodes = []) {
  const runs = [];
  for (const n of nodes) {
    if (n.type === 'text' && n.text) {
      const marks = n.marks || [];
      const has = (t) => marks.some((m) => m.type === t);
      runs.push(
        new TextRun({
          text: n.text,
          bold: has('bold'),
          italics: has('italic'),
          underline: has('underline') ? {} : undefined,
          strike: has('strike'),
        })
      );
    }
  }
  // 空段落也要给一个空 run，否则某些阅读器会吞掉这一行
  return runs.length ? runs : [new TextRun('')];
}

function dataUrlToUint8(dataUrl) {
  const base64 = dataUrl.split(',')[1] || '';
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function imageType(dataUrl) {
  const m = /data:image\/(\w+)/.exec(dataUrl);
  const t = m ? m[1] : 'png';
  return t === 'jpeg' ? 'jpg' : t; // docx 认 'jpg'
}

function loadDims(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 400, h: 300 });
    img.src = src;
  });
}

// 单个块级节点 → docx Paragraph[]
function blockToParagraphs(node, ctx) {
  switch (node.type) {
    case 'heading':
      return [
        new Paragraph({
          heading: HEADING[node.attrs?.level] || HeadingLevel.HEADING_2,
          children: runsFromInline(node.content),
        }),
      ];

    case 'paragraph':
      return [new Paragraph({ children: runsFromInline(node.content) })];

    case 'blockquote':
      return (node.content || []).map(
        (p) =>
          new Paragraph({
            children: runsFromInline(p.content),
            indent: { left: 480 },
            border: {
              left: { style: BorderStyle.SINGLE, size: 18, space: 12, color: 'FF2442' },
            },
          })
      );

    case 'bulletList':
      return (node.content || []).flatMap((li) =>
        (li.content || []).map(
          (p) => new Paragraph({ bullet: { level: 0 }, children: runsFromInline(p.content) })
        )
      );

    case 'orderedList': {
      const ref = `ol-${ctx.ol++}`;
      ctx.numbering.push({
        reference: ref,
        levels: [
          {
            level: 0,
            format: 'decimal',
            text: '%1.',
            alignment: AlignmentType.START,
            style: { paragraph: { indent: { left: 480, hanging: 240 } } },
          },
        ],
      });
      return (node.content || []).flatMap((li) =>
        (li.content || []).map(
          (p) =>
            new Paragraph({
              numbering: { reference: ref, level: 0 },
              children: runsFromInline(p.content),
            })
        )
      );
    }

    case 'image': {
      const src = node.attrs?.src;
      if (!src) return [];
      const dim = ctx.imgDims.get(src) || { w: 400, h: 300 };
      const maxW = 500;
      const scale = dim.w > maxW ? maxW / dim.w : 1;
      return [
        new Paragraph({
          children: [
            new ImageRun({
              data: dataUrlToUint8(src),
              type: imageType(src),
              transformation: {
                width: Math.round(dim.w * scale),
                height: Math.round(dim.h * scale),
              },
            }),
          ],
        }),
      ];
    }

    default:
      return [];
  }
}

/**
 * 用 docx 库从 TipTap 的结构化 JSON 生成 .docx 并下载。
 * 相比 html-docx-js，中文不乱码、样式更可控、无需 CDN。
 * @param {object} json     editor.getJSON()
 * @param {string} fileName 文件名（不含扩展名）
 */
export async function exportJsonToWord(json, fileName = '文档') {
  const ctx = { ol: 0, numbering: [], imgDims: new Map() };

  // 先把所有图片尺寸异步读出来（保持宽高比）
  const collect = (n) => {
    if (!n) return;
    if (n.type === 'image' && n.attrs?.src) ctx.imgDims.set(n.attrs.src, null);
    (n.content || []).forEach(collect);
  };
  collect(json);
  for (const src of ctx.imgDims.keys()) {
    ctx.imgDims.set(src, await loadDims(src));
  }

  const children = (json.content || []).flatMap((node) => blockToParagraphs(node, ctx));

  const doc = new Document({
    numbering: { config: ctx.numbering },
    styles: {
      default: {
        document: { run: { font: '微软雅黑', size: 24 } }, // 12pt，CJK 友好字体
      },
    },
    sections: [{ children: children.length ? children : [new Paragraph('')] }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${fileName}.docx`);
}
