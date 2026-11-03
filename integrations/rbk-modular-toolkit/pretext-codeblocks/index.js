import { StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin } from '@codemirror/view';
import { prepareWithSegments, measureNaturalWidth } from '@chenglou/pretext';
import { findFencedBlocks, canvasWidthWithTabs } from './measure.js';

// A bounded, opt-in experiment; native rendering remains the fallback.
export function createPretextCodeblocks({ services }) {
  const setWidths = StateEffect.define();
  const widths = StateField.define({
    create: () => Decoration.none,
    update(value, transaction) {
      if (transaction.docChanged) value = Decoration.none;
      for (const effect of transaction.effects) if (effect.is(setWidths)) value = effect.value;
      return value;
    },
    provide: field => EditorView.decorations.from(field),
  });
  const worker = ViewPlugin.fromClass(class {
    constructor(view) {
      this.view = view; this.timer = null; this.dead = false; this.cache = new Map(); this.signature = null;
      this.isLive = Boolean(view.dom.closest('.markdown-source-view.is-live-preview'));
      this.lastWidth = 0;
      this.resizeObserver = new ResizeObserver(entries => {
        const width = entries[0]?.contentRect.width;
        if (width && width !== this.lastWidth) { this.lastWidth = width; this.schedule(); }
      });
      this.resizeObserver.observe(view.dom);
      this.schedule();
    }
    update(update) {
      const isLive = Boolean(this.view.dom.closest('.markdown-source-view.is-live-preview'));
      if (update.docChanged) this.signature = null;
      if (update.docChanged || (isLive && !this.isLive)) this.schedule();
      this.isLive = isLive;
    }
    schedule() {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        if (this.dead || !this.view.dom.closest('.markdown-source-view.is-live-preview')) return;
        const documentSnapshot = this.view.state.doc;
        const blocks = findFencedBlocks(documentSnapshot);
        this.view.requestMeasure({
          key: this,
          read: view => {
            const line = view.contentDOM.querySelector('.HyperMD-codeblock:not(.HyperMD-codeblock-begin)') || view.contentDOM;
            const style = getComputedStyle(line);
            const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
            return { font, tabSize: Math.max(1, parseFloat(style.tabSize) || 4), padding: (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0) + 12 };
          },
          write: metrics => {
            if (this.dead || this.view.state.doc !== documentSnapshot) return;
            const ctx = document.createElement('canvas').getContext('2d');
            if (!ctx) return;
            ctx.font = metrics.font;
            const ranges = [];
            const signatures = [];
            for (const block of blocks) {
              const key = `${metrics.font}\0${metrics.tabSize}\0${block.text}`;
              let width = this.cache.get(key);
              if (width === undefined) {
                try {
                  width = block.text.includes('\t')
                    ? canvasWidthWithTabs(block.text, ctx, metrics.tabSize)
                    : measureNaturalWidth(prepareWithSegments(block.text, metrics.font, { whiteSpace: 'pre-wrap' }));
                } catch (error) { console.warn('[RBK Pretext] Using native block width', error); continue; }
                if (!Number.isFinite(width)) continue;
                if (this.cache.size >= 100) this.cache.delete(this.cache.keys().next().value);
                this.cache.set(key, width);
              }
              const px = Math.ceil(width + metrics.padding);
              signatures.push(`${block.fromLine}:${block.toLine}:${px}`);
              for (let n = block.fromLine; n <= block.toLine; n++) {
                ranges.push(Decoration.line({ attributes: { class: 'rbk-pretext-codeblock-line', style: `--rbk-pretext-block-width:${px}px` } }).range(documentSnapshot.line(n).from));
              }
            }
            const signature = signatures.join("|");
            if (signature !== this.signature) {
              this.signature = signature;
              const decorations = Decoration.set(ranges, true);
              // requestMeasure's write phase is still inside CodeMirror's update cycle.
              queueMicrotask(() => {
                if (!this.dead && this.view.state.doc === documentSnapshot) {
                  this.view.dispatch({ effects: setWidths.of(decorations) });
                }
              });
            }
          },
        });
      }, 250);
    }
    destroy() { this.dead = true; clearTimeout(this.timer); this.resizeObserver.disconnect(); this.cache.clear(); }
  });
  const extensions = [widths, worker];
  return {
    start() { services.editorExtensions.push(...extensions); services.refreshEditors(); },
    stop() {
      for (const extension of extensions) { const index = services.editorExtensions.indexOf(extension); if (index !== -1) services.editorExtensions.splice(index, 1); }
      services.refreshEditors();
    },
  };
}
