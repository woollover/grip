/**
 * GRIP markdown editor toolbar
 * Zero dependencies. Attaches to <textarea data-md-editor> (full) or
 * <textarea data-md-editor="mini"> (bold/italic/link/image only).
 */
(function () {
  'use strict';

  // ── Text manipulation primitives ────────────────────────────────────────────

  function emit(ta) {
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
  }

  /** Wrap selection (or insert placeholder) with before/after markers. */
  function wrap(ta, before, after, placeholder) {
    const s = ta.selectionStart, e = ta.selectionEnd;
    const sel = ta.value.slice(s, e);
    const inner = sel || placeholder || '';
    ta.setRangeText(before + inner + after, s, e, 'end');
    if (!sel && placeholder) {
      ta.selectionStart = s + before.length;
      ta.selectionEnd   = s + before.length + placeholder.length;
    }
    ta.focus();
    emit(ta);
  }

  /** Toggle a line prefix (e.g. '# ', '- ', '> ') on each selected line. */
  function linePrefix(ta, prefix) {
    const s = ta.selectionStart, e = ta.selectionEnd;
    const val = ta.value;
    const lineStart = val.lastIndexOf('\n', s - 1) + 1;
    const chunk = val.slice(lineStart, e);
    const lines = chunk.split('\n');
    const allHave = lines.every(l => l.startsWith(prefix));
    const mapped = allHave
      ? lines.map(l => l.slice(prefix.length))
      : lines.map(l => prefix + l);
    ta.setRangeText(mapped.join('\n'), lineStart, e, 'end');
    ta.focus();
    emit(ta);
  }

  /** Insert a block-level element with surrounding blank lines. */
  function insertBlock(ta, text) {
    const s = ta.selectionStart;
    const before = ta.value.slice(0, s);
    const pad = !before.length ? ''
              : before.endsWith('\n\n') ? ''
              : before.endsWith('\n')   ? '\n'
              : '\n\n';
    ta.setRangeText(pad + text + '\n\n', s, s, 'end');
    ta.focus();
    emit(ta);
  }

  // ── Action handlers ─────────────────────────────────────────────────────────

  function doAction(ta, action) {
    switch (action) {
      case 'h1': linePrefix(ta, '# ');  break;
      case 'h2': linePrefix(ta, '## '); break;
      case 'h3': linePrefix(ta, '### ');break;
      case 'bold':   wrap(ta, '**', '**', 'bold text');   break;
      case 'italic': wrap(ta, '_',  '_',  'italic text'); break;
      case 'strike': wrap(ta, '~~', '~~', 'text');        break;
      case 'quote':  linePrefix(ta, '> '); break;
      case 'code':   wrap(ta, '`', '`', 'code'); break;
      case 'ul':     linePrefix(ta, '- ');  break;
      case 'ol':     linePrefix(ta, '1. '); break;
      case 'hr':     insertBlock(ta, '---'); break;

      case 'codeblock': {
        const s = ta.selectionStart, e = ta.selectionEnd;
        const sel = ta.value.slice(s, e);
        if (sel) {
          wrap(ta, '```\n', '\n```');
        } else {
          const before = ta.value.slice(0, s);
          const pad = !before.length ? ''
                    : before.endsWith('\n\n') ? ''
                    : before.endsWith('\n')   ? '\n'
                    : '\n\n';
          const snippet = pad + '```\n\n```\n\n';
          ta.setRangeText(snippet, s, s, 'end');
          // Place cursor inside the block
          const cur = s + pad.length + 4;
          ta.selectionStart = ta.selectionEnd = cur;
          ta.focus();
          emit(ta);
        }
        break;
      }

      case 'link': {
        const s = ta.selectionStart, e = ta.selectionEnd;
        const sel = ta.value.slice(s, e);
        if (sel) {
          // Has selection → use it as link text, select 'url' for easy typing
          ta.setRangeText(`[${sel}](url)`, s, e, 'end');
          ta.selectionStart = s + 1 + sel.length + 2;
          ta.selectionEnd   = s + 1 + sel.length + 2 + 3; // 'url'
        } else {
          // No selection → insert template, select 'link text'
          ta.setRangeText('[link text](url)', s, e, 'end');
          ta.selectionStart = s + 1;
          ta.selectionEnd   = s + 10; // 'link text'
        }
        ta.focus();
        emit(ta);
        break;
      }
    }
  }

  // ── Image upload ─────────────────────────────────────────────────────────────

  function uploadImage(ta, file, imgBtn) {
    const origLabel = imgBtn ? imgBtn.textContent : '';
    if (imgBtn) { imgBtn.disabled = true; imgBtn.textContent = '…'; }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('altText', file.name.replace(/\.[^.]+$/, ''));
    fetch('/media/upload', { method: 'POST', body: formData })
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(data => {
        const s = ta.selectionStart, e = ta.selectionEnd;
        ta.setRangeText(`![${data.alt}](/media/${data.id})`, s, e, 'end');
        ta.focus();
        emit(ta);
      })
      .catch(err => alert('Image upload failed: ' + err.message))
      .finally(() => {
        if (imgBtn) { imgBtn.disabled = false; imgBtn.textContent = origLabel; }
      });
  }

  // ── Toolbar definitions ──────────────────────────────────────────────────────

  const SEP = { type: 'sep' };

  const FULL = [
    { label: 'H1', title: 'Heading 1',          action: 'h1',        css: 'font-weight:700;font-size:0.68rem' },
    { label: 'H2', title: 'Heading 2',          action: 'h2',        css: 'font-weight:600;font-size:0.65rem' },
    { label: 'H3', title: 'Heading 3',          action: 'h3',        css: 'font-weight:500;font-size:0.62rem' },
    SEP,
    { label: 'B',  title: 'Bold (Ctrl+B)',       action: 'bold',      css: 'font-weight:700' },
    { label: 'I',  title: 'Italic (Ctrl+I)',     action: 'italic',    css: 'font-style:italic' },
    { label: 'S',  title: 'Strikethrough',       action: 'strike',    css: 'text-decoration:line-through' },
    SEP,
    { label: 'link', title: 'Link (Ctrl+K)',     action: 'link' },
    { label: 'img',  title: 'Image (drag & drop also works)', action: 'image' },
    SEP,
    { label: '"',  title: 'Blockquote',          action: 'quote' },
    { label: '`',  title: 'Inline code',         action: 'code',      css: 'font-family:monospace' },
    { label: '```',title: 'Code block',          action: 'codeblock', css: 'font-family:monospace;font-size:0.62rem' },
    SEP,
    { label: '—',  title: 'Horizontal rule',     action: 'hr' },
    { label: '•',  title: 'Unordered list',      action: 'ul' },
    { label: '1.', title: 'Ordered list',        action: 'ol',        css: 'font-size:0.7rem' },
  ];

  const MINI = [
    { label: 'B',    title: 'Bold (Ctrl+B)',     action: 'bold',   css: 'font-weight:700' },
    { label: 'I',    title: 'Italic (Ctrl+I)',   action: 'italic', css: 'font-style:italic' },
    SEP,
    { label: 'link', title: 'Link (Ctrl+K)',     action: 'link' },
    { label: 'img',  title: 'Image',             action: 'image' },
    SEP,
    { label: '`',    title: 'Inline code',       action: 'code',   css: 'font-family:monospace' },
  ];

  // ── Build & attach ──────────────────────────────────────────────────────────

  function initEditor(ta) {
    const mode  = ta.dataset.mdEditor === 'mini' ? 'mini' : 'full';
    const items = mode === 'mini' ? MINI : FULL;

    // Wrap textarea
    const editorEl = document.createElement('div');
    editorEl.className = 'md-editor';
    ta.parentNode.insertBefore(editorEl, ta);

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'md-toolbar';
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-label', 'Markdown formatting');

    // Hidden file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.cssText = 'display:none';
    toolbar.appendChild(fileInput);

    let imgBtn = null;
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (file) uploadImage(ta, file, imgBtn);
      fileInput.value = '';
    });

    // Buttons
    for (const item of items) {
      if (item.type === 'sep') {
        const sep = document.createElement('span');
        sep.className = 'md-toolbar-sep';
        sep.setAttribute('aria-hidden', 'true');
        toolbar.appendChild(sep);
        continue;
      }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'md-btn';
      btn.textContent = item.label;
      btn.title = item.title;
      if (item.css) btn.style.cssText = item.css;
      btn.addEventListener('click', () => {
        if (item.action === 'image') { fileInput.click(); return; }
        doAction(ta, item.action);
      });
      if (item.action === 'image') imgBtn = btn;
      toolbar.appendChild(btn);
    }

    editorEl.appendChild(toolbar);
    editorEl.appendChild(ta);

    // Keyboard shortcuts
    ta.addEventListener('keydown', e => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.key === 'b') { e.preventDefault(); doAction(ta, 'bold'); }
      if (e.key === 'i') { e.preventDefault(); doAction(ta, 'italic'); }
      if (e.key === 'k') { e.preventDefault(); doAction(ta, 'link'); }
    });

    // Drag-and-drop images onto textarea
    ta.addEventListener('dragover', e => { e.preventDefault(); ta.classList.add('md-drag'); });
    ta.addEventListener('dragleave', () => ta.classList.remove('md-drag'));
    ta.addEventListener('drop', e => {
      e.preventDefault();
      ta.classList.remove('md-drag');
      const file = e.dataTransfer && e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) uploadImage(ta, file, imgBtn);
    });
  }

  document.querySelectorAll('textarea[data-md-editor]').forEach(initEditor);
})();
