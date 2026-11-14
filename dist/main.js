// Backdrop — your image behind LearnHarness, with a frosted reading area.
// The host owns <html>'s class and inline style (theme switches rewrite them),
// so every rule lives in one <style> element that this plugin owns.
const BASE_CSS = `
/* ---- The image layer: fixed behind everything, with a frost wash that is
   strong in the reading area and light at the edges. Uses the active
   theme's background color, so it works with light and dark themes. ---- */
{ background-color: var(--background); }
body { background: transparent !important; }
body::before {
  content: ""; position: fixed; inset: 0; z-index: -1; pointer-events: none;
  background-image:
    radial-gradient(ellipse 62% 70% at 50% 46%,
      color-mix(in srgb, var(--background) var(--lhb-center, 82%), transparent) 0%,
      color-mix(in srgb, var(--background) var(--lhb-center, 82%), transparent) 45%,
      color-mix(in srgb, var(--background) var(--lhb-edge, 18%), transparent) 100%),
    var(--lhb-image);
  background-size: 100% 100%, cover;
  background-position: center, var(--lhb-pos, center);
  background-repeat: no-repeat;
}

/* ---- Frosted glass panels ---- */
aside.sidebar-motion > div {
  background: color-mix(in srgb, var(--background) var(--lhb-panel, 62%), transparent) !important;
  backdrop-filter: blur(var(--lhb-blur, 10px)) saturate(1.1);
  -webkit-backdrop-filter: blur(var(--lhb-blur, 10px)) saturate(1.1);
}
[data-attachment-composer],
.lh-wco-floating .rounded-xl.border,
[data-testid="session-kind-filter"],
[data-testid="home-mode-switch"] {
  background: color-mix(in srgb, var(--card) var(--lhb-panel, 62%), transparent) !important;
  backdrop-filter: blur(var(--lhb-blur, 10px));
  -webkit-backdrop-filter: blur(var(--lhb-blur, 10px));
}
`;
const CHROME_CSS = `
/* ---- Chrome: bevelled metal-and-glass controls. Built from the theme's own
   card color, so it reads as silver on light themes and gunmetal on dark. ---- */
[data-attachment-composer],
.lh-wco-floating .rounded-xl.border,
[data-testid="stats-model"],
[data-testid="stats-thinking"],
[data-testid="dictation-toggle"],
[data-testid="session-kind-filter"],
[data-testid="home-mode-switch"] {
  background:
    linear-gradient(180deg,
      color-mix(in srgb, white 55%, transparent) 0%,
      color-mix(in srgb, white 12%, transparent) 48%,
      transparent 52%,
      color-mix(in srgb, black 6%, transparent) 100%),
    color-mix(in srgb, var(--card) var(--lhb-panel, 62%), transparent) !important;
  border: 1px solid color-mix(in srgb, var(--border) 70%, var(--foreground) 22%) !important;
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 75%, transparent),
    inset 0 -1px 0 color-mix(in srgb, black 14%, transparent),
    0 1px 2px color-mix(in srgb, black 18%, transparent),
    0 4px 14px color-mix(in srgb, black 10%, transparent) !important;
}
button[aria-label="Start session"],
[data-attachment-composer] button.bg-primary,
[data-testid="session-kind-filter"] .bg-accent,
[data-testid="home-mode-switch"] .bg-accent {
  background:
    linear-gradient(180deg,
      color-mix(in srgb, white 70%, var(--card)) 0%,
      color-mix(in srgb, white 25%, var(--card)) 50%,
      color-mix(in srgb, black 8%, var(--card)) 51%,
      color-mix(in srgb, white 10%, var(--card)) 100%) !important;
  color: var(--foreground) !important;
  border: 1px solid color-mix(in srgb, var(--border) 50%, var(--foreground) 35%) !important;
  box-shadow: inset 0 1px 0 color-mix(in srgb, white 85%, transparent), 0 1px 3px color-mix(in srgb, black 25%, transparent) !important;
}
[data-testid="sidebar-actions"] button:hover,
[data-testid="settings-entry"]:hover {
  background: linear-gradient(180deg, color-mix(in srgb, white 45%, transparent), color-mix(in srgb, white 8%, transparent)) !important;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--border) 70%, var(--foreground) 20%);
}
`;
const POSITIONS = { center: 'center center', left: 'left center', right: 'right center', top: 'center top', bottom: 'center bottom' };

