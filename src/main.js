import { Chess } from 'chess.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './style.css';

const glyphs = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
};
const labels = { k: 'King', q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight', p: 'Pawn' };
const values = { k: 0, q: 9, r: 5, b: 3.2, n: 3, p: 1 };
const files = 'abcdefgh';
const bots = [
  { id: 'wanderer', name: 'The Wanderer', title: 'EASY', rating: 'I', depth: 0, icon: '♟', skill: 'Wild opening', description: 'A beginner-level rival with little long-term planning.', skillDetail: 'Chooses a random legal move each turn.', unlock: 'surge' },
  { id: 'duelist', name: 'The Duelist', title: 'MEDIUM', rating: 'II', depth: 1, icon: '⚔', skill: 'Counterpunch', description: 'Scores moves one turn ahead, with some unpredictability.', skillDetail: 'Slightly favors checks and captures, then picks among its three top moves.', unlock: 'insight' },
  { id: 'architect', name: 'The Architect', title: 'HARD', rating: 'III', depth: 2, icon: '♜', skill: 'Deep calculation', description: 'Plans three plies ahead using minimax search.', skillDetail: 'Uses alpha-beta pruning and randomly picks from its two best moves.', unlock: 'resolve' },
  { id: 'oracle', name: 'The Oracle', title: 'HARDEST', rating: 'IV', depth: 3, icon: '♛', skill: 'Long-range foresight', description: 'Plans four plies ahead using minimax search.', skillDetail: 'Uses alpha-beta pruning and selects its top-scoring move.', unlock: 'second-wind' },
];
const skills = [
  { id: 'rally', name: 'Rally', detail: 'Restore 12 conviction to each living piece on your side.', icon: '✳' },
  { id: 'surge', name: 'Authority surge', detail: 'Gain up to 2 authority, capped at 4.', icon: '✦' },
  { id: 'insight', name: 'Read the board', detail: 'Highlight one strong legal move, including its piece and destination.', icon: '⌕' },
  { id: 'resolve', name: 'Resolve', detail: 'Restore 20 conviction to each living piece on your side.', icon: '◈' },
  { id: 'second-wind', name: 'Second wind', detail: 'Raise each of your pieces below 45 conviction to 45.', icon: '↟' },
];
const storedSkills = JSON.parse(localStorage.getItem('crown-zero-skills') || '[]');

let game = new Chess();
let selected = null;
let legalMoves = [];
let authority = 1;
let moveNumber = 0;
let lastMove = null;
let thinking = false;
let gameOver = false;
let pendingOrder = null;
let playerColor = 'w';
let selectedBot = bots[0];
let usedSkills = new Set();
let unlockedSkills = new Set(['rally', ...(Array.isArray(storedSkills) ? storedSkills : [])]);
let noticeTimer;
let botTimer;
let renderer;
let scene;
let camera;
let controls;
let boardRoot;
let promotionMoves = null;
const squareMeshes = new Map();
const pieceGroups = new Map();
const squareMarkers = new Map();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const faith = new Map();
const history = [];

const app = document.querySelector('#app');

function renderShell() {
  app.innerHTML = `
    <header class="topbar">
      <a class="wordmark" href="#" aria-label="Crown Zero home"><span class="mark">C</span><span>CROWN<span class="slash"> / </span>ZERO</span></a>
      <div class="match-label"><span class="live-dot"></span> THE IMPERIAL TABLE <span class="match-id">MATCH 07</span></div>
      <button class="icon-button" id="new-game" aria-label="Start a new match" title="Start a new match"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4"/></svg></button>
    </header>
    <main class="arena" hidden>
      <section class="match-column" aria-label="Match status">
        <div class="section-kicker">CURRENT MATCH <span>01 — 01</span></div>
        <div class="player-card player-you">
          <div class="player-top"><div class="avatar avatar-you">Y</div><div><div class="player-name">THE USURPER</div><div class="player-sub" id="you-side">PLAYER · WHITE</div></div><span class="turn-marker" id="you-turn">YOUR TURN</span></div>
          <div class="player-rank"><span>TACTICAL RATING</span><strong>1,420</strong></div>
          <div class="rating-line"><span></span></div>
        </div>
        <div class="versus"><span></span> VS <span></span></div>
        <div class="player-card player-rival">
          <div class="player-top"><div class="avatar avatar-rival" id="rival-avatar">♜</div><div><div class="player-name" id="rival-name">THE WANDERER</div><div class="player-sub" id="rival-side">OPPONENT · BLACK</div><div class="player-sub" id="rival-skill">SKILL · WILD OPENING</div></div><span class="thinking-label" id="rival-turn">AWAITING</span></div>
          <div class="rival-skill-detail" id="rival-skill-detail">Chooses a random legal move each turn.</div>
          <div class="player-rank"><span>THREAT LEVEL</span><strong id="rival-rating">I</strong></div>
          <div class="rating-line rival-rating"><span></span></div>
        </div>
        <div class="match-note"><span class="note-icon">✳</span><p>“A crown is not inherited. It is taken from the board.”</p><span class="note-credit" id="bot-credit">— THE WANDERER</span></div>
      </section>

      <section class="board-column" aria-label="Chess board">
        <div class="board-heading"><div><div class="eyebrow">THE IMPERIAL TABLE</div><h1>Command the <em>board.</em></h1></div><div class="turn-status" id="turn-status"><span class="status-pip"></span> YOUR MOVE</div></div>
        <div class="board-stage"><div class="board-scene" id="board" role="application" aria-label="Interactive three-dimensional chessboard"></div><button class="view-reset" id="reset-view" type="button" title="Reset camera view" aria-label="Reset camera view"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.34-5.66L4 8.67M4 4v4.67h4.67"/></svg></button></div>
        <div class="board-footer"><span><i class="legend-dot last"></i> LAST MOVE</span><span><i class="legend-dot possible"></i> AVAILABLE MOVE</span><span class="check-label" id="check-label"></span></div>
      </section>

      <aside class="command-column" aria-label="Command and move history">
        <section class="command-panel">
          <div class="panel-title"><span>COMMAND</span><span class="command-live"><i></i> ACTIVE</span></div>
          <div class="authority-head"><span>AUTHORITY</span><strong><b id="authority-count">01</b><small> / 04</small></strong></div>
          <div class="authority-track" id="authority-track"></div>
          <p class="authority-copy">Earn authority with decisive play. Spend it to force a disloyal piece to obey.</p>
          <div class="faith-title"><span>UNIT CONVICTION</span><span id="faith-overview">16 UNITS</span></div>
          <div class="faith-roster" id="faith-roster"></div>
          <div class="skill-title"><span>YOUR SKILLS</span><span>WIN TO UNLOCK</span></div>
          <div class="skill-roster" id="skill-roster"></div>
          <div class="command-hint"><span>!</span><p>A unit below <b>25%</b> may refuse a move that throws it into danger.</p></div>
        </section>
        <section class="history-panel">
          <div class="history-heading"><span>FIELD RECORD</span><span id="move-count">01 / —</span></div>
          <div class="move-list" id="move-list"><div class="empty-history">The first move is yours.</div></div>
          <button class="resign-button" id="resign-button">CONCEDE THE MATCH <span>↗</span></button>
        </section>
      </aside>
    </main>
    <section class="setup-screen" id="setup-screen" aria-labelledby="setup-title">
      <div class="setup-panel">
        <div class="setup-kicker">THE IMPERIAL TABLE · MATCH SETUP</div>
        <h1 id="setup-title">Choose your <em>opponent.</em></h1>
        <p class="setup-intro">Every rival has a different way of thinking. Pick your challenge, then choose your side.</p>
        <div class="setup-label"><span>01</span> SELECT A RIVAL</div>
        <div class="bot-grid" id="bot-grid"></div>
        <div class="setup-bottom">
          <fieldset class="side-picker">
            <legend><span>02</span> CHOOSE YOUR SIDE</legend>
            <button type="button" class="side-option is-selected" data-color="w" aria-pressed="true"><span>♔</span> WHITE</button>
            <button type="button" class="side-option" data-color="b" aria-pressed="false"><span>♚</span> BLACK</button>
          </fieldset>
          <button class="begin-button" id="begin-match" type="button">BEGIN MATCH <span>↗</span></button>
        </div>
        <p class="unlock-note" id="unlock-note"></p>
      </div>
    </section>
    <div class="toast" id="toast" role="status" aria-live="polite"></div>
    <div class="promotion-backdrop" id="promotion-backdrop" hidden><section class="promotion-modal" role="dialog" aria-modal="true" aria-labelledby="promotion-title"><div class="modal-kicker">A PAWN REACHES THE THRONE</div><h2 id="promotion-title">Choose its new form.</h2><div class="promotion-options" id="promotion-options"></div><button class="promotion-cancel" id="promotion-cancel" type="button">CANCEL</button></section></div>
    <div class="modal-backdrop" id="modal-backdrop" hidden><div class="result-modal"><div class="modal-kicker">THE IMPERIAL TABLE</div><h2 id="result-title">Checkmate.</h2><p id="result-copy"></p><button id="rematch-button">PLAY AGAIN <span>↗</span></button></div></div>
  `;

  document.querySelector('#new-game').addEventListener('click', showSetup);
  document.querySelector('#rematch-button').addEventListener('click', showSetup);
  document.querySelector('#begin-match').addEventListener('click', startNewGame);
  document.querySelector('#resign-button').addEventListener('click', resign);
  document.querySelector('#reset-view').addEventListener('click', () => controls?.reset());
  document.querySelector('#promotion-cancel').addEventListener('click', hidePromotionChooser);
  document.querySelector('#promotion-backdrop').addEventListener('click', (event) => {
    if (event.target.id === 'promotion-backdrop') hidePromotionChooser();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && promotionMoves) hidePromotionChooser();
  });
  renderSetup();
}

