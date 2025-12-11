// DOM
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('nextCanvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreElement = document.getElementById('score');
const startButton = document.getElementById('start-button');

// --- 設定 ---
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 20; // 表示解像度：1マス = 20px

// canvas 実ピクセル設定（CSSとは別に）
canvas.width = COLS * BLOCK_SIZE;
canvas.height = ROWS * BLOCK_SIZE;
nextCanvas.width = 80;
nextCanvas.height = 80;

// 時間管理
let lastTime = 0;
let dropCounter = 0;
const dropInterval = 1000;

let board = [];
let score = 0;
let gameLoopId = null;
let isPlaying = false;

const TETROMINOS = [
    null,
    { matrix: [ [0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0] ], color: '#00FFFF', id: 1 }, // I
    { matrix: [ [2,0,0],[2,2,2],[0,0,0] ], color: '#0000FF', id: 2 }, // J
    { matrix: [ [0,0,3],[3,3,3],[0,0,0] ], color: '#FF7F00', id: 3 }, // L
    { matrix: [ [4,4],[4,4] ], color: '#FFFF00', id: 4 }, // O
    { matrix: [ [0,5,5],[5,5,0],[0,0,0] ], color: '#00FF00', id: 5 }, // S
    { matrix: [ [0,6,0],[6,6,6],[0,0,0] ], color: '#800080', id: 6 }, // T
    { matrix: [ [7,7,0],[0,7,7],[0,0,0] ], color: '#FF0000', id: 7 }  // Z
];

let currentTetromino = null;
let currentPosition = { x: 0, y: 0 };
let nextTetromino = null;

// --- 初期化 ---
function initGame() {
    // 盤面初期化
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    score = 0;
    scoreElement.textContent = score;
    isPlaying = true;

    // next を先に作る
    nextTetromino = randomTetromino();
    spawnTetromino();

    if (gameLoopId) cancelAnimationFrame(gameLoopId);
    lastTime = 0;
    dropCounter = 0;
    startButton.disabled = true;
    update();
}

// --- テトロ生成ヘルパー ---
function randomTetromino() {
    const id = Math.floor(Math.random() * 7) + 1;
    // 深いコピー（配列の参照を切る）
    return JSON.parse(JSON.stringify(TETROMINOS[id]));
}

// --- スポーン ---
function spawnTetromino() {
    // current を next で埋め、次の next を作る
    currentTetromino = nextTetromino ? nextTetromino : randomTetromino();
    nextTetromino = randomTetromino();

    const matrixWidth = currentTetromino.matrix[0].length;
    currentPosition.x = Math.floor(COLS / 2) - Math.floor(matrixWidth / 2);
    currentPosition.y = - findTopEmptyRows(currentTetromino.matrix); // 上部オフセットを許容

    // 生成後に即衝突していればゲームオーバー
    if (isColliding(currentTetromino.matrix, currentPosition)) {
        isPlaying = false;
        cancelAnimationFrame(gameLoopId);
        startButton.disabled = false;
        alert('ゲームオーバー！ スコア: ' + score);
    }

    drawNext();
}

// 上部に空行がある matrix（例 O は top=0, 3x3 の場合 top がある）を探す
function findTopEmptyRows(matrix) {
    let topEmpty = 0;
    for (let y = 0; y < matrix.length; y++) {
        if (matrix[y].every(v => v === 0)) topEmpty++;
        else break;
    }
    return topEmpty;
}

// --- 衝突判定 ---
function isColliding(matrix, offset) {
    for (let y = 0; y < matrix.length; y++) {
        for (let x = 0; x < matrix[y].length; x++) {
            if (matrix[y][x] !== 0) {
                const boardY = offset.y + y;
                const boardX = offset.x + x;

                // 盤面外（左/右/下）
                if (boardX < 0 || boardX >= COLS || boardY >= ROWS) {
                    return true;
                }

                // 上にある場合（boardY < 0）は盤面チェックをスキップ（生成時は OK）
                if (boardY >= 0) {
                    if (board[boardY][boardX] !== 0) return true;
                }
            }
        }
    }
    return false;
}

// --- マージ（固定） ---
function merge() {
    currentTetromino.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                const by = currentPosition.y + y;
                const bx = currentPosition.x + x;
                // 負のインデックスは無視（ゲームオーバー時の処理は spawn 側で行う）
                if (by >= 0 && by < ROWS && bx >= 0 && bx < COLS) {
                    board[by][bx] = currentTetromino.id;
                }
            }
        });
    });
}

// --- 行消去 ---
function checkLineClears() {
    let linesCleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
        if (board[y].every(value => value !== 0)) {
            linesCleared++;
            board.splice(y, 1);
            board.unshift(Array(COLS).fill(0));
            y++; // 同じ index を再チェック
        }
    }
    if (linesCleared > 0) {
        score += [0,40,100,300,1200][linesCleared] || (linesCleared * 100);
        scoreElement.textContent = score;
    }
}

// --- ソフトドロップ（1マス） ---
function softDrop() {
    currentPosition.y++;
    if (isColliding(currentTetromino.matrix, currentPosition)) {
        currentPosition.y--;
        merge();
        checkLineClears();
        spawnTetromino();
    } else {
        // ソフトドロップにスコアボーナスを付けたければここで加算可能（今回は無効）
    }
    dropCounter = 0;
}

