# RBK Modular Toolkit integration (experimental)

This is an optional host adapter, not a standalone Obsidian plugin or a replacement for the upstream optimizer. It implements fit-content-style widths for CodeMirror Live Preview code blocks. Its lifecycle expects `services.editorExtensions` and `services.refreshEditors()` from the RBK Modular Toolkit host. Register the factory in the host module registry with `enabledByDefault: false`, and register one stable extensions array with Obsidian's `registerEditorExtension`; refresh through `workspace.updateOptions()` after modifying the array. Build the host with `@codemirror/state` and `@codemirror/view` external so the host uses Obsidian's CodeMirror instances.

CSS required in the host:

```css
.markdown-source-view.is-live-preview .cm-line.HyperMD-codeblock.rbk-pretext-codeblock-line {
  width: min(100%, max(8ch, var(--rbk-pretext-block-width)));
  box-sizing: border-box;
}
```

Pretext 1.0.0 measures natural width with `pre-wrap`; tabs use a Canvas fallback respecting editor tab-size because Pretext uses eight-column tab stops. Cache is bounded per editor, work is debounced, and incomplete/oversized fences use native rendering. The conservative fence scanner and mixed syntax fonts, ligatures, widgets and nested list/callout fences are limitations. No scroll listener is installed. The separate Reading View CSS remains a host responsibility.

On 2026-11-03, 8 host tests passed; a synthetic Obsidian CodeMirror fixture applied the same width to four lines, and five after an edit. A short A/B (two trials per combination, module and original optimizer on/off; 80 synthetic blocks, 8 edits) observed p95 frame intervals of 16.8 ms, not a real-world performance guarantee. The upstream plugin was not part of the isolated CodeMirror state. The module defaults off pending broader real-world validation. Original optimizer stays independent.

Install dependencies with `npm install` in this directory, then run `npm test` to test the isolated scanner and tab fallback. Full integration requires the RBK host, Obsidian and its CodeMirror runtime. Pretext is MIT-licensed; see `pretext-codeblocks/LICENSE-pretext.txt`.