function renderSetup() {
  const grid = document.querySelector('#bot-grid');
  grid.innerHTML = bots.map((bot) => `
    <button class="bot-card ${bot.id === selectedBot.id ? 'is-selected' : ''}" type="button" data-bot="${bot.id}" aria-pressed="${bot.id === selectedBot.id}">
      <span class="bot-card-top"><span class="bot-icon">${bot.icon}</span><span class="bot-level">${bot.title}</span></span>
      <strong>${bot.name}</strong>
      <span class="bot-description">${bot.description}</span>
      <span class="bot-skill"><b>SKILL · ${bot.skill}</b><span>${bot.skillDetail}</span></span>
    </button>`).join('');
  grid.querySelectorAll('[data-bot]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedBot = bots.find((bot) => bot.id === button.dataset.bot);
      renderSetup();
    });
  });
  document.querySelectorAll('.side-option').forEach((button) => {
    button.classList.toggle('is-selected', button.dataset.color === playerColor);
    button.setAttribute('aria-pressed', String(button.dataset.color === playerColor));
    button.onclick = () => {
      playerColor = button.dataset.color;
      renderSetup();
    };
  });
  const unlock = skills.find((skill) => skill.id === selectedBot.unlock);
  document.querySelector('#unlock-note').textContent = `Defeat ${selectedBot.name} to unlock ${unlock.name}: ${unlock.detail} Each player skill can be used once per match.`;
}

