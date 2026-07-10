// Builds the entire app into one self-contained HTML file: docs/index.html.
// GitHub Pages (Settings → Pages → main branch, /docs folder) serves that file
// directly, so the deployed app is whatever was last committed there.
const esbuild = require('esbuild');
const fs = require('fs');

(async () => {
  const result = await esbuild.build({
    entryPoints: ['src/app.jsx'],
    bundle: true,
    minify: true,
    format: 'iife',
    target: ['safari15'],
    jsx: 'automatic',
    write: false,
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  const js = result.outputFiles[0].text;
  const template = fs.readFileSync('template.html', 'utf8');
  const html = template.replace('/*BUNDLE*/', () => js.replace(/<\/script>/gi, '<\\/script>'));
  fs.mkdirSync('docs', { recursive: true });
  fs.writeFileSync('docs/index.html', html);
  console.log('Built docs/index.html —', (html.length / 1024).toFixed(0) + ' KB');
})().catch((e) => { console.error(e); process.exit(1); });
