// Shared author panel UI components
import type { Database } from 'bun:sqlite';

export function getSiteHost(db: Database): string {
  return (db.prepare("SELECT value FROM config WHERE key = 'domain'").get() as { value: string } | null)?.value || 'localhost:3000';
}

export function AlignPicker(): JSX.Element {
  const script = `
    function setImgAlign(v) {
      var ta = document.getElementById('body');
      if (!ta) return;
      var sel = ta.value.substring(ta.selectionStart, ta.selectionEnd);
      var img = sel.match(/!\\[([^\\]]*)\\]\\(([^)]+)\\)/);
      if (!img) return;
      var styles = { left: 'float:left;margin:0 1rem 1rem 0', center: 'display:block;margin:0 auto', right: 'float:right;margin:0 0 1rem 1rem' };
      var replacement = '<img src="' + img[2] + '" alt="' + img[1] + '" style="' + styles[v] + '">';
      ta.setRangeText(replacement, ta.selectionStart, ta.selectionEnd, 'end');
    }
  `;
  return (
    <div style="display:flex;gap:0.5rem;margin-bottom:0.5rem">
      <button type="button" class="outline secondary" style="padding:0.2rem 0.6rem" onclick="setImgAlign('left')">← Left</button>
      <button type="button" class="outline secondary" style="padding:0.2rem 0.6rem" onclick="setImgAlign('center')">Center</button>
      <button type="button" class="outline secondary" style="padding:0.2rem 0.6rem" onclick="setImgAlign('right')">Right →</button>
      <script>{script}</script>
    </div>
  );
}
