'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const DEFAULTS = { centerFrost: 82, edgeFrost: 18, panelFrost: 62, blur: 10, position: 'center', chrome: true };
const MAX_BYTES = 25 * 1024 * 1024;
const TYPES = [
  { mime: 'image/png', test: b => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { mime: 'image/jpeg', test: b => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/webp', test: b => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
];

function atomicWrite(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${randomUUID()}.tmp`;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, file);
}

function activate(ctx) {
  const dir = ctx.dataDirectory;
  const settingsFile = path.join(dir, 'settings.json');
  const imageFile = path.join(dir, 'image.bin');
  const read = () => { try { return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(settingsFile, 'utf8')) }; } catch { return { ...DEFAULTS }; } };
  const notify = () => ctx.events.emit('changed');
  const clamp = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : undefined);

  const ops = {
    'get-state': () => {
      const s = read();
      let image = null;
      if (s.imageMime) { try { image = fs.readFileSync(imageFile).toString('base64'); } catch { image = null; } }
      return { settings: s, image, mime: image ? s.imageMime : null };
    },
    'set-image': ({ data }) => {
      if (typeof data !== 'string') throw new Error('No image data.');
      const bytes = Buffer.from(data, 'base64');
      if (bytes.length > MAX_BYTES) throw new Error('That image is over 25 MB. Export a smaller JPEG or WebP.');
      const type = TYPES.find(t => t.test(bytes));
      if (!type) throw new Error('Use a PNG, JPEG or WebP image.');
      atomicWrite(imageFile, bytes);
      atomicWrite(settingsFile, JSON.stringify({ ...read(), imageMime: type.mime }));
      notify(); return { ok: true };
    },
    'clear-image': () => {
      const s = read(); delete s.imageMime;
      atomicWrite(settingsFile, JSON.stringify(s));
      fs.rmSync(imageFile, { force: true });
      notify(); return { ok: true };
    },
    'save-settings': (patch) => {
      const s = read();
      for (const k of ['centerFrost', 'edgeFrost', 'panelFrost']) if (k in patch) { const v = clamp(patch[k], 0, 100); if (v === undefined) throw new Error(`Invalid ${k}.`); s[k] = v; }
      if ('blur' in patch) { const v = clamp(patch.blur, 0, 30); if (v === undefined) throw new Error('Invalid blur.'); s.blur = v; }
      if ('position' in patch) { if (!['center', 'left', 'right', 'top', 'bottom'].includes(patch.position)) throw new Error('Invalid position.'); s.position = patch.position; }
      if ('chrome' in patch) { if (typeof patch.chrome !== 'boolean') throw new Error('Invalid chrome setting.'); s.chrome = patch.chrome; }
      atomicWrite(settingsFile, JSON.stringify(s));
      notify(); return { settings: s };
    },
  };
  for (const [name, fn] of Object.entries(ops)) ctx.cleanup(ctx.handle(name, (input = {}) => fn(input && typeof input === 'object' ? input : {})));
}
module.exports = { activate };
