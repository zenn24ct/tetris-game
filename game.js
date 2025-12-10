const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const startButton = document.getElementById('start-button');

// --- ゲーム設定 ---
const COLS = 10; // 列数
const ROWS = 20; // 行数
const BLOCK_SIZE = 20; // 1マスのサイズ

// canvasのサイズを設定
canvas.width = COLS * BLOCK_SIZE;
canvas.height = ROWS * BLOCK_SIZE;

// --- 時間とループ管理 ---
let lastTime = 0;
let dropCounter = 0;
const dropInterval = 1000; // 1秒ごとに落下 (ミリ秒)

let board = []; // ゲーム盤の状態を保持 (0:空, 1~7:ブロックID)
let score = 0;
let gameLoop;
let isPlaying = false; // ゲームの状態フラグ

// --- テトリミノの形状と色の具体的な定義 ---
const TETROMINOS = [
    null, // 0: 空
    { matrix: [ [0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0] ], color: '#00FFFF', id: 1 }, // I (シアン)
    { matrix: [ [2, 0, 0], [2, 2, 2], [0, 0, 0] ], color: '#0000FF', id: 2 }, // J (青)
    { matrix: [ [0, 0, 3], [3, 3, 3], [0, 0, 0] ], color: '#FF7F00', id: 3 }, // L (オレンジ)
    { matrix: [ [4, 4], [4, 4] ], color: '#FFFF00', id: 4 }, // O (黄)
    { matrix: [ [0, 5, 5], [5, 5, 0], [0, 0, 0] ], color: '#00FF00', id: 5 }, // S (緑)
    { matrix: [ [0, 6, 0], [6, 6, 6], [0, 0, 0] ], color: '#800080', id: 6 }, // T (紫)
    { matrix: [ [7, 7, 0], [0, 7, 7], [0, 0, 0] ], color: '#FF0000', id: 7 }  // Z (赤)
];

let currentTetromino; 
let currentPosition = { x: 0, y: 0 }; 

// --- 初期化 ---
function initGame() {
    score = 0;
    scoreElement.textContent = score;
    isPlaying = true;

    // 盤面を0（空）で初期化
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    
    spawnTetromino();
    
    if (gameLoop) cancelAnimationFrame(gameLoop);
    lastTime = 0; 
    update();
    startButton.disabled = true;
}

// --- ブロック生成 ---
function spawnTetromino() {
    const id = Math.floor(Math.random() * 7) + 1;
    // ディープコピーで、TETROMINOS配列が変更されないようにする
    const newBlock = JSON.parse(JSON.stringify(TETROMINOS[id])); 
    currentTetromino = newBlock;
    
    const matrixWidth = currentTetromino.matrix[0].length;
    currentPosition.x = Math.floor(COLS / 2) - Math.floor(matrixWidth / 2);
    currentPosition.y = 0;

    // 生成直後に衝突したらゲームオーバー
    if (isColliding(currentTetromino.matrix, currentPosition)) {
        isPlaying = false;
        alert('ゲームオーバー！ スコア: ' + score);
        startButton.disabled = false;
        cancelAnimationFrame(gameLoop);
    }
}

// --- 衝突判定 ---
function isColliding(matrix, offset) {
    for (let y = 0; y < matrix.length; y++) {
        for (let x = 0; x < matrix[y].length; x++) {
            if (matrix[y][x] !== 0) {
                const boardY = offset.y + y;
                const boardX = offset.x + x;
                
                // 1. 壁や底と衝突 (盤面外に出る)
                if (boardY >= ROWS || boardX < 0 || boardX >= COLS) {
                    return true;
                }
                
                // 2. 既存のブロックと衝突
                if (boardY >= 0 && board[boardY][boardX] !== 0) {
                    return true;
                }
            }
        }
    }
    return false;
}

// --- 盤面にブロックを固定（マージ） ---
function merge() {
    currentTetromino.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                board[currentPosition.y + y][currentPosition.x + x] = currentTetromino.id;
            }
        });
    });
}

