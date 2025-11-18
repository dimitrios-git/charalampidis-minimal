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
  const neighborOffsets = [
    [
      [1, 0],
      [0, 1],
      [-1, 1]
    ],
    [
      [1, 0],
      [0, 1],
      [1, 1]
    ]
  ];

  for (let j = 0; j < rows; j++) {
    const neighbors = neighborOffsets[j % 2];
    for (let i = 0; i < cols; i++) {
      const a = index(i, j);
      for (const [dx, dy] of neighbors) {
        const ni = i + dx;
        const nj = j + dy;
        if (ni < 0 || ni >= cols || nj < 0 || nj >= rows) continue;
        edges.push(a, index(ni, nj));
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

const meshLevels = [
  { id: "minimal", label: "Light mesh", cols: 52, rows: 18 },
  { id: "balanced", label: "Balanced mesh", cols: 80, rows: 28 },
  { id: "dense", label: "Dense mesh", cols: 120, rows: 42 }
];

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
uniform vec2 uShockOrigin;
uniform float uShockTime;
uniform float uShockPower;
uniform float uMouseSpeed;
uniform float uShockHeat;

varying float vDist;
varying float vWave;

float waveFunc(vec2 p, float t) {
  return
    sin(p.x * 3.2 + t * 0.75) * 0.03 +
    cos(p.y * 2.4 - t * 0.58) * 0.03;
}

float shockProfile(float dist, float time) {
  float waveFront = time * 1.8 + 0.2;
  float shellWidth = 0.3 + time * 0.35;
  float ring = 1.0 - smoothstep(0.0, shellWidth, abs(dist - waveFront));
  float decay = exp(-time * 1.35);
  return max(0.0, ring * decay);
}

void main() {
  vec2 p = aBasePos;

  float speedFactor = clamp(uMouseSpeed, 0.0, 2.5);
  float shockHeat = clamp(uShockHeat, 0.0, 1.0);

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

  // Speed-driven expansion/contraction
  float contract = 1.0 - 0.18 * smoothstep(0.04, 0.9, speedFactor);
  float breathing = 1.0 + sin(uTime * 0.9) * 0.02;
  p *= contract * breathing;

  // Add chaotic ripples when moving quickly
  vec2 turbulence =
    vec2(
      sin(uTime * 5.2 + p.y * 11.5),
      cos(uTime * 4.1 - p.x * 9.7)
    ) * 0.02 * speedFactor;

  vec2 fold =
    vec2(
      sin((p.x + p.y) * 8.0 - uTime * 7.0),
      cos((p.x - p.y) * 10.0 + uTime * 5.5)
    ) * 0.015 * speedFactor * speedFactor;

  // Bomb shockwave from clicks/taps
  vec2 bombOffset = vec2(0.0);
  if (uShockTime >= 0.0 && uShockPower > 0.0) {
    vec2 shockVec = p - uShockOrigin;
    float shockDist = length(shockVec);
    float amp = shockProfile(shockDist, uShockTime) * uShockPower;
    if (amp > 0.0) {
      vec2 dirShock = shockDist > 1e-4 ? shockVec / shockDist : vec2(0.0);
      bombOffset = dirShock * amp * 0.95;
    }
  }

  // Force field (mixed pull/push)
  float pulse = sin(uTime * 2.0 - dist * 6.0);
  float polarity = pulse * 0.5;  // -0.5..0.5
  vec2 mouseOffset = dir * polarity * 0.18 * influence;

  // Combine and apply scale
  vec2 finalPos =
    (p + ambient + vec2(0.0, wave) + mouseOffset + bombOffset + turbulence + fold) * uScale;

  gl_Position = vec4(finalPos * uAspect, 0.0, 1.0);

  vDist = dist;
  vWave = abs(wave) + influence * 0.5 + speedFactor * 0.2 + shockHeat * 0.3;
}
`;

// ----------------------------------------------------
// Fragment Shader
// ----------------------------------------------------
const fragmentSrc = `
precision mediump float;

uniform float uTime;
uniform float uMouseSpeed;
uniform float uShockHeat;

varying float vDist;
varying float vWave;

void main() {
  vec3 baseCool = vec3(0.62, 0.79, 1.0);
  vec3 hot = vec3(1.0, 0.52, 0.12);
  float heat = pow(clamp(uMouseSpeed * 2.2 + uShockHeat * 1.2, 0.0, 1.0), 0.65);
  vec3 base = mix(baseCool, hot, heat);

  float nearF = exp(-vDist * 2.0);

  float globalPulse = 0.5 + 0.5 * sin(uTime * 0.9);
  float localPulse  = 0.5 + 0.5 * sin(uTime * 1.8 + vDist * 7.0);

  float heatGlow = heat * (0.35 + 0.45 * nearF) + uShockHeat * 0.4 * nearF;
  float intensity =
      0.18 +
      0.52 * nearF +
      0.18 * vWave +
      0.12 * globalPulse * localPulse +
      heatGlow;

  intensity = clamp(intensity, 0.0, 1.0);

  float alpha = intensity * 0.9;

  float farF = clamp(vDist * 0.9, 0.0, 1.0);
  float desat = mix(1.0, 0.68, farF);

  vec3 color = base * intensity * desat;
  color += vec3(1.0, 0.78, 0.35) * heat * 0.35 * nearF;

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

  let currentMeshLevel = meshLevels[1];
  let grid = createHexGrid(currentMeshLevel.cols, currentMeshLevel.rows);

  const program = createProgram(gl, vertexSrc, fragmentSrc);
  gl.useProgram(program);

  const aBasePos = gl.getAttribLocation(program, "aBasePos");
  const uTime = gl.getUniformLocation(program, "uTime");
  const uMouse = gl.getUniformLocation(program, "uMouse");
  const uScale = gl.getUniformLocation(program, "uScale");
  const uAspect = gl.getUniformLocation(program, "uAspect");
  const uShockOrigin = gl.getUniformLocation(program, "uShockOrigin");
  const uShockTime = gl.getUniformLocation(program, "uShockTime");
  const uShockPower = gl.getUniformLocation(program, "uShockPower");
  const uMouseSpeed = gl.getUniformLocation(program, "uMouseSpeed");
  const uShockHeat = gl.getUniformLocation(program, "uShockHeat");

  // Buffers
  const posBuf = gl.createBuffer();
  const idxBuf = gl.createBuffer();

  function uploadGridBuffers(data) {
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, data.positions, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.indices, gl.STATIC_DRAW);
  }

  function applyMeshLevel(level) {
    currentMeshLevel = level;
    grid = createHexGrid(level.cols, level.rows);
    uploadGridBuffers(grid);
    markActiveMeshButton();
  }

  uploadGridBuffers(grid);

  gl.enableVertexAttribArray(aBasePos);
  gl.vertexAttribPointer(aBasePos, 2, gl.FLOAT, false, 0, 0);

  // Mouse in [-1,1]
  let targetMouse = { x: 0, y: 0 };
  let mouse = { x: 0, y: 0 };
  const aspectScale = { x: 1, y: 1 };
  const shockState = {
    origin: { x: 0, y: 0 },
    start: -1
  };
  const pointerSpeed = {
    target: 0,
    value: 0,
    lastX: 0,
    lastY: 0,
    lastTime: performance.now()
  };
  const contextMenu = document.getElementById("mesh-menu");
  const menuButtons = contextMenu
    ? Array.from(contextMenu.querySelectorAll("button[data-level]"))
    : [];
  let menuVisible = false;

  function markActiveMeshButton() {
    if (!menuButtons.length) return;
    for (const btn of menuButtons) {
      const isActive = btn.dataset.level === currentMeshLevel.id;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    }
  }

  function closeContextMenu() {
    if (!contextMenu || !menuVisible) return;
    contextMenu.classList.remove("open");
    contextMenu.setAttribute("aria-hidden", "true");
    menuVisible = false;
  }

  function openContextMenu(clientX, clientY) {
    if (!contextMenu) return;
    markActiveMeshButton();
    contextMenu.classList.add("open");
    contextMenu.setAttribute("aria-hidden", "false");
    menuVisible = true;

    requestAnimationFrame(() => {
      const menuWidth = contextMenu.offsetWidth || 200;
      const menuHeight = contextMenu.offsetHeight || 140;
      const maxX = window.innerWidth - menuWidth - 12;
      const maxY = window.innerHeight - menuHeight - 12;
      const clampedX = Math.max(12, Math.min(clientX, maxX));
      const clampedY = Math.max(12, Math.min(clientY, maxY));
      contextMenu.style.left = `${clampedX}px`;
      contextMenu.style.top = `${clampedY}px`;
    });
  }

  markActiveMeshButton();

  if (contextMenu) {
    contextMenu.addEventListener("click", e => {
      const btn = e.target.closest("button[data-level]");
      if (!btn) return;
      const level = meshLevels.find(item => item.id === btn.dataset.level);
      if (level && level.id !== currentMeshLevel.id) {
        applyMeshLevel(level);
      }
      closeContextMenu();
    });
  }

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      closeContextMenu();
    }
  });

  document.addEventListener("contextmenu", e => {
    e.preventDefault();
    if (contextMenu?.contains(e.target)) return;
    openContextMenu(e.clientX, e.clientY);
  });

  function clipSpaceFromEvent(e) {
    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const ny = (e.clientY / window.innerHeight) * 2 - 1;
    return { x: nx, y: -ny };
  }

  function updatePointerTarget(e) {
    const coords = clipSpaceFromEvent(e);
    targetMouse.x = coords.x;
    targetMouse.y = coords.y;
    return coords;
  }

  function recordPointerSpeed(coords) {
    const now = performance.now();
    const dx = coords.x - pointerSpeed.lastX;
    const dy = coords.y - pointerSpeed.lastY;
    const dt = Math.max(1, now - pointerSpeed.lastTime);
    const dist = Math.hypot(dx, dy);
    const normalized = dist / (dt / 16);
    pointerSpeed.target = Math.min(2.5, normalized);
    pointerSpeed.lastX = coords.x;
    pointerSpeed.lastY = coords.y;
    pointerSpeed.lastTime = now;
  }

  document.addEventListener("pointermove", e => {
    const coords = updatePointerTarget(e);
    recordPointerSpeed(coords);
  });

  document.addEventListener(
    "pointerdown",
    e => {
      if (e.pointerType === "mouse" && e.button === 2) {
        e.preventDefault();
        openContextMenu(e.clientX, e.clientY);
        return;
      }

      if (contextMenu?.contains(e.target)) {
        return;
      }

      if (menuVisible) {
        closeContextMenu();
      }

      if (e.pointerType === "mouse" && e.button !== 0) return;
      const coords = updatePointerTarget(e);
      recordPointerSpeed(coords);
      shockState.origin.x = coords.x;
      shockState.origin.y = coords.y;
      shockState.start = performance.now();
    },
    { passive: false }
  );

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

    pointerSpeed.value += (pointerSpeed.target - pointerSpeed.value) * 0.08;
    pointerSpeed.target *= 0.9;
    if (pointerSpeed.target < 0.0001) pointerSpeed.target = 0;

    let shockAge = -1;
    if (shockState.start >= 0) {
      shockAge = (ms - shockState.start) * 0.001;
      if (shockAge > 4.5) {
        shockState.start = -1;
        shockAge = -1;
      }
    }
    const shockStrength = shockAge >= 0 ? Math.max(0, 1 - shockAge / 3.2) : 0;
    const shockHeat = shockAge >= 0 ? Math.max(0, 1 - shockAge / 2.2) : 0;

    gl.uniform1f(uTime, t);
    gl.uniform2f(uMouse, mouse.x, mouse.y);
    gl.uniform1f(uScale, scale);
    gl.uniform2f(uAspect, aspectScale.x, aspectScale.y);
    gl.uniform2f(uShockOrigin, shockState.origin.x, shockState.origin.y);
    gl.uniform1f(uShockTime, shockAge);
    gl.uniform1f(uShockPower, shockStrength);
    gl.uniform1f(uMouseSpeed, pointerSpeed.value);
    gl.uniform1f(uShockHeat, shockHeat);

    gl.drawElements(gl.LINES, grid.indices.length, gl.UNSIGNED_SHORT, 0);

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
});
