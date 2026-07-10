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
    loader: { '.md': 'text' },
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  const js = result.outputFiles[0].text;
  const template = fs.readFileSync('template.html', 'utf8');
  const html = template.replace('/*BUNDLE*/', () => js.replace(/<\/script>/gi, '<\\/script>'));
  fs.mkdirSync('docs', { recursive: true });
  fs.writeFileSync('docs/index.html', html);
  // Stable public guide URL — a stub that redirects into the app's built-in
  // Help view. Emitted every build so it can never drift from the app.
  fs.writeFileSync('docs/guide.html', `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="refresh" content="0; url=./#help" />
<title>TrainerPad Guide</title>
</head>
<body>
<p>Opening the TrainerPad guide… <a href="./#help">Continue to the guide</a>.</p>
</body>
</html>
`);
  console.log('Built docs/index.html —', (html.length / 1024).toFixed(0) + ' KB (+ docs/guide.html)');
})().catch((e) => { console.error(e); process.exit(1); });
