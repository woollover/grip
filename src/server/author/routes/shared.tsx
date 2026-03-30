// Shared author panel UI components

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
    <>
      <button type="button" class="btn btn-ghost btn-sm" onclick="setImgAlign('left')">← L</button>
      <button type="button" class="btn btn-ghost btn-sm" onclick="setImgAlign('center')">C</button>
      <button type="button" class="btn btn-ghost btn-sm" onclick="setImgAlign('right')">R →</button>
      <script>{script}</script>
    </>
  );
}
