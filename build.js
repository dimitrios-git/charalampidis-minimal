#!/usr/bin/env node

import esbuild from 'esbuild';
import { minify } from 'html-minifier-terser';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC = path.join(__dirname, 'src');
const DIST = path.join(__dirname, 'dist');
const STATIC_FILES = ['favicon.svg', '.htaccess', 'robots.txt'];

if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });

function buildJS() {
  esbuild.buildSync({
    entryPoints: [path.join(SRC, 'main.js')],
    outfile: path.join(DIST, 'main.js'),
    minify: true,
    bundle: false,
    sourcemap: false,
    target: ['es2018']
  });
}

function buildCSS() {
  esbuild.buildSync({
    entryPoints: [path.join(SRC, 'style.css')],
    outfile: path.join(DIST, 'style.css'),
    minify: true,
    bundle: false
  });
}

async function buildHTML() {
  const html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
  const minified = await minify(html, {
    collapseWhitespace: true,
    collapseBooleanAttributes: true,
    removeComments: true,
    minifyCSS: true,
    minifyJS: true
  });
  fs.writeFileSync(path.join(DIST, 'index.html'), minified);
}

function copyStaticFiles() {
  for (const file of STATIC_FILES) {
    const sourcePath = path.join(SRC, file);
    if (fs.existsSync(sourcePath)) {
      const targetPath = path.join(DIST, file);
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

try {
  buildJS();
  buildCSS();
  await buildHTML();
  copyStaticFiles();
  console.log('✨ Build complete!');
} catch (err) {
  console.error(err);
  process.exitCode = 1;
}
