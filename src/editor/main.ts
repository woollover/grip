import {
  EditorView,
  keymap,
  Decoration,
  type DecorationSet,
  ViewPlugin,
  type ViewUpdate,
  showTooltip,
  type Tooltip,
} from '@codemirror/view';
import { EditorState, StateField, StateEffect } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';

// ── Markdown wrap ─────────────────────────────────────────────────────────────

function wrap(view: EditorView, before: string, after: string): boolean {
  const { from, to } = view.state.selection.main;
  const sel = view.state.sliceDoc(from, to);
  view.dispatch({
    changes: { from, to, insert: before + sel + after },
    selection: { anchor: from + before.length, head: from + before.length + sel.length },
  });
  return true;
}

// ── Floating selection toolbar ────────────────────────────────────────────────

const tooltipField = StateField.define<readonly Tooltip[]>({
  create: () => [],
  update(_, tr) {
    if (!tr.docChanged && !tr.selection) return _;
    if (tr.state.selection.main.empty) return [];
    const { from } = tr.state.selection.main;
    return [{
      pos: from,
      above: true,
      strictSide: false,
      arrow: false,
      create(view: EditorView) {
        const dom = document.createElement('div');
        dom.className = 'cm-float-toolbar';

        function btn(label: string, title: string, fn: () => void) {
          const el = document.createElement('button');
          el.type = 'button';
          el.textContent = label;
          el.title = title;
          el.onmousedown = (e) => { e.preventDefault(); fn(); };
          dom.appendChild(el);
        }

        btn('B', 'Bold (Ctrl+B)', () => wrap(view, '**', '**'));
        btn('I', 'Italic (Ctrl+I)', () => wrap(view, '_', '_'));
        btn('Link', 'Link (Ctrl+K)', () => {
          const url = prompt('URL:');
          if (!url) return;
          const { from, to } = view.state.selection.main;
          const sel = view.state.sliceDoc(from, to);
          view.dispatch({ changes: { from, to, insert: `[${sel}](${url})` } });
        });
        btn('<>', 'Code (Ctrl+`)', () => wrap(view, '`', '`'));

        return { dom };
      },
    }];
  },
  provide: (f) => showTooltip.computeN([f], (s) => s.field(f)),
});

// ── Typewriter mode ───────────────────────────────────────────────────────────

const typewriterEffect = StateEffect.define<boolean>();
const typewriterState = StateField.define<boolean>({
  create: () => false,
  update: (v, tr) => {
    for (const e of tr.effects) if (e.is(typewriterEffect)) return e.value;
    return v;
  },
});

const typewriterListener = EditorView.updateListener.of((u: ViewUpdate) => {
  if (!u.state.field(typewriterState)) return;
  if (!u.selectionSet && !u.docChanged) return;
  const { head } = u.state.selection.main;
  const coords = u.view.coordsAtPos(head);
  if (!coords) return;
  const scroller = u.view.scrollDOM;
  const rect = scroller.getBoundingClientRect();
  const cursorY = (coords.top + coords.bottom) / 2 - rect.top + scroller.scrollTop;
  scroller.scrollTop = cursorY - scroller.clientHeight / 2;
});

// ── Focus mode ────────────────────────────────────────────────────────────────

const focusEffect = StateEffect.define<boolean>();
const focusState = StateField.define<boolean>({
  create: () => false,
  update: (v, tr) => {
    for (const e of tr.effects) if (e.is(focusEffect)) return e.value;
    return v;
  },
});

const dimMark = Decoration.mark({ class: 'cm-dim' });

const focusPlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet = Decoration.none;

  update(u: ViewUpdate) {
    const toggled = u.transactions.some((t) => t.effects.some((e) => e.is(focusEffect)));
    if (!toggled && !u.docChanged && !u.selectionSet) return;
    this.decorations = this.build(u.view);
  }

  build(view: EditorView): DecorationSet {
    if (!view.state.field(focusState)) return Decoration.none;

    const { head } = view.state.selection.main;
    const line = view.state.doc.lineAt(head);
    let start = line.from;
    let end = line.to;

    while (start > 0) {
      const prev = view.state.doc.lineAt(start - 1);
      if (prev.text.trim() === '') break;
      start = prev.from;
    }
    while (end < view.state.doc.length) {
      const nextPos = end + 1;
      if (nextPos > view.state.doc.length) break;
      const next = view.state.doc.lineAt(nextPos);
      if (next.text.trim() === '') break;
      end = next.to;
    }

    const ranges: ReturnType<typeof dimMark.range>[] = [];
    if (start > 0) ranges.push(dimMark.range(0, start));
    if (end < view.state.doc.length) ranges.push(dimMark.range(end, view.state.doc.length));
    return ranges.length ? Decoration.set(ranges, true) : Decoration.none;
  }
}, { decorations: (v) => v.decorations });

// ── Drag-drop image upload ────────────────────────────────────────────────────