// --- 行消去処理 ---
function checkLineClears() {
    let linesCleared = 0;
    
    for (let y = ROWS - 1; y >= 0; y--) {
        if (board[y].every(value => value !== 0)) {
            linesCleared++;
            
            // 行を削除し、新しい空行を上部に追加
            const row = board.splice(y, 1)[0].fill(0);
            board.unshift(row);
            
            // 行を削除したので、同じ行を再度チェック
            y++;
        }
    }
    
    // スコア加算
    if (linesCleared > 0) {
        score += [0, 40, 100, 300, 1200][linesCleared];
        scoreElement.textContent = score;
    }
}

// --- 自動落下（ソフトドロップ） ---
function drop() {
    currentPosition.y++;
    if (isColliding(currentTetromino.matrix, currentPosition)) {
        currentPosition.y--; 
        merge();           
        checkLineClears(); 
        spawnTetromino();  
    }
}

// --- 【★追加機能：ハードドロップ】 ---
function hardDrop() {
    // 衝突するまでY座標を増やし続ける
    while (true) {
        currentPosition.y++;
        
        if (isColliding(currentTetromino.matrix, currentPosition)) {
            currentPosition.y--; // 衝突したら1つ戻す
            break; 
        }
    }

    // 着地点にブロックを固定
    merge();
    
    // 行消去と次のブロック生成
    checkLineClears();
    spawnTetromino();
    
    // 落下タイマーをリセットし、すぐに次のブロックを動かし始める
    dropCounter = 0; 
}

// --- ブロックの回転 ---
function rotate() {
    const matrix = currentTetromino.matrix;
    const N = matrix.length; 
    const newMatrix = Array.from({ length: N }, () => Array(N).fill(0));

    // 時計回りに90度回転のアルゴリズム
    for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
            newMatrix[x][N - 1 - y] = matrix[y][x];
        }
    }

    // 回転後の形状で衝突判定
    if (!isColliding(newMatrix, currentPosition)) {
        currentTetromino.matrix = newMatrix;
    } 
}

// --- 描画関数 ---
function draw() {
    // 1. 盤面全体をクリア
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. 盤面（固定されたブロック）を描画
    board.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                const block = TETROMINOS[value];
                ctx.fillStyle = block.color;
                ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
            }
        });
    });

    // 3. 現在操作中のブロックを描画
    drawMatrix(currentTetromino.matrix, currentPosition.x, currentPosition.y, currentTetromino.color);
}

// ブロック描画のヘルパー関数
function drawMatrix(matrix, offsetX, offsetY, color) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                ctx.fillStyle = color;
                ctx.fillRect(
                    (offsetX + x) * BLOCK_SIZE, 
                    (offsetY + y) * BLOCK_SIZE, 
                    BLOCK_SIZE - 1, 
                    BLOCK_SIZE - 1
                );
            }
        });
    });
}

// --- メイン更新ループ ---
function update(time = 0) {
    if (!isPlaying) return;

    const deltaTime = time - lastTime;
    lastTime = time;

    dropCounter += deltaTime;

    // 1秒経過したらdrop関数を実行
    if (dropCounter > dropInterval) {
        drop();
        dropCounter = 0; 
    }

    draw();
    gameLoop = requestAnimationFrame(update); 
}

// --- キーボード入力ハンドラー (移動・回転・ハードドロップ) ---
document.addEventListener('keydown', event => {
    if (!isPlaying) return;
    
    let newPos = { ...currentPosition };

    if (event.key === 'ArrowLeft') {
        newPos.x--;
    } else if (event.key === 'ArrowRight') {
        newPos.x++;
    } else if (event.key === 'ArrowDown') {
        // ↓キーはハードドロップを実行
        hardDrop(); 
        return; 
    } else if (event.key === 'ArrowUp') {
        // ↑キーは回転を実行
        rotate();
        return; 
    }
    
    // 移動後の位置で衝突判定
    if (!isColliding(currentTetromino.matrix, newPos)) {
        currentPosition = newPos;
    }
});

// --- スタートボタンの処理 ---
startButton.addEventListener('click', initGame);
