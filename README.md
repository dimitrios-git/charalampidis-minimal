# charalampidis-minimal  
_A brutally minimal personal contact page with a custom WebGL background.  
Zero frameworks, zero tracking, zero dependencies at runtime._

## ✨ Overview
This project powers the current version of **https://charalampidis.pro/** —  
a single-page contact card built entirely with:

- **Vanilla HTML**
- **Vanilla CSS**
- **Vanilla JavaScript (WebGL 1.0)**
- **No frameworks**
- **No runtime dependencies**
- **No analytics, no cookies, no tracking**

The background is a custom ultra-light WebGL hex-mesh animation  
designed to run smoothly on desktop and mobile with minimal GPU load.

The total transfer size (HTML + CSS + JS) is **~3 KB gzipped**.

## 📁 Project Structure

```
charalampidis-minimal/
├── src/
│   ├── index.html
│   ├── style.css
│   └── main.js
├── dist/
│   ├── index.html
│   ├── style.css
│   └── main.js
├── build.js
├── package.json
└── README.md
```

## 🛠️ Build Setup

Install development dependencies:

```bash
npm install
```

Build for production:

```bash
npm run build
```

This produces a fully-minified, optimized snapshot in `/dist`.

### What the build does:
- Minifies CSS
- Minifies JS
- Preserves shader code safely
- Minifies HTML (whitespace, comments, attributes)
- Copies all assets to `/dist`

## 🚀 Deployment

Deploy the contents of `dist/` to any static host:

```bash
rsync -av dist/ myserver:public_html/charalampidispro/
```

Disable **mod_pagespeed** on the server for best performance.

## 🎨 WebGL Background

Features:
- Ambient wave motion
- Mouse-reactive force fields (desktop)
- Auto-zoom scaling for mobile
- One draw call per frame
- Low CPU/GPU footprint

## 📦 Philosophy

Avoids:
- Frameworks
- External fonts
- Tracking
- Analytics
- Cookie banners

## 📜 License

MIT License  
© Dimitrios Charalampidis
