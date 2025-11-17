// ----------------------------------------------------
// Fullscreen Hex Mesh Background (WebGL1, Ultra-Light)
// Features:
// - Calm sci-fi ambient waves
// - Mouse reactive force field
// - Mobile/tablet auto-scale (zoomed, smoother, faster)
// - Wide hex lattice covering full background
// ----------------------------------------------------

// ----------------------------------------------------
// Build hex-style lattice positions & edges
// ----------------------------------------------------
function buildHexPoints(cols, rows, cellHeight) {
  const points = [];
  for (let j = 0; j < rows; j++) {
    const offset = (j % 2) * 0.5;
    for (let i = 0; i < cols; i++) {
      points.push({ x: i + offset, y: j * cellHeight });
    }
  }
  return points;
}

function computeBounds(points) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const { x, y } of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  return {
    minX,
    minY,
    spanX: maxX - minX || 1,
    spanY: maxY - minY || 1
  };
}

function normalizePositions(points, bounds, widenFactor) {
  const positions = new Float32Array(points.length * 2);
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const nx = ((p.x - bounds.minX) / bounds.spanX) * 2 - 1;
    const ny = ((p.y - bounds.minY) / bounds.spanY) * 2 - 1;

    positions[i * 2] = nx * widenFactor;
    positions[i * 2 + 1] = ny;
  }
  return positions;
}

function buildHexEdges(cols, rows) {
  const edges = [];
  const index = (i, j) => j * cols + i;

  for (let j = 0; j < rows; j++) {
    const odd = j % 2;
    for (let i = 0; i < cols; i++) {
      const a = index(i, j);

      if (i + 1 < cols) edges.push(a, index(i + 1, j));

      if (j + 1 < rows) {
        edges.push(a, index(i, j + 1));

        const di = odd ? i + 1 : i - 1;
        if (di >= 0 && di < cols) {
          edges.push(a, index(di, j + 1));
        }
      }
    }
  }

  return new Uint16Array(edges);
}

function createHexGrid(cols, rows) {
  const cellHeight = Math.sqrt(3) * 0.5;
  const rawPoints = buildHexPoints(cols, rows, cellHeight);
  const bounds = computeBounds(rawPoints);
  const positions = normalizePositions(rawPoints, bounds, 1.25);
  const indices = buildHexEdges(cols, rows);

  return { positions, indices };
}

// ----------------------------------------------------
// Vertex Shader (with auto-scale for mobile/tablet)
// ----------------------------------------------------
const vertexSrc = `
precision mediump float;

attribute vec2 aBasePos;

uniform float uTime;
uniform vec2 uMouse;
uniform float uScale;  // <-- dynamic mesh scaling
uniform vec2 uAspect; // aspect correction so hexes stay equilateral

varying float vDist;
varying float vWave;

float waveFunc(vec2 p, float t) {
  return
    sin(p.x * 3.2 + t * 0.75) * 0.03 +
    cos(p.y * 2.4 - t * 0.58) * 0.03;
}

void main() {
  vec2 p = aBasePos;

  // Dist + dir to mouse
  vec2 toM = uMouse - p;
  float dist = length(toM);
  vec2 dir = dist > 0.0 ? toM / dist : vec2(0.0);

  // Mouse falloff
  float influence = exp(-dist * 2.3);

  // Ambient drift
  vec2 ambient =
    vec2(
      sin(uTime * 0.12 + p.y * 1.3) * 0.012,
      cos(uTime * 0.15 + p.x * 1.1) * 0.012
    );

  // Vertical wave
  float wave = waveFunc(p, uTime);

  // Force field (mixed pull/push)
  float pulse = sin(uTime * 2.0 - dist * 6.0);
  float polarity = pulse * 0.5;  // -0.5..0.5
  vec2 mouseOffset = dir * polarity * 0.18 * influence;

  // Combine and apply scale
  vec2 finalPos =
    (p + ambient + vec2(0.0, wave) + mouseOffset) * uScale;

  gl_Position = vec4(finalPos * uAspect, 0.0, 1.0);

  vDist = dist;
  vWave = abs(wave) + influence * 0.5;
}
`;

