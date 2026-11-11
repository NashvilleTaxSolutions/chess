import { Chess } from 'chess.js';
import './style.css';

const glyphs = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
};
const labels = { k: 'King', q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight', p: 'Pawn' };
const values = { k: 0, q: 9, r: 5, b: 3.2, n: 3, p: 1 };
const files = 'abcdefgh';

let game = new Chess();
let selected = null;
let legalMoves = [];
let authority = 1;
let moveNumber = 0;
let lastMove = null;
let thinking = false;
let gameOver = false;
let pendingOrder = null;
let noticeTimer;
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
    <main class="arena">
      <section class="match-column" aria-label="Match status">
        <div class="section-kicker">CURRENT MATCH <span>01 — 01</span></div>
        <div class="player-card player-you">
          <div class="player-top"><div class="avatar avatar-you">Y</div><div><div class="player-name">THE USURPER</div><div class="player-sub">PLAYER · WHITE</div></div><span class="turn-marker" id="you-turn">YOUR TURN</span></div>
          <div class="player-rank"><span>TACTICAL RATING</span><strong>1,420</strong></div>
          <div class="rating-line"><span></span></div>
        </div>
        <div class="versus"><span></span> VS <span></span></div>
        <div class="player-card player-rival">
          <div class="player-top"><div class="avatar avatar-rival">♜</div><div><div class="player-name">THE REGENT</div><div class="player-sub">OPPONENT · BLACK</div></div><span class="thinking-label" id="rival-turn">AWAITING</span></div>
          <div class="player-rank"><span>THREAT LEVEL</span><strong>III</strong></div>
          <div class="rating-line rival-rating"><span></span></div>
        </div>
        <div class="match-note"><span class="note-icon">✳</span><p>“A crown is not inherited. It is taken from the board.”</p><span class="note-credit">— THE REGENT</span></div>
      </section>

      <section class="board-column" aria-label="Chess board">
        <div class="board-heading"><div><div class="eyebrow">A GAME OF CONVICTION</div><h1>Make them <em>believe.</em></h1></div><div class="turn-status" id="turn-status"><span class="status-pip"></span> YOUR MOVE</div></div>
        <div class="board-frame"><div class="coordinate-files" id="files-top"></div><div class="coordinate-ranks" id="ranks-left"></div><div class="board" id="board" role="grid" aria-label="Chess board"></div><div class="coordinate-ranks ranks-right" id="ranks-right"></div><div class="coordinate-files files-bottom" id="files-bottom"></div></div>
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
          <div class="command-hint"><span>!</span><p>A unit below <b>25%</b> may refuse a move that throws it into danger.</p></div>
        </section>
        <section class="history-panel">
          <div class="history-heading"><span>FIELD RECORD</span><span id="move-count">01 / —</span></div>
          <div class="move-list" id="move-list"><div class="empty-history">The first move is yours.</div></div>
          <button class="resign-button" id="resign-button">CONCEDE THE MATCH <span>↗</span></button>
        </section>
      </aside>
    </main>
    <div class="toast" id="toast" role="status" aria-live="polite"></div>
    <div class="modal-backdrop" id="modal-backdrop" hidden><div class="result-modal"><div class="modal-kicker">THE IMPERIAL TABLE</div><h2 id="result-title">Checkmate.</h2><p id="result-copy"></p><button id="rematch-button">PLAY AGAIN <span>↗</span></button></div></div>
  `;

  document.querySelector('#new-game').addEventListener('click', startNewGame);
  document.querySelector('#rematch-button').addEventListener('click', startNewGame);
  document.querySelector('#resign-button').addEventListener('click', resign);
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

function renderBoard() {
  const boardEl = document.querySelector('#board');
  const board = game.board();
  boardEl.innerHTML = '';
  const legalBySquare = new Map(legalMoves.map((move) => [move.to, move]));
  const last = boardToMove();
  lastMove = last ? [last.from, last.to] : null;

  board.forEach((rank, row) => rank.forEach((piece, col) => {
    const square = `${files[col]}${8 - row}`;
    const cell = document.createElement('button');
    cell.className = `square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
    cell.type = 'button';
    cell.setAttribute('role', 'gridcell');
    cell.setAttribute('aria-label', `${square}${piece ? `, ${piece.color === 'w' ? 'white' : 'black'} ${labels[piece.type]}` : ''}`);
    cell.dataset.square = square;
    if (lastMove?.includes(square)) cell.classList.add('last-move');
    if (selected === square) cell.classList.add('selected');
    if (game.isCheck() && piece?.type === 'k' && piece.color === game.turn()) cell.classList.add('in-check');
    if (legalBySquare.has(square)) {
      cell.classList.add(piece ? 'capture-target' : 'move-target');
      if (!piece) cell.innerHTML = '<span class="move-dot"></span>';
    }
    if (piece) {
      const pieceEl = document.createElement('span');
      pieceEl.className = `piece ${piece.color === 'w' ? 'white-piece' : 'black-piece'} ${piece.type === 'k' ? 'king-piece' : ''}`;
      pieceEl.textContent = glyphs[piece.color][piece.type];
      pieceEl.setAttribute('aria-hidden', 'true');
      cell.append(pieceEl);
    }
    cell.addEventListener('click', () => onSquareClick(square));
    boardEl.append(cell);
  }));
  updateCoordinates();
  document.querySelector('#check-label').textContent = game.isCheck() ? 'CHECK' : '';
  renderFaith();
}