const dragDropHandler = EditorView.domEventHandlers({
  dragover(e: DragEvent) {
    if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
  },
  drop(e: DragEvent, view: EditorView) {
    const file = e.dataTransfer?.files?.[0];
    if (!file?.type.startsWith('image/')) return false;
    e.preventDefault();
    const pos = view.posAtCoords({ x: e.clientX, y: e.clientY }) ?? view.state.doc.length;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('altText', file.name.replace(/\.[^.]+$/, ''));
    fetch('/media/upload', { method: 'POST', body: fd })
      .then(async (r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        const { url, alt } = (await r.json()) as { url: string; alt: string };
        view.dispatch({ changes: { from: pos, to: pos, insert: `\n![${alt}](${url})\n` } });
      })
      .catch((err) => alert('Image upload failed: ' + err.message));
    return true;
  },
});

// ── CM6 theme ─────────────────────────────────────────────────────────────────

const gripTheme = EditorView.theme({
  '&': { height: 'auto' },
  '.cm-scroller': { overflow: 'visible !important', fontFamily: 'inherit', lineHeight: 'inherit' },
  '.cm-content': {
    padding: '0',
    caretColor: 'var(--g-text)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  '.cm-line': { padding: '0' },
  '.cm-cursor': { borderLeftColor: 'var(--g-text)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-selectionBackground': { background: 'var(--g-accent-muted) !important' },
  '&.cm-focused .cm-selectionBackground': { background: 'var(--g-accent-muted) !important' },
  '.cm-dim': { opacity: '0.12', transition: 'opacity .15s' },
  '.cm-float-toolbar': {
    display: 'flex',
    gap: '2px',
    padding: '3px',
    background: 'var(--g-bg)',
    border: '1px solid var(--g-border)',
    borderRadius: '6px',
    boxShadow: '0 2px 10px rgba(0,0,0,.15)',
  },
  '.cm-float-toolbar button': {
    background: 'transparent',
    border: 'none',
    borderRadius: '4px',
    padding: '3px 8px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    color: 'var(--g-text)',
    fontFamily: 'inherit',
  },
  '.cm-float-toolbar button:hover': { background: 'var(--g-surface-2)' },
  '.cm-tooltip': { background: 'transparent', border: 'none', padding: '0' },
  '.cm-tooltip-above': { background: 'transparent', border: 'none' },
});

// ── Editor initialization ─────────────────────────────────────────────────────

function init(mountEl: HTMLElement, hiddenEl: HTMLTextAreaElement, micro: boolean): EditorView {
  const view = new EditorView({
    state: EditorState.create({
      doc: hiddenEl.value,
      extensions: [
        markdown(),
        history(),
        keymap.of([
          { key: 'Ctrl-b', run: (v) => wrap(v, '**', '**') },
          { key: 'Ctrl-i', run: (v) => wrap(v, '_', '_') },
          { key: 'Ctrl-k', run: (v) => {
            const url = prompt('URL:');
            if (!url) return false;
            const { from, to } = v.state.selection.main;
            const sel = v.state.sliceDoc(from, to);
            v.dispatch({ changes: { from, to, insert: `[${sel}](${url})` } });
            return true;
          }},
          { key: 'Ctrl-`', run: (v) => wrap(v, '`', '`') },
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        gripTheme,
        EditorView.lineWrapping,
        tooltipField,
        ...(micro ? [] : [
          typewriterState,
          typewriterListener,
          focusState,
          focusPlugin,
          dragDropHandler,
        ]),
        EditorView.updateListener.of((u: ViewUpdate) => {
          if (!u.docChanged) return;
          const val = u.state.doc.toString();
          hiddenEl.value = val;
          hiddenEl.dispatchEvent(new Event('input', { bubbles: true }));
          if (micro) {
            const counter = document.getElementById('micro-char-count');
            if (counter) counter.textContent = `${val.length} / 500`;
          }
        }),
      ],
    }),
    parent: mountEl,
  });

  (window as any).__gripEditor = view;

  if (!micro) {
    document.getElementById('ws-typewriter')?.addEventListener('click', function (this: HTMLButtonElement) {
      const on = !view.state.field(typewriterState);
      view.dispatch({ effects: typewriterEffect.of(on) });
      this.classList.toggle('active-mode', on);
    });

    document.getElementById('ws-focus')?.addEventListener('click', function (this: HTMLButtonElement) {
      const on = !view.state.field(focusState);
      view.dispatch({ effects: focusEffect.of(on) });
      this.classList.toggle('active-mode', on);
    });

    const shell = document.querySelector('.writing-shell');
    document.getElementById('ws-drawer-toggle')?.addEventListener('click', () => {
      shell?.classList.toggle('drawer-open');
    });
    document.getElementById('ws-drawer-close')?.addEventListener('click', () => {
      shell?.classList.remove('drawer-open');
    });
  }

  return view;
}

// ── Entry point ───────────────────────────────────────────────────────────────

(function () {
  const articleMount = document.getElementById('grip-body');
  const articleHidden = document.getElementById('grip-hidden-body') as HTMLTextAreaElement | null;
  if (articleMount && articleHidden) {
    init(articleMount, articleHidden, false);
    return;
  }

  const pageMount = document.getElementById('grip-page-body');
  const pageHidden = document.getElementById('grip-hidden-page-body') as HTMLTextAreaElement | null;
  if (pageMount && pageHidden) {
    init(pageMount, pageHidden, false);
    return;
  }

  const microMount = document.getElementById('micro-body-mount');
  const microHidden = document.getElementById('micro-body') as HTMLTextAreaElement | null;
  if (microMount && microHidden) {
    init(microMount, microHidden, true);
  }
})();