// ----------------------------------------------------
// Fragment Shader
// ----------------------------------------------------
const fragmentSrc = `
precision mediump float;

uniform float uTime;

varying float vDist;
varying float vWave;

void main() {
  vec3 base = vec3(0.62, 0.79, 1.0);

  float nearF = exp(-vDist * 2.0);

  float globalPulse = 0.5 + 0.5 * sin(uTime * 0.9);
  float localPulse  = 0.5 + 0.5 * sin(uTime * 1.8 + vDist * 7.0);

  float intensity =
      0.18 +
      0.52 * nearF +
      0.18 * vWave +
      0.12 * globalPulse * localPulse;

  intensity = clamp(intensity, 0.0, 1.0);

  float alpha = intensity * 0.9;

  float farF = clamp(vDist * 0.9, 0.0, 1.0);
  float desat = mix(1.0, 0.75, farF);

  vec3 color = base * intensity * desat;

  gl_FragColor = vec4(color, alpha);
}
`;

// ----------------------------------------------------
// WebGL setup
// ----------------------------------------------------
function createShader(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error("Shader compile error:", gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
}

function createProgram(gl, vs, fs) {
  const v = createShader(gl, gl.VERTEX_SHADER, vs);
  const f = createShader(gl, gl.FRAGMENT_SHADER, fs);
  if (!v || !f) return null;

  const p = gl.createProgram();
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.linkProgram(p);

  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error("Link error:", gl.getProgramInfoLog(p));
    gl.deleteProgram(p);
    return null;
  }
  return p;
}

// ----------------------------------------------------
// MAIN
// ----------------------------------------------------
window.addEventListener("load", () => {
  const canvas = document.getElementById("bg-canvas");
  const gl = canvas.getContext("webgl", { antialias: true });

  if (!gl) return;

  // Denser grid for desktop; auto-scale handles mobile/tablet
  const grid = createHexGrid(80, 28);

  const program = createProgram(gl, vertexSrc, fragmentSrc);
  gl.useProgram(program);

  const aBasePos = gl.getAttribLocation(program, "aBasePos");
  const uTime = gl.getUniformLocation(program, "uTime");
  const uMouse = gl.getUniformLocation(program, "uMouse");
  const uScale = gl.getUniformLocation(program, "uScale");
  const uAspect = gl.getUniformLocation(program, "uAspect");

  // Buffers
  const posBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, grid.positions, gl.STATIC_DRAW);

  const idxBuf = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, grid.indices, gl.STATIC_DRAW);

  gl.enableVertexAttribArray(aBasePos);
  gl.vertexAttribPointer(aBasePos, 2, gl.FLOAT, false, 0, 0);

  // Mouse in [-1,1]
  let targetMouse = { x: 0, y: 0 };
  let mouse = { x: 0, y: 0 };
  const aspectScale = { x: 1, y: 1 };

  document.addEventListener("mousemove", e => {
    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const ny = (e.clientY / window.innerHeight) * 2 - 1;
    targetMouse.x = nx;
    targetMouse.y = -ny;
  });

  // Resize canvas
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = (canvas.clientWidth || window.innerWidth) * dpr;
    const h = (canvas.clientHeight || window.innerHeight) * dpr;
    const aspect = h > 0 ? w / h : 1;

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }

    if (aspect >= 1) {
      aspectScale.x = 1;
      aspectScale.y = aspect;
    } else if (aspect > 0) {
      aspectScale.x = 1 / aspect;
      aspectScale.y = 1;
    } else {
      aspectScale.x = 1;
      aspectScale.y = 1;
    }
  }

  window.addEventListener("resize", resize);
  resize();

  gl.clearColor(0.01, 0.02, 0.06, 1);
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  function render(ms) {
    const t = ms * 0.001;
    resize();

    // Smooth mouse motion
    mouse.x += (targetMouse.x - mouse.x) * 0.07;
    mouse.y += (targetMouse.y - mouse.y) * 0.07;

    // Automatic mesh zoom for performance + aesthetics
    let scale;
    const w = window.innerWidth;

    if (w < 480) {
      scale = 1.8;   // small phones
    } else if (w < 768) {
      scale = 1.4;   // large phones & phablets
    } else if (w < 1024) {
      scale = 1.2;   // tablets
    } else {
      scale = 1;   // desktop
    }

    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.uniform1f(uTime, t);
    gl.uniform2f(uMouse, mouse.x, mouse.y);
    gl.uniform1f(uScale, scale);
    gl.uniform2f(uAspect, aspectScale.x, aspectScale.y);

    gl.drawElements(gl.LINES, grid.indices.length, gl.UNSIGNED_SHORT, 0);

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
});