function showSetup() {
  window.clearTimeout(botTimer);
  document.querySelector('#modal-backdrop').hidden = true;
  document.querySelector('.arena').hidden = true;
  document.querySelector('#setup-screen').hidden = false;
  renderSetup();
}

function pieceId(square, piece) {
  return `${piece.color}${piece.type}${square}`;
}

function getFaith(square, piece) {
  const key = pieceId(square, piece);
  if (!faith.has(key)) faith.set(key, 58 + Math.floor(Math.random() * 27));
  return faith.get(key);
}

function boardToMove() {
  const historyList = game.history({ verbose: true });
  return historyList.at(-1);
}

function initThreeBoard() {
  const host = document.querySelector('#board');
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#111316');
  camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  camera.position.set(9, 10.5, 12);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.append(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.2, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 11;
  controls.maxDistance = 20;
  controls.minPolarAngle = 0.45;
  controls.maxPolarAngle = 1.25;
  controls.update();

  scene.add(new THREE.HemisphereLight('#e8e4d8', '#22252b', 2.1));
  const keyLight = new THREE.DirectionalLight('#fff0d6', 3.2);
  keyLight.position.set(-5, 12, 7);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.left = -8;
  keyLight.shadow.camera.right = 8;
  keyLight.shadow.camera.top = 8;
  keyLight.shadow.camera.bottom = -8;
  scene.add(keyLight);
  const rimLight = new THREE.PointLight('#9d5050', 65, 24);
  rimLight.position.set(5, 5, -5);
  scene.add(rimLight);

  boardRoot = new THREE.Group();
  scene.add(boardRoot);
  buildBoardMeshes();
  resizeBoard();
  new ResizeObserver(resizeBoard).observe(host);

  let pointerStart = null;
  renderer.domElement.addEventListener('pointerdown', (event) => {
    pointerStart = { x: event.clientX, y: event.clientY };
  });
  renderer.domElement.addEventListener('pointerup', (event) => {
    if (!pointerStart || Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 6) {
      pointerStart = null;
      return;
    }
    pointerStart = null;
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects([...squareMeshes.values()], false)[0];
    if (hit) onSquareClick(hit.object.userData.square);
  });

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();
}

function resizeBoard() {
  if (!renderer || !camera) return;
  const host = renderer.domElement.parentElement;
  const width = Math.max(1, host.clientWidth);
  const height = Math.max(1, host.clientHeight);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function buildBoardMeshes() {
  const base = new THREE.Mesh(new THREE.BoxGeometry(8.35, 0.34, 8.35), new THREE.MeshStandardMaterial({ color: '#25282b', roughness: 0.42, metalness: 0.45 }));
  base.position.y = -0.08;
  base.receiveShadow = true;
  boardRoot.add(base);

  const edge = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.08, 8.5), new THREE.MeshStandardMaterial({ color: '#9c7541', roughness: 0.3, metalness: 0.7 }));
  edge.position.y = -0.255;
  boardRoot.add(edge);

  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const square = `${files[col]}${8 - row}`;
      const material = new THREE.MeshStandardMaterial({ color: (row + col) % 2 === 0 ? '#d2c8b3' : '#596d70', roughness: 0.56, metalness: 0.12, emissive: '#000000' });
      const tile = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.16, 0.98), material);
      tile.position.set(col - 3.5, 0.17, row - 3.5);
      tile.receiveShadow = true;
      tile.userData.square = square;
      boardRoot.add(tile);
      squareMeshes.set(square, tile);

      const markerMaterial = new THREE.MeshBasicMaterial({ color: '#25292a', transparent: true, opacity: 0.55, depthWrite: false });
      const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.025, 24), markerMaterial);
      dot.position.set(col - 3.5, 0.26, row - 3.5);
      dot.visible = false;
      boardRoot.add(dot);

      const ringMaterial = new THREE.MeshBasicMaterial({ color: '#9f463f', transparent: true, opacity: 0.9, depthWrite: false });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.04, 8, 28), ringMaterial);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(col - 3.5, 0.27, row - 3.5);
      ring.visible = false;
      boardRoot.add(ring);
      squareMarkers.set(square, { dot, ring });
    }
  }

  for (let col = 0; col < 8; col += 1) {
    addBoardLabel(files[col], col - 3.5, 4.25);
    addBoardLabel(String(8 - col), 4.25, col - 3.5);
  }
}

