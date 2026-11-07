// Turns the Vite build (dist/) into a claude.ai Artifact page: artifact/index.html plus its assets.
// The Artifact host wraps the page in its own <html>/<head>/<body>, so only the content is written.
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve('dist');
const out = path.resolve('artifact');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'assets'), { recursive: true });
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const css = [...html.matchAll(/<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+)"/g)].map((m) => m[1]);
const js = [...html.matchAll(/<script type="module"[^>]*src="\.\/(assets\/[^"]+)"/g)].map((m) => m[1]);
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>')).replace(/<script[^>]*><\/script>/g, '').trim();
for (const f of [...css, ...js]) fs.copyFileSync(path.join(dist, f), path.join(out, f));
const page = `<title>Neustadt</title>
<style>html,body{height:100%;margin:0;background:#14202e;color-scheme:dark;overflow:hidden}</style>
${css.map((f) => `<link rel="stylesheet" href="${f}">`).join('\n')}
${body}
${js.map((f) => `<script type="module" src="${f}"></script>`).join('\n')}
`;
fs.writeFileSync(path.join(out, 'index.html'), page);
const files = Object.fromEntries([...css, ...js].map((f) => [f, `artifact/${f}`]));
fs.writeFileSync(path.join(out, 'files.json'), JSON.stringify(files, null, 2));
console.log('artifact page written:', Object.keys(files).join(', '));
