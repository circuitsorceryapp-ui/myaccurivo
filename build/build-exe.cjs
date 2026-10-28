// Accurivo exe builder — no npm/npx needed: downloads postject + commander
// tarballs and Windows node.exe directly, then builds:
//   accurivo-linux   (from this node binary, via Node SEA)
//   accurivo.exe     (Windows, from official node.exe)
// Run: node build/build-exe.cjs
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execFileSync } = require('child_process');

const HERE = __dirname;
const TOOLS = path.join(HERE, 'tools');
const POSTJECT = path.join(TOOLS, 'postject', 'package');
const FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('download failed ' + res.status + ' ' + url);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.promises.writeFile(dest, buf);
  return buf;
}

// minimal tar extractor with GNU longname support
function extractTar(tarballBuf, outDir, strip) {
  fs.mkdirSync(outDir, { recursive: true });
  let pos = 0;
  let longName = null;
  const s = (o, n) => tarballBuf.toString('utf8', o, o + n);
  while (pos + 512 <= tarballBuf.length) {
    const header = tarballBuf.subarray(pos, pos + 512);
    if (header.every((b) => b === 0)) break;
    const name = longName || s(pos, 100).replace(/\0.*$/, '');
    longName = null;
    const size = parseInt(s(pos + 124, 12).replace(/\0.*$/, '').trim(), 8) || 0;
    const type = s(pos + 156, 1);
    const data = tarballBuf.subarray(pos + 512, pos + 512 + size);
    pos += 512 + Math.ceil(size / 512) * 512;
    if (type === 'L') { longName = data.toString('utf8').replace(/\0.*$/, ''); continue; }
    if (type === '0' || type === '\0') {
      const rel = name.split('/').slice(strip).join('/');
      if (!rel || rel.endsWith('/')) continue;
      const dest = path.join(outDir, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, data);
    }
  }
}

async function main() {
  console.log('1) bundle…');
  execFileSync(process.execPath, [path.join(HERE, 'make-bundle.cjs')], { stdio: 'inherit' });

  console.log('2) tools (postject + commander)…');
  if (!fs.existsSync(path.join(POSTJECT, 'dist', 'cli.js'))) {
    const tgz = await download('https://registry.npmjs.org/postject/-/postject-1.0.0-alpha.6.tgz', '/tmp/postject.tgz');
    extractTar(zlib.gunzipSync(tgz), path.join(TOOLS, 'postject', 'package'), 1);
    const cmd = await download('https://registry.npmjs.org/commander/-/commander-11.0.0.tgz', '/tmp/commander.tgz');
    extractTar(zlib.gunzipSync(cmd), path.join(POSTJECT, 'node_modules', 'commander'), 1);
    const idx = path.join(POSTJECT, 'node_modules', 'commander', 'index.js');
    if (!fs.existsSync(idx)) fs.writeFileSync(idx, 'module.exports = require("./lib/index.js");\n');
    console.log('   tools ready');
  }

  // ---------- Linux ----------
  console.log('3) linux exe…');
  const nodeBin = process.execPath;
  const linuxOut = path.join(HERE, 'accurivo-linux');
  fs.copyFileSync(nodeBin, linuxOut);
  fs.chmodSync(linuxOut, 0o755);
  execFileSync(process.execPath, ['--experimental-sea-config', path.join(HERE, 'sea-linux.json')], { cwd: HERE, stdio: 'inherit' });
  execFileSync(process.execPath, [path.join(POSTJECT, 'dist', 'cli.js'), linuxOut, 'NODE_SEA_BLOB', path.join(HERE, 'accurivo.blob'), '--sentinel-fuse', FUSE], { stdio: 'inherit' });
  console.log('   accurivo-linux ready (' + Math.round(fs.statSync(linuxOut).size / 1048576) + ' MB)');

  // ---------- Windows ----------
  console.log('4) windows exe…');
  const nodeExe = path.join(HERE, 'node.exe');
  if (!fs.existsSync(nodeExe) || fs.statSync(nodeExe).size < 10 * 1024 * 1024) {
    console.log('   downloading node.exe v22.20.0 win-x64…');
    await download('https://nodejs.org/dist/v22.20.0/win-x64/node.exe', nodeExe);
  }
  const winOut = path.join(HERE, 'accurivo.exe');
  fs.copyFileSync(nodeExe, winOut);
  execFileSync(process.execPath, ['--experimental-sea-config', path.join(HERE, 'sea-win.json')], { cwd: HERE, stdio: 'inherit' });
  execFileSync(process.execPath, [path.join(POSTJECT, 'dist', 'cli.js'), winOut, 'NODE_SEA_BLOB', path.join(HERE, 'accurivo-win.blob'), '--sentinel-fuse', FUSE], { stdio: 'inherit' });
  console.log('   accurivo.exe ready (' + Math.round(fs.statSync(winOut).size / 1048576) + ' MB)');

  console.log('DONE');
}
main().catch((e) => { console.error('BUILD FAILED:', e.message); process.exit(1); });
