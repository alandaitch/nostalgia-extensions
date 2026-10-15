import { readFile, mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const base = path.dirname(fileURLToPath(import.meta.url));
const shared = ['runtime.js', 'popup.html', 'popup.css', 'popup.js'];
for (const file of shared) await copyFile(path.join(base, 'instagram-fotolog', file), path.join(base, 'reddit-taringa', file));
for (const name of ['instagram-fotolog', 'reddit-taringa']) {
  const root = path.join(base, name);
  const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
  if (manifest.manifest_version !== 3) throw new Error('Se requiere Manifest V3');
  for (const script of manifest.content_scripts[0].js) execFileSync(process.execPath, ['--check', path.join(root, script)]);
  if (manifest.background?.service_worker) execFileSync(process.execPath, ['--check', path.join(root, manifest.background.service_worker)]);
  execFileSync(process.execPath, ['--check', path.join(root, 'popup.js')]);
  for (const script of ['skin.css', 'popup.html', 'popup.css', ...Object.values(manifest.icons)]) await readFile(path.join(root, script));
  const files = [...new Set(['manifest.json', 'config.js', 'runtime.js', 'content.js',
    'skin.css', 'popup.html', 'popup.css', 'popup.js', 'LEEME.txt',
    ...Object.values(manifest.icons), ...(manifest.background?.service_worker ? [manifest.background.service_worker] : [])])];
  const archive = path.join(base, 'dist', `${name}.zip`);
  // A fresh archive avoids stale files from previous builds.
  await mkdir(path.dirname(archive), { recursive: true });
  execFileSync('python3', ['-c', `import pathlib,zipfile,sys
root=pathlib.Path(sys.argv[1]); output=pathlib.Path(sys.argv[2]); files=sys.argv[3:]
with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as z:
 for file in sorted(files):
  p=root/file
  if not p.is_file(): raise SystemExit('Missing package file: '+file)
  z.write(p,file)
with zipfile.ZipFile(output) as z:
 assert 'manifest.json' in z.namelist(), 'manifest.json must be at ZIP root'
 assert z.testzip() is None, 'Corrupt ZIP'
`, root, archive, ...files]);
  console.log(`${manifest.name}: ${files.length} entradas, ZIP listo.`);
}