export function activate(ctx) {
  let objectUrl = null;
  let state = null;

  const styleEl = document.createElement('style');
  styleEl.id = 'lhb-backdrop';
  function css(s) {
    return `:root {
  --lhb-image: url("${objectUrl}");
  --lhb-center: ${s.centerFrost}%; --lhb-edge: ${s.edgeFrost}%; --lhb-panel: ${s.panelFrost}%;
  --lhb-blur: ${s.blur}px; --lhb-pos: ${POSITIONS[s.position] || POSITIONS.center};
}
${BASE_CSS}
${s.chrome ? CHROME_CSS : ''}`;
  }
  function apply() {
    const s = state && state.settings;
    if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
    if (!s || !state.image) { styleEl.remove(); return; }
    const bytes = Uint8Array.from(atob(state.image), c => c.charCodeAt(0));
    objectUrl = URL.createObjectURL(new Blob([bytes], { type: state.mime }));
    styleEl.textContent = css(s);
    if (!styleEl.isConnected) document.head.append(styleEl);
  }
  // Slider moves only rewrite the stylesheet text; the image URL is reused.
  function applyVars(s) {
    if (objectUrl && styleEl.isConnected) styleEl.textContent = css(s);
  }
  async function load() {
    try { state = await ctx.call('get-state'); apply(); } catch (error) { console.error('[backdrop]', error); }
  }

  ctx.cleanup(() => { styleEl.remove(); if (objectUrl) URL.revokeObjectURL(objectUrl); });
  ctx.onResync(() => void load());

  void load();
  ctx.registerSettings((container, signal) => {
    {
      const wrap = document.createElement('div');
      wrap.className = 'lhb-settings';
      const preview = document.createElement('div');
      preview.className = 'lhb-preview';
      const status = document.createElement('p');
      status.className = 'lhb-status';
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/png,image/jpeg,image/webp'; input.hidden = true;
      const choose = document.createElement('button');
      choose.type = 'button'; choose.className = 'lhb-btn'; choose.textContent = 'Choose image';
      const remove = document.createElement('button');
      remove.type = 'button'; remove.className = 'lhb-btn lhb-quiet'; remove.textContent = 'Remove image';
      const buttons = document.createElement('div');
      buttons.className = 'lhb-buttons';
      buttons.append(choose, remove, input);
      const hint = document.createElement('p');
      hint.className = 'lhb-hint';
      hint.textContent = 'PNG, JPEG or WebP. The image covers the window like a wallpaper: edges are cropped, never stretched. Images in your screen\'s shape fit best (Mac: 16:10, e.g. 2880×1800).';
      const rowsSlot = document.createElement('div');
      wrap.append(preview, buttons, status, hint, rowsSlot);
      container.append(wrap);
      let rows = null;

      function renderPreview() {
        preview.style.backgroundImage = objectUrl ? `url("${objectUrl}")` : '';
        preview.textContent = objectUrl ? '' : 'No image chosen';
        preview.style.backgroundPosition = POSITIONS[state?.settings?.position] || 'center';
        remove.hidden = !objectUrl;
      }
      function renderRows() {
        // Synchronous onChange keeps slider drags smooth: the look updates at
        // once, and the save to disk is debounced.
        let timer = null, pending = {};
        const save = patch => {
          state.settings = { ...state.settings, ...patch };
          applyVars(state.settings);
          renderPreview(); rows.update({ rows: schema() });
          pending = { ...pending, ...patch };
          clearTimeout(timer);
          timer = setTimeout(() => {
            const body = pending; pending = {};
            ctx.call('save-settings', body).catch(error => { status.textContent = `Not saved: ${error.message}`; });
          }, 400);
        };
        const schema = () => [
          { key: 'centerFrost', type: 'slider', label: 'Reading area frost', description: 'How much the middle of the screen hides the image. Higher is calmer to read on.', min: 0, max: 100, step: 1, value: state.settings.centerFrost, onChange: v => save({ centerFrost: v }) },
          { key: 'edgeFrost', type: 'slider', label: 'Edge frost', description: 'How faded the art is at the edges and corners.', min: 0, max: 100, step: 1, value: state.settings.edgeFrost, onChange: v => save({ edgeFrost: v }) },
          { key: 'panelFrost', type: 'slider', label: 'Panel frost', description: 'Sidebar, input bar and buttons: how opaque their frosted glass is.', min: 0, max: 100, step: 1, value: state.settings.panelFrost, onChange: v => save({ panelFrost: v }) },
          { key: 'blur', type: 'slider', label: 'Glass blur', description: 'Blur of the image seen through panels, in pixels.', min: 0, max: 30, step: 1, value: state.settings.blur, onChange: v => save({ blur: v }) },
          { key: 'position', type: 'dropdown', label: 'Keep visible when cropped', description: 'Which part of the image stays in view when the window shape differs from the image.', value: state.settings.position, options: [{ value: 'center', label: 'Center' }, { value: 'left', label: 'Left side' }, { value: 'right', label: 'Right side' }, { value: 'top', label: 'Top' }, { value: 'bottom', label: 'Bottom' }], onChange: v => save({ position: v }) },
          { key: 'chrome', type: 'toggle', label: 'Chrome controls', description: 'Bevelled metal-and-glass styling for buttons, chips and the input bar.', value: state.settings.chrome, onChange: v => save({ chrome: v }) },
        ];
        if (rows) rows.update({ rows: schema() });
        else rows = ctx.ui.mountSettingsRows(rowsSlot, { rows: schema() }, { signal });
      }

      choose.addEventListener('click', () => input.click(), { signal });
      input.addEventListener('change', async () => {
        const file = input.files && input.files[0];
        if (!file) return;
        status.textContent = 'Saving…';
        try {
          const buffer = new Uint8Array(await file.arrayBuffer());
          let binary = '';
          for (let i = 0; i < buffer.length; i += 0x8000) binary += String.fromCharCode.apply(null, buffer.subarray(i, i + 0x8000));
          await ctx.call('set-image', { data: btoa(binary) });
          await load();
          status.textContent = `Using ${file.name}.`;
          renderPreview();
        } catch (error) { status.textContent = error.message; }
        input.value = '';
      }, { signal });
      remove.addEventListener('click', async () => {
        try { await ctx.call('clear-image'); await load(); status.textContent = 'Image removed.'; renderPreview(); }
        catch (error) { status.textContent = error.message; }
      }, { signal });

      (async () => {
        if (!state) await load();
        if (signal.aborted || !state) return;
        renderPreview(); renderRows();
      })();
    }
  });
}