// --- ハードドロップ ---
function hardDrop() {
    while (true) {
        currentPosition.y++;
        if (isColliding(currentTetromino.matrix, currentPosition)) {
            currentPosition.y--;
            break;
        }
    }
    merge();
    checkLineClears();
    spawnTetromino();
    dropCounter = 0;
}

// --- 回転 ---
function rotate() {
    const matrix = currentTetromino.matrix;
    const N = matrix.length;
    const newMatrix = Array.from({ length: N }, () => Array(N).fill(0));

    for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
            newMatrix[x][N - 1 - y] = matrix[y][x];
        }
    }

    // 壁キック（簡易）: 回転で衝突 -> 左右に1つずらしてみる（それでも衝突なら回転しない）
    if (!isColliding(newMatrix, currentPosition)) {
        currentTetromino.matrix = newMatrix;
        return;
    }
    const kicks = [ {x: -1, y:0}, {x: 1, y:0}, {x: -2, y:0}, {x: 2, y:0} ];
    for (const k of kicks) {
        const trialPos = { x: currentPosition.x + k.x, y: currentPosition.y + k.y };
        if (!isColliding(newMatrix, trialPos)) {
            currentPosition = trialPos;
            currentTetromino.matrix = newMatrix;
            return;
        }
    }
    // 回転できない場合は何もしない
}

// --- 描画 ---
function draw() {
    // 背景クリア
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 固定ブロックを描画
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            const v = board[y][x];
            if (v !== 0) {
                const block = TETROMINOS[v];
                ctx.fillStyle = block ? block.color : '#888';
                ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
            }
        }
    }

    // 現在ブロックを描画（board外の y<0 部分も描画）
    drawMatrix(ctx, currentTetromino.matrix, currentPosition.x, currentPosition.y, currentTetromino.color);
}

function drawMatrix(ctxRef, matrix, offsetX, offsetY, color) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                const drawX = (offsetX + x) * BLOCK_SIZE;
                const drawY = (offsetY + y) * BLOCK_SIZE;
                // 表示領域外（上）ならスキップ
                if (drawY + BLOCK_SIZE < 0) return;
                ctxRef.fillStyle = color;
                ctxRef.fillRect(drawX, drawY, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
            }
        });
    });
}

// NEXT 表示
function drawNext() {
    // nextCanvas をクリアして小さめのグリッドで描画
    nextCtx.fillStyle = '#111';
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

    if (!nextTetromino) return;

    // 中央に描くためのスケール
    const scale = 16; // next 内でのマスサイズ（見やすさ）
    const matrix = nextTetromino.matrix;
    const N = matrix.length;
    const offsetX = Math.floor((nextCanvas.width / scale - N) / 2);
    const offsetY = Math.floor((nextCanvas.height / scale - N) / 2);

    // 小さなマスで描画
    for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
            if (matrix[y][x] !== 0) {
                nextCtx.fillStyle = nextTetromino.color;
                nextCtx.fillRect((offsetX + x) * scale, (offsetY + y) * scale, scale - 2, scale - 2);
            }
        }
    }
}

// --- メインループ ---
function update(time = 0) {
    if (!isPlaying) return;
    const deltaTime = time - lastTime;
    lastTime = time;
    dropCounter += deltaTime;

    if (dropCounter > dropInterval) {
        // 自動落下
        currentPosition.y++;
        if (isColliding(currentTetromino.matrix, currentPosition)) {
            currentPosition.y--;
            merge();
            checkLineClears();
            spawnTetromino();
        }
        dropCounter = 0;
    }

    draw();
    gameLoopId = requestAnimationFrame(update);
}

// --- キーボード ---
document.addEventListener('keydown', (event) => {
    if (!isPlaying) return;
    // 矢印のページスクロール抑止
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(event.key)) {
        event.preventDefault();
    }

    let moved = false;
    if (event.key === 'ArrowLeft') {
        const newPos = { ...currentPosition, x: currentPosition.x - 1 };
        if (!isColliding(currentTetromino.matrix, newPos)) {
            currentPosition = newPos;
            moved = true;
        }
    } else if (event.key === 'ArrowRight') {
        const newPos = { ...currentPosition, x: currentPosition.x + 1 };
        if (!isColliding(currentTetromino.matrix, newPos)) {
            currentPosition = newPos;
            moved = true;
        }
    } else if (event.key === 'ArrowDown') {
        // ソフトドロップ（1マス）
        softDrop();
        moved = true;
    } else if (event.key === 'ArrowUp') {
        rotate();
        moved = true;
    } else if (event.key === ' ' || event.code === 'Space') {
        // Space でハードドロップ
        hardDrop();
        moved = true;
    }

    if (moved) {
        draw();
    }
});

// --- スタートボタン ---
startButton.addEventListener('click', () => {
    if (!isPlaying) initGame();
});

// 初期に next を用意しておく（ページロード時の NEXT 表示）
nextTetromino = randomTetromino();
drawNext();
