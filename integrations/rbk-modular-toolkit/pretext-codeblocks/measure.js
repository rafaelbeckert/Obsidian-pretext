// Conservative Markdown fence scanner. Unclosed/very large blocks fall back to native sizing.
export function findFencedBlocks(doc, limits = {}) {
  const maxDocument = limits.maxDocument ?? 300_000;
  const maxBlock = limits.maxBlock ?? 32_000;
  const maxLines = limits.maxLines ?? 1_000;
  if (doc.length > maxDocument) return [];
  const blocks = [];
  let current = null;
  for (let n = 1; n <= doc.lines; n++) {
    const line = doc.line(n);
    if (!current) {
      const m = /^( {0,3})(`{3,}|~{3,})(.*)$/.exec(line.text);
      if (!m || (m[2][0] === '`' && m[3].includes('`'))) continue;
      current = { fromLine: n, fence: m[2], body: [], length: 0, tooLarge: false };
      continue;
    }
    const close = /^( {0,3})(`{3,}|~{3,})\s*$/.exec(line.text);
    if (close && close[2][0] === current.fence[0] && close[2].length >= current.fence.length) {
      if (!current.tooLarge) blocks.push({ fromLine: current.fromLine, toLine: n, text: current.body.join('\n') });
      current = null;
      continue;
    }
    current.length += line.text.length + 1;
    if (current.length > maxBlock || n - current.fromLine > maxLines) current.tooLarge = true;
    if (!current.tooLarge) current.body.push(line.text);
  }
  return blocks;
}

// Pretext uses 8-space tab stops. Canvas fallback respects the editor's actual tab-size.
export function canvasWidthWithTabs(text, context, tabSize) {
  const space = context.measureText(' ').width;
  const stop = space * tabSize;
  let maximum = 0;
  for (const line of text.split('\n')) {
    let width = 0;
    const parts = line.split('\t');
    for (let i = 0; i < parts.length; i++) {
      width += context.measureText(parts[i]).width;
      if (i < parts.length - 1 && stop > 0) width = (Math.floor(width / stop + 1e-7) + 1) * stop;
    }
    maximum = Math.max(maximum, width);
  }
  return maximum;
}
