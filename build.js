#!/usr/bin/env node

// -----------------------------------------------------------
// Minimalistic build script for brutal optimization
// Uses:
//   - esbuild to minify JS and CSS
//   - html-minifier-terser to compress HTML
// -----------------------------------------------------------

const esbuild = require('esbuild');
const { minify } = require('html-minifier-terser');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'src');
const DIST = path.join(__dirname, 'dist');

// Ensure dist exists
if (!fs.existsSync(DIST)) fs.mkdirSync(DIST);

// --------------------
// Copy & minify JS
// --------------------
esbuild.buildSync({
  entryPoints: [`${SRC}/main.js`],
  outfile: `${DIST}/main.js`,
  minify: true,
  bundle: false,
  sourcemap: false,
  target: ['es2018']
});

// --------------------
// Copy & minify CSS
// --------------------
esbuild.buildSync({
  entryPoints: [`${SRC}/style.css`],
  outfile: `${DIST}/style.css`,
  minify: true,
  bundle: false
});

// --------------------
// Minify HTML
// --------------------
(async () => {
  const html = fs.readFileSync(`${SRC}/index.html`, 'utf8');

  const minified = await minify(html, {
    collapseWhitespace: true,
    collapseBooleanAttributes: true,
    removeComments: true,
    minifyCSS: true,
    minifyJS: true
  });

  fs.writeFileSync(`${DIST}/index.html`, minified);

  console.log('✨ Build complete!');
})();