function addBoardLabel(text, x, z) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  context.fillStyle = '#b7ac95';
  context.font = '500 34px monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, 32, 32);
  const texture = new THREE.CanvasTexture(canvas);
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  label.position.set(x, 0.15, z);
  label.scale.set(0.28, 0.28, 1);
  boardRoot.add(label);
}

function makePieceMaterials(color) {
  return color === 'w'
    ? { body: new THREE.MeshStandardMaterial({ color: '#e6e1d5', roughness: 0.27, metalness: 0.44 }), trim: new THREE.MeshStandardMaterial({ color: '#c4a461', roughness: 0.25, metalness: 0.78 }) }
    : { body: new THREE.MeshStandardMaterial({ color: '#353a40', roughness: 0.3, metalness: 0.58 }), trim: new THREE.MeshStandardMaterial({ color: '#b7584d', roughness: 0.27, metalness: 0.62, emissive: '#2d0908' }) };
}

function addPieceMesh(group, geometry, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addLathe(group, points, material, y = 0) {
  const geometry = new THREE.LatheGeometry(points.map(([radius, height]) => new THREE.Vector2(radius, height)), 24);
  return addPieceMesh(group, geometry, material, 0, y, 0);
}

function createPieceModel(piece) {
  const group = new THREE.Group();
  const { body, trim } = makePieceMaterials(piece.color);
  const cylinder = (top, bottom, height, y, material, segments = 24) => addPieceMesh(group, new THREE.CylinderGeometry(top, bottom, height, segments), material, 0, y, 0);
  const sphere = (radius, y, material, x = 0, z = 0) => addPieceMesh(group, new THREE.SphereGeometry(radius, 18, 12), material, x, y, z);
  const cone = (radius, height, y, material, x = 0, z = 0) => addPieceMesh(group, new THREE.ConeGeometry(radius, height, 16), material, x, y, z);

  cylinder(0.3, 0.36, 0.12, 0.06, body, 32);
  const baseRing = addPieceMesh(group, new THREE.TorusGeometry(0.29, 0.025, 7, 28), trim, 0, 0.12, 0);
  baseRing.rotation.x = Math.PI / 2;

  if (piece.type === 'p') {
    addLathe(group, [[0.13, 0.12], [0.2, 0.2], [0.12, 0.3], [0.1, 0.43]], body);
    sphere(0.16, 0.51, trim);
  } else if (piece.type === 'r') {
    addLathe(group, [[0.17, 0.12], [0.25, 0.22], [0.22, 0.38], [0.28, 0.48]], body);
    cylinder(0.32, 0.32, 0.12, 0.53, trim);
    for (let i = 0; i < 4; i += 1) {
      const angle = (i * Math.PI) / 2;
      const merlon = addPieceMesh(group, new THREE.BoxGeometry(0.12, 0.14, 0.12), body, Math.cos(angle) * 0.23, 0.65, Math.sin(angle) * 0.23);
      merlon.rotation.y = angle;
    }
  } else if (piece.type === 'n') {
    addLathe(group, [[0.16, 0.12], [0.25, 0.22], [0.17, 0.35]], body);
    const neck = addPieceMesh(group, new THREE.CapsuleGeometry(0.13, 0.36, 4, 10), body, 0, 0.52, 0);
    neck.rotation.z = -0.34;
    sphere(0.18, 0.73, body, 0.09, 0);
    const muzzle = cone(0.11, 0.25, 0.74, trim, 0.23, 0);
    muzzle.rotation.z = -Math.PI / 2;
    cone(0.09, 0.2, 0.92, trim, 0.03, 0);
  } else if (piece.type === 'b') {
    addLathe(group, [[0.16, 0.12], [0.27, 0.24], [0.19, 0.36], [0.12, 0.62], [0.08, 0.78]], body);
    sphere(0.11, 0.77, trim);
    cone(0.08, 0.23, 0.96, body);
  } else if (piece.type === 'q' || piece.type === 'k') {
    addLathe(group, [[0.16, 0.12], [0.28, 0.24], [0.19, 0.4], [0.13, 0.69], [0.21, 0.78]], body);
    const crownRing = addPieceMesh(group, new THREE.TorusGeometry(0.2, 0.035, 8, 24), trim, 0, 0.79, 0);
    crownRing.rotation.x = Math.PI / 2;
    sphere(0.12, 0.84, body);
    const spikeCount = piece.type === 'q' ? 5 : 4;
    for (let i = 0; i < spikeCount; i += 1) {
      const angle = (i * Math.PI * 2) / spikeCount;
      cone(0.06, 0.22, 0.98, trim, Math.cos(angle) * 0.18, Math.sin(angle) * 0.18);
    }
    if (piece.type === 'k') {
      cylinder(0.035, 0.035, 0.28, 1.13, trim, 12);
      addPieceMesh(group, new THREE.BoxGeometry(0.24, 0.045, 0.045), trim, 0, 1.13, 0);
    }
  }

  return group;
}

function syncBoardScene() {
  const board = game.board();
  const liveSquares = new Set();
  const last = boardToMove();
  lastMove = last ? [last.from, last.to] : null;
  const legalBySquare = new Map(legalMoves.map((move) => [move.to, move]));
  let checkedKing = null;

  if (game.isCheck()) {
    board.forEach((rank, row) => rank.forEach((piece, col) => {
      if (piece?.type === 'k' && piece.color === game.turn()) checkedKing = `${files[col]}${8 - row}`;
    }));
  }

  board.forEach((rank, row) => rank.forEach((piece, col) => {
    const square = `${files[col]}${8 - row}`;
    const tile = squareMeshes.get(square);
    const baseColor = (row + col) % 2 === 0 ? '#d2c8b3' : '#596d70';
    const isSelected = selected === square;
    const isLast = lastMove?.includes(square);
    const isLegal = legalBySquare.has(square);
    const color = checkedKing === square ? '#a84e48' : isSelected ? '#d6a14e' : isLast ? '#ad925b' : baseColor;
    tile.material.color.set(color);
    tile.material.emissive.set(checkedKing === square ? '#5a1715' : isSelected ? '#3d230b' : 'black');
    const marker = squareMarkers.get(square);
    marker.dot.visible = isLegal && !piece;
    marker.ring.visible = isLegal && Boolean(piece);

    if (!piece) return;
    liveSquares.add(square);
    const signature = `${piece.color}${piece.type}`;
    let group = pieceGroups.get(square);
    if (group?.userData.signature !== signature) {
      if (group) {
        boardRoot.remove(group);
        group.traverse((child) => child.geometry?.dispose());
      }
      group = createPieceModel(piece);
      group.userData.signature = signature;
      pieceGroups.set(square, group);
      boardRoot.add(group);
    }
    group.position.set(col - 3.5, 0.26, row - 3.5);
  }));

  for (const [square, group] of pieceGroups) {
    if (!liveSquares.has(square)) {
      boardRoot.remove(group);
      group.traverse((child) => child.geometry?.dispose());
      pieceGroups.delete(square);
    }
  }
}

function renderBoard() {
  syncBoardScene();
  document.querySelector('#check-label').textContent = game.isCheck() ? 'CHECK' : '';
  renderFaith();
}

function renderFaith() {
  const roster = document.querySelector('#faith-roster');
  const entries = [];
  game.board().forEach((rank, row) => rank.forEach((piece, col) => {
    if (piece?.color === playerColor) {
      const square = `${files[col]}${8 - row}`;
      entries.push({ piece, square, value: getFaith(square, piece) });
    }
  }));
  roster.innerHTML = entries.map(({ piece, square, value }) => `<div class="faith-unit" title="${labels[piece.type]} at ${square}: ${value}% conviction"><span class="faith-glyph">${glyphs[playerColor][piece.type]}</span><span class="faith-meter"><i class="${value < 35 ? 'low-faith' : ''}" style="width:${value}%"></i></span></div>`).join('');
  document.querySelector('#faith-overview').textContent = `${entries.length.toString().padStart(2, '0')} UNITS`;
  document.querySelector('#authority-count').textContent = authority.toString().padStart(2, '0');
  document.querySelector('#authority-track').innerHTML = Array.from({ length: 4 }, (_, i) => `<i class="${i < authority ? 'filled' : ''}"></i>`).join('');
  renderSkills();
}

function renderSkills() {
  const roster = document.querySelector('#skill-roster');
  roster.innerHTML = skills.filter((skill) => unlockedSkills.has(skill.id)).map((skill) => `
    <button class="skill-button" type="button" data-skill="${skill.id}" ${usedSkills.has(skill.id) || gameOver ? 'disabled' : ''}>
      <span class="skill-icon">${skill.icon}</span><span class="skill-copy"><b>${skill.name}</b><small class="skill-description">${skill.detail} Once per match.</small></span>${usedSkills.has(skill.id) ? '<small class="skill-usage">USED</small>' : ''}
    </button>`).join('');
  roster.querySelectorAll('[data-skill]').forEach((button) => {
    button.addEventListener('click', () => activateSkill(button.dataset.skill));
  });
}

function activateSkill(id) {
  if (!unlockedSkills.has(id) || usedSkills.has(id) || gameOver || thinking || game.turn() !== playerColor || pendingOrder) return;
  const skill = skills.find((item) => item.id === id);
  if (id === 'rally' || id === 'resolve') {
    const boost = id === 'rally' ? 12 : 20;
    game.board().forEach((rank, row) => rank.forEach((piece, col) => {
      if (piece?.color !== playerColor) return;
      const square = `${files[col]}${8 - row}`;
      const key = pieceId(square, piece);
      faith.set(key, Math.min(100, getFaith(square, piece) + boost));
    }));
    showToast(`${skill.name.toUpperCase()} ACTIVATED`, skill.detail, false);
  } else if (id === 'surge') {
    authority = Math.min(4, authority + 2);
    showToast(`${skill.name.toUpperCase()} ACTIVATED`, skill.detail, false);
  } else if (id === 'second-wind') {
    game.board().forEach((rank, row) => rank.forEach((piece, col) => {
      if (piece?.color !== playerColor) return;
      const square = `${files[col]}${8 - row}`;
      const key = pieceId(square, piece);
      const value = getFaith(square, piece);
      if (value < 45) faith.set(key, 45);
    }));
    showToast(`${skill.name.toUpperCase()} ACTIVATED`, skill.detail, false);
  } else if (id === 'insight') {
    const moves = game.moves({ verbose: true });
    const best = moves.map((move) => ({ move, score: scoreMove(move, playerColor) })).sort((a, b) => b.score - a.score)[0]?.move;
    if (!best) return;
    selected = best.from;
    legalMoves = [best];
    showToast('THE BOARD REVEALS A PATH', `${labels[game.get(best.from).type]} ${best.from} to ${best.to} is a strong candidate.`, false);
  }
  usedSkills.add(id);
  renderBoard();
  renderFaith();
}

function renderHistory() {
  const list = document.querySelector('#move-list');
  if (!history.length) {
    list.innerHTML = '<div class="empty-history">The first move is yours.</div>';
  } else {
    list.innerHTML = history.map((turn, index) => `<div class="move-row"><span class="move-index">${String(index + 1).padStart(2, '0')}</span><span class="white-move">${turn.white || ''}</span><span class="black-move">${turn.black || ''}</span><span class="move-quality ${turn.qualityClass || ''}">${turn.quality || ''}</span></div>`).join('');
    list.scrollTop = list.scrollHeight;
  }
  document.querySelector('#move-count').textContent = `${String(Math.floor(game.history().length / 2) + 1).padStart(2, '0')} / —`;
}

function updateStatus() {
  const playerTurn = game.turn() === playerColor && !thinking && !gameOver;
  const playerSide = playerColor === 'w' ? 'WHITE' : 'BLACK';
  const rivalSide = playerColor === 'w' ? 'BLACK' : 'WHITE';
  document.querySelector('#you-side').textContent = `PLAYER · ${playerSide}`;
  document.querySelector('#rival-side').textContent = `OPPONENT · ${rivalSide}`;
  document.querySelector('#rival-name').textContent = selectedBot.name.toUpperCase();
  document.querySelector('#rival-avatar').textContent = selectedBot.icon;
  document.querySelector('#rival-skill').textContent = `SKILL · ${selectedBot.skill.toUpperCase()}`;
  document.querySelector('#rival-skill-detail').textContent = selectedBot.skillDetail;
  document.querySelector('#bot-credit').textContent = `— ${selectedBot.name.toUpperCase()}`;
  document.querySelector('#rival-rating').textContent = selectedBot.rating;
  document.querySelector('#you-turn').textContent = playerTurn ? 'YOUR TURN' : gameOver ? 'MATCH ENDED' : 'STANDING BY';
  document.querySelector('#you-turn').classList.toggle('is-waiting', !playerTurn);
  document.querySelector('#rival-turn').textContent = thinking ? 'THINKING' : gameOver ? 'MATCH ENDED' : 'AWAITING';
  document.querySelector('#rival-turn').classList.toggle('is-thinking', thinking);
  document.querySelector('#turn-status').innerHTML = `<span class="status-pip ${thinking ? 'rival-pip' : ''}"></span> ${thinking ? 'RIVAL THINKS' : gameOver ? 'MATCH COMPLETE' : 'YOUR MOVE'}`;
  document.querySelector('#resign-button').disabled = gameOver;
  renderSkills();
}

function onSquareClick(square) {
  if (game.turn() !== playerColor || thinking || gameOver || pendingOrder || promotionMoves) return;
  const piece = game.get(square);
  if (selected && legalMoves.some((move) => move.to === square)) {
    const movesToSquare = legalMoves.filter((candidate) => candidate.to === square);
    if (movesToSquare.some((move) => move.promotion)) showPromotionChooser(movesToSquare);
    else attemptMove(movesToSquare[0]);
    return;
  }
  if (piece?.color === playerColor) {
    selected = square;
    legalMoves = game.moves({ square, verbose: true });
  } else {
    selected = null;
    legalMoves = [];
  }
  renderBoard();
}

function positionScore(chess, perspective) {
  const board = chess.board();
  let score = 0;
  board.forEach((rank, row) => rank.forEach((piece, col) => {
    if (!piece) return;
    const sign = piece.color === perspective ? 1 : -1;
    let positional = 0;
    const advance = piece.color === 'w' ? 6 - row : row - 1;
    const center = 3.5 - (Math.abs(3.5 - col) + Math.abs(3.5 - row)) / 2;
    if (piece.type === 'p') positional = advance * 0.08 + center * 0.03;
    if (piece.type === 'n' || piece.type === 'b') positional = center * 0.09;
    score += sign * (values[piece.type] + positional);
  }));
  if (chess.isCheck()) score += chess.turn() === perspective ? -0.45 : 0.45;
  return score;
}

function scoreMove(move, side) {
  const before = positionScore(game, side);
  game.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' });
  let score = positionScore(game, side) - before;
  if (game.isCheck()) score += 0.3;
  if (game.isCheckmate()) score += 100;
  game.undo();
  return score;
}

function searchMove(chess, move, depth, perspective) {
  chess.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' });
  const score = searchPosition(chess, depth - 1, perspective, -Infinity, Infinity);
  chess.undo();
  return score;
}

function searchPosition(chess, depth, perspective, alpha, beta) {
  if (chess.isCheckmate()) return chess.turn() === perspective ? -10000 - depth : 10000 + depth;
  if (chess.isDraw()) return 0;
  if (depth === 0) return positionScore(chess, perspective);

  const maximizing = chess.turn() === perspective;
  const moves = chess.moves({ verbose: true }).sort((a, b) => Number(Boolean(b.captured)) - Number(Boolean(a.captured)));
  let best = maximizing ? -Infinity : Infinity;
  for (const move of moves) {
    chess.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' });
    const score = searchPosition(chess, depth - 1, perspective, alpha, beta);
    chess.undo();
    best = maximizing ? Math.max(best, score) : Math.min(best, score);
    if (maximizing) alpha = Math.max(alpha, best);
    else beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
}

function attemptMove(move, force = false) {
  const botColor = playerColor === 'w' ? 'b' : 'w';
  const candidates = game.moves({ verbose: true }).map((candidate) => ({ move: candidate, score: scoreMove(candidate, playerColor) }));
  const best = Math.max(...candidates.map((candidate) => candidate.score));
  const chosen = candidates.find(({ move: candidate }) => candidate.from === move.from && candidate.to === move.to && candidate.promotion === move.promotion);
  const gap = best - chosen.score;
  const movedPiece = game.get(move.from);
  const pieceFaith = getFaith(move.from, movedPiece);
  const appearsDangerous = isSquareAttackedAfter(move, move.to, botColor);
  const orderIsRisky = gap > 1.45 && appearsDangerous;

  if (orderIsRisky && pieceFaith < 25 && !force) {
    if (authority > 0) {
      pendingOrder = { move, pieceName: labels[movedPiece.type] };
      showToast(`${labels[movedPiece.type].toUpperCase()} REFUSES YOUR ORDER`, 'Your strategy has cost this unit its faith. Spend 1 authority to force the move?', true);
    } else {
      showToast(`${labels[movedPiece.type].toUpperCase()} REFUSES`, 'No authority remains. Choose another move or rebuild your command.', false);
    }
    return;
  }

  selected = null;
  legalMoves = [];
  const from = move.from;
  const to = move.to;
  const result = game.move({ from, to, promotion: move.promotion || 'q' });
  const movedKey = pieceId(from, movedPiece);
  const nextFaith = Math.max(8, Math.min(100, pieceFaith + faithDelta(gap)));
  faith.delete(movedKey);
  faith.set(pieceId(to, { type: result.promotion || result.piece, color: result.color }), nextFaith);

  const quality = qualityLabel(gap);
  if (force) {
    authority = Math.max(0, authority - 1);
    showToast(`${labels[movedPiece.type].toUpperCase()} OBEYS`, '1 authority spent. The order stands.', false);
  } else if (quality.good && authority < 4) {
    authority += 1;
    showToast('STRATEGY ACKNOWLEDGED', '+1 authority. Your pieces believe in your command.', false);
  } else if (quality.bad && authority > 0) {
    authority -= 1;
    showToast('CONFIDENCE SHAKEN', 'A poor order has cost you 1 authority.', false);
  }

  const moveTurn = Math.floor(moveNumber / 2);
  if (result.color === 'w') history.push({ white: result.san, black: '', quality: quality.text, qualityClass: quality.className });
  else history[moveTurn].black = result.san;
  moveNumber += 1;
  renderBoard();
  renderHistory();
  updateStatus();
  if (checkGameOver()) return;
  thinking = true;
  updateStatus();
  botTimer = window.setTimeout(makeRivalMove, 480);
}

function isSquareAttackedAfter(move, target, byColor) {
  game.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' });
  const attacked = game.isAttacked(target, byColor);
  game.undo();
  return attacked;
}

function faithDelta(gap) {
  if (gap < 0.3) return 11;
  if (gap < 0.8) return 6;
  if (gap < 1.5) return 1;
  if (gap < 3) return -9;
  return -18;
}

function qualityLabel(gap) {
  if (gap < 0.3) return { text: 'BRILLIANT', className: 'brilliant', good: true, bad: false };
  if (gap < 0.8) return { text: 'STEADY', className: 'steady', good: true, bad: false };
  if (gap < 1.5) return { text: 'UNCERTAIN', className: 'uncertain', good: false, bad: false };
  return { text: 'BLUNDER', className: 'blunder', good: false, bad: true };
}

function makeRivalMove() {
  botTimer = null;
  if (gameOver) return;
  const moves = game.moves({ verbose: true });
  const botColor = playerColor === 'w' ? 'b' : 'w';
  const scored = moves.map((move) => {
    let score = selectedBot.depth > 1
      ? searchMove(game, move, selectedBot.depth, botColor)
      : scoreMove(move, botColor);
    if (selectedBot.id === 'duelist' && (move.captured || move.san.includes('+'))) score += 0.45;
    return { move, score };
  });
  scored.sort((a, b) => b.score - a.score);
  let chosen;
  if (selectedBot.depth === 0) {
    chosen = moves[Math.floor(Math.random() * moves.length)];
  } else {
    const shortlist = scored.slice(0, selectedBot.depth === 1 ? 3 : selectedBot.depth === 2 ? 2 : 1);
    chosen = shortlist[Math.floor(Math.random() * shortlist.length)].move;
  }
  if (moves.length === 0) return checkGameOver();
  const result = game.move({ from: chosen.from, to: chosen.to, promotion: chosen.promotion || 'q' });
  const turnIndex = Math.floor((game.history().length - 1) / 2);
  if (result.color === 'w') history.push({ white: result.san, black: '' });
  else if (history[turnIndex]) history[turnIndex].black = result.san;
  moveNumber += 1;
  thinking = false;
  renderBoard();
  renderHistory();
  updateStatus();
  checkGameOver();
}

function showToast(title, message, canForce) {
  const toast = document.querySelector('#toast');
  toast.innerHTML = `<span class="toast-mark">${canForce ? '!' : '✳'}</span><span class="toast-copy"><b>${title}</b><small>${message}</small></span>${canForce ? '<button id="force-order">OVERRIDE · 1</button><button class="dismiss-toast" id="dismiss-toast" aria-label="Dismiss">×</button>' : '<button class="dismiss-toast" id="dismiss-toast" aria-label="Dismiss">×</button>'}`;
  toast.classList.add('visible');
  window.clearTimeout(noticeTimer);
  document.querySelector('#dismiss-toast').addEventListener('click', dismissToast);
  if (canForce) {
    document.querySelector('#force-order').addEventListener('click', () => {
      const order = pendingOrder;
      if (!order || authority < 1) return;
      pendingOrder = null;
      toast.classList.remove('visible');
      attemptMove(order.move, true);
    });
  } else {
    noticeTimer = window.setTimeout(dismissToast, 3800);
  }
}

function dismissToast() {
  document.querySelector('#toast').classList.remove('visible');
  pendingOrder = null;
  selected = null;
  legalMoves = [];
  renderBoard();
}

function showPromotionChooser(moves) {
  promotionMoves = moves;
  const options = document.querySelector('#promotion-options');
  options.innerHTML = ['q', 'r', 'b', 'n'].map((type) => {
    const move = moves.find((candidate) => candidate.promotion === type);
    return `<button class="promotion-option" type="button" data-promotion="${type}" aria-label="Promote to ${labels[type]}"><span class="promotion-glyph">${glyphs.w[type]}</span><span>${labels[type].toUpperCase()}</span></button>`;
  }).join('');
  options.querySelectorAll('[data-promotion]').forEach((button) => {
    button.addEventListener('click', () => {
      const move = promotionMoves.find((candidate) => candidate.promotion === button.dataset.promotion);
      hidePromotionChooser();
      attemptMove(move);
    });
  });
  document.querySelector('#promotion-backdrop').hidden = false;
  options.querySelector('button')?.focus();
}

function hidePromotionChooser() {
  promotionMoves = null;
  document.querySelector('#promotion-backdrop').hidden = true;
}

function checkGameOver() {
  if (!game.isGameOver()) return false;
  gameOver = true;
  updateStatus();
  const botColor = playerColor === 'w' ? 'b' : 'w';
  const playerWon = game.isCheckmate() && game.turn() === botColor;
  let copy = game.isCheckmate() ? (playerWon ? 'Every piece followed you to the final move.' : `${selectedBot.name} outplayed you. Rebuild your command and challenge the table again.`) : 'Neither side could claim the throne. The match is recorded as a draw.';
  if (playerWon) {
    const newSkill = selectedBot.unlock;
    if (!unlockedSkills.has(newSkill)) {
      unlockedSkills.add(newSkill);
      localStorage.setItem('crown-zero-skills', JSON.stringify([...unlockedSkills].filter((id) => id !== 'rally')));
      const unlockedSkill = skills.find((skill) => skill.id === newSkill);
      copy += ` ${unlockedSkill.name} unlocked: ${unlockedSkill.detail}`;
    }
  }
  const title = game.isCheckmate() ? (playerWon ? 'The crown is yours.' : 'The crown is lost.') : 'A draw at the table.';
  showResult(title, copy);
  return true;
}

function showResult(title, copy) {
  document.querySelector('#result-title').textContent = title;
  document.querySelector('#result-copy').textContent = copy;
  document.querySelector('#modal-backdrop').hidden = false;
}

function resign() {
  if (gameOver) return;
  gameOver = true;
  updateStatus();
  showResult('The crown is surrendered.', `${selectedBot.name} accepts your concession. Choose a new rival for your next match.`);
}

function startNewGame() {
  window.clearTimeout(botTimer);
  botTimer = null;
  game = new Chess();
  selected = null;
  legalMoves = [];
  authority = 1;
  moveNumber = 0;
  thinking = false;
  gameOver = false;
  pendingOrder = null;
  usedSkills = new Set();
  hidePromotionChooser();
  faith.clear();
  history.length = 0;
  document.querySelector('#modal-backdrop').hidden = true;
  document.querySelector('#toast').classList.remove('visible');
  document.querySelector('#setup-screen').hidden = true;
  document.querySelector('.arena').hidden = false;
  resizeBoard();
  if (playerColor === 'b') camera.position.set(-9, 10.5, -12);
  else camera.position.set(9, 10.5, 12);
  controls.target.set(0, 0.2, 0);
  controls.update();
  controls.saveState();
  renderBoard();
  renderHistory();
  updateStatus();
  if (playerColor === 'b') {
    thinking = true;
    updateStatus();
    botTimer = window.setTimeout(makeRivalMove, 480);
  }
}

renderShell();
initThreeBoard();
renderBoard();
renderHistory();
updateStatus();