function updateCoordinates() {
  const filesMarkup = [...files].map((file) => `<span>${file}</span>`).join('');
  document.querySelector('#files-top').innerHTML = filesMarkup;
  document.querySelector('#files-bottom').innerHTML = filesMarkup;
  document.querySelector('#ranks-left').innerHTML = '87654321'.split('').map((rank) => `<span>${rank}</span>`).join('');
  document.querySelector('#ranks-right').innerHTML = '87654321'.split('').map((rank) => `<span>${rank}</span>`).join('');
}

function renderFaith() {
  const roster = document.querySelector('#faith-roster');
  const entries = [];
  game.board().forEach((rank, row) => rank.forEach((piece, col) => {
    if (piece?.color === 'w') {
      const square = `${files[col]}${8 - row}`;
      entries.push({ piece, square, value: getFaith(square, piece) });
    }
  }));
  roster.innerHTML = entries.map(({ piece, square, value }) => `<div class="faith-unit" title="${labels[piece.type]} at ${square}: ${value}% conviction"><span class="faith-glyph">${glyphs.w[piece.type]}</span><span class="faith-meter"><i class="${value < 35 ? 'low-faith' : ''}" style="width:${value}%"></i></span></div>`).join('');
  document.querySelector('#faith-overview').textContent = `${entries.length.toString().padStart(2, '0')} UNITS`;
  document.querySelector('#authority-count').textContent = authority.toString().padStart(2, '0');
  document.querySelector('#authority-track').innerHTML = Array.from({ length: 4 }, (_, i) => `<i class="${i < authority ? 'filled' : ''}"></i>`).join('');
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
  const whiteTurn = game.turn() === 'w' && !thinking && !gameOver;
  document.querySelector('#you-turn').textContent = whiteTurn ? 'YOUR TURN' : gameOver ? 'MATCH ENDED' : 'STANDING BY';
  document.querySelector('#you-turn').classList.toggle('is-waiting', !whiteTurn);
  document.querySelector('#rival-turn').textContent = thinking ? 'THINKING' : gameOver ? 'MATCH ENDED' : 'AWAITING';
  document.querySelector('#rival-turn').classList.toggle('is-thinking', thinking);
  document.querySelector('#turn-status').innerHTML = `<span class="status-pip ${thinking ? 'rival-pip' : ''}"></span> ${thinking ? 'REGENT THINKS' : gameOver ? 'MATCH COMPLETE' : 'YOUR MOVE'}`;
  document.querySelector('#resign-button').disabled = gameOver;
}

function onSquareClick(square) {
  if (game.turn() !== 'w' || thinking || gameOver || pendingOrder) return;
  const piece = game.get(square);
  if (selected && legalMoves.some((move) => move.to === square)) {
    const move = legalMoves.find((candidate) => candidate.to === square);
    attemptMove(move);
    return;
  }
  if (piece?.color === 'w') {
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
  game.move({ from: move.from, to: move.to, promotion: 'q' });
  let score = positionScore(game, side) - before;
  if (game.isCheck()) score += 0.3;
  if (game.isCheckmate()) score += 100;
  game.undo();
  return score;
}

function attemptMove(move, force = false) {
  const candidates = game.moves({ verbose: true }).map((candidate) => ({ move: candidate, score: scoreMove(candidate, 'w') }));
  const best = Math.max(...candidates.map((candidate) => candidate.score));
  const chosen = candidates.find(({ move: candidate }) => candidate.from === move.from && candidate.to === move.to && candidate.promotion === move.promotion);
  const gap = best - chosen.score;
  const movedPiece = game.get(move.from);
  const pieceFaith = getFaith(move.from, movedPiece);
  const appearsDangerous = isSquareAttackedAfter(move, move.to, 'b');
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
  if (moveNumber % 2 === 0) history.push({ white: result.san, black: '', quality: quality.text, qualityClass: quality.className });
  else history[moveTurn].black = result.san;
  moveNumber += 1;
  renderBoard();
  renderHistory();
  updateStatus();
  if (checkGameOver()) return;
  thinking = true;
  updateStatus();
  window.setTimeout(makeRivalMove, 480);
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
  if (gameOver) return;
  const moves = game.moves({ verbose: true });
  const scored = moves.map((move) => ({ move, score: scoreMove(move, 'b') }));
  scored.sort((a, b) => b.score - a.score);
  const shortlist = scored.slice(0, Math.min(4, scored.length));
  const chosen = shortlist[Math.floor(Math.random() * Math.min(shortlist.length, 2))].move;
  const result = game.move({ from: chosen.from, to: chosen.to, promotion: chosen.promotion || 'q' });
  const turn = history.at(-1);
  if (turn) turn.black = result.san;
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

function checkGameOver() {
  if (!game.isGameOver()) return false;
  gameOver = true;
  updateStatus();
  const title = game.isCheckmate() ? (game.turn() === 'w' ? 'The crown is lost.' : 'The crown is yours.') : 'A draw at the table.';
  const copy = game.isCheckmate() ? (game.turn() === 'w' ? 'The Regent outplayed you. Rebuild your command and challenge the table again.' : 'Your strategy held. Every piece followed you to the final move.') : 'Neither side could claim the throne. The match is recorded as a draw.';
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
  showResult('The crown is surrendered.', 'The Regent accepts your concession. A new match is waiting at the table.');
}

function startNewGame() {
  game = new Chess();
  selected = null;
  legalMoves = [];
  authority = 1;
  moveNumber = 0;
  thinking = false;
  gameOver = false;
  pendingOrder = null;
  faith.clear();
  history.length = 0;
  document.querySelector('#modal-backdrop').hidden = true;
  document.querySelector('#toast').classList.remove('visible');
  renderBoard();
  renderHistory();
  updateStatus();
}

renderShell();
renderBoard();
renderHistory();
updateStatus();