// 游戏配置
const BOARD_SIZE = 15;
const CELL_SIZE = 30;
const PADDING = 20;
const PIECE_RADIUS = 12;

// 游戏状态
let gameState = {
    mode: null, // 'pvp' or 'ai'
    difficulty: null, // 'easy', 'medium', 'hard'
    board: [],
    currentPlayer: 1, // 1: 黑子, 2: 白子
    gameOver: false,
    canvas: null,
    ctx: null,
    transpositionTable: new Map(), // 置换表
    historyTable: {},  // 历史启发表
    killerMoves: [],   // 杀手移动表
    searchNodes: 0,    // 搜索节点计数
    moveHistory: [],   // 移动历史记录
    winningLine: [],   // 获胜的五颗棋子位置
    animationTime: 0,  // 动画时间
    animationId: null, // 动画ID
    zobristTable: null, // Zobrist哈希表
    currentHash: 0,    // 当前棋盘哈希值
    pvTable: new Map(), // PV移动表
    evalCache: new Map() // 评估缓存
};

// 初始化Zobrist哈希表
function initZobristTable() {
    const table = [];
    // 为每个位置的每个玩家生成随机数
    for (let i = 0; i < BOARD_SIZE; i++) {
        table[i] = [];
        for (let j = 0; j < BOARD_SIZE; j++) {
            table[i][j] = [];
            // 玩家1和玩家2的随机数
            table[i][j][1] = Math.floor(Math.random() * 0x7FFFFFFF);
            table[i][j][2] = Math.floor(Math.random() * 0x7FFFFFFF);
        }
    }
    return table;
}

// 计算初始哈希值
function calculateInitialHash() {
    if (!gameState.zobristTable) {
        gameState.zobristTable = initZobristTable();
    }
    let hash = 0;
    for (let i = 0; i < BOARD_SIZE; i++) {
        for (let j = 0; j < BOARD_SIZE; j++) {
            const player = gameState.board[i][j];
            if (player !== 0) {
                hash ^= gameState.zobristTable[i][j][player];
            }
        }
    }
    return hash;
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initCanvas();
});

// 初始化画布
function initCanvas() {
    const canvas = document.getElementById('gameBoard');
    const ctx = canvas.getContext('2d');

    // 根据屏幕大小调整棋盘
    const maxSize = Math.min(window.innerWidth - 60, window.innerHeight - 300, 600);
    const cellSize = Math.floor(maxSize / BOARD_SIZE);
    const boardSize = cellSize * (BOARD_SIZE - 1) + PADDING * 2;

    canvas.width = boardSize;
    canvas.height = boardSize;

    gameState.canvas = canvas;
    gameState.ctx = ctx;
    gameState.cellSize = cellSize;
    gameState.padding = PADDING;

    // 添加点击事件
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('touchstart', handleTouch);
}

// 选择游戏模式
function selectMode(mode) {
    gameState.mode = mode;

    if (mode === 'pvp') {
        startGame('pvp');
    } else if (mode === 'ai') {
        document.getElementById('modeSelection').classList.add('hidden');
        document.getElementById('difficultySelection').classList.remove('hidden');
    }
}

// 返回模式选择
function backToModeSelection() {
    document.getElementById('difficultySelection').classList.add('hidden');
    document.getElementById('modeSelection').classList.remove('hidden');
}

// 开始游戏
function startGame(difficulty) {
    // 停止动画
    stopAnimation();

    // 初始化棋盘
    gameState.board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(0));
    gameState.currentPlayer = 1;
    gameState.gameOver = false;
    gameState.difficulty = difficulty;
    gameState.moveHistory = []; // 清空历史记录
    gameState.winningLine = []; // 清空获胜线

    // 初始化Zobrist哈希表和哈希值
    if (!gameState.zobristTable) {
        gameState.zobristTable = initZobristTable();
    }
    gameState.currentHash = 0;

    // 清空缓存
    gameState.pvTable.clear();
    gameState.evalCache.clear();

    // 隐藏选择界面，显示游戏界面
    document.getElementById('modeSelection').classList.add('hidden');
    document.getElementById('difficultySelection').classList.add('hidden');
    document.getElementById('gameArea').classList.remove('hidden');
    document.getElementById('gameOverModal').classList.add('hidden');

    // 更新游戏信息
    updateGameInfo();
    updateUndoButton();

    // 绘制棋盘
    drawBoard();
}

// 更新游戏信息
function updateGameInfo() {
    const currentPlayerEl = document.getElementById('currentPlayer');
    const gameModeEl = document.getElementById('gameMode');

    if (gameState.currentPlayer === 1) {
        currentPlayerEl.textContent = '黑子回合';
        currentPlayerEl.style.color = '#333';
    } else {
        currentPlayerEl.textContent = '白子回合';
        currentPlayerEl.style.color = '#999';
    }

    if (gameState.mode === 'pvp') {
        gameModeEl.textContent = '双人对战';
    } else {
        const difficultyMap = {
            'easy': '初级',
            'medium': '中级',
            'hard': '高级'
        };
        gameModeEl.textContent = `人机对战 - ${difficultyMap[gameState.difficulty]}`;
    }
}

// 绘制棋盘
function drawBoard() {
    const { ctx, cellSize, padding } = gameState;
    const canvas = gameState.canvas;

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制背景
    ctx.fillStyle = '#dcb35c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 绘制网格
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;

    for (let i = 0; i < BOARD_SIZE; i++) {
        // 横线
        ctx.beginPath();
        ctx.moveTo(padding, padding + i * cellSize);
        ctx.lineTo(padding + (BOARD_SIZE - 1) * cellSize, padding + i * cellSize);
        ctx.stroke();

        // 竖线
        ctx.beginPath();
        ctx.moveTo(padding + i * cellSize, padding);
        ctx.lineTo(padding + i * cellSize, padding + (BOARD_SIZE - 1) * cellSize);
        ctx.stroke();
    }

    // 绘制星位
    const starPoints = [
        [3, 3], [3, 11], [11, 3], [11, 11], [7, 7]
    ];
    ctx.fillStyle = '#000';
    starPoints.forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(padding + x * cellSize, padding + y * cellSize, 4, 0, 2 * Math.PI);
        ctx.fill();
    });

    // 绘制棋子
    for (let i = 0; i < BOARD_SIZE; i++) {
        for (let j = 0; j < BOARD_SIZE; j++) {
            if (gameState.board[i][j] !== 0) {
                drawPiece(i, j, gameState.board[i][j]);
            }
        }
    }

    // 绘制获胜线标记
    if (gameState.winningLine.length > 0) {
        drawWinningLine();
    }
}

// 绘制棋子
function drawPiece(row, col, player) {
    const { ctx, cellSize, padding } = gameState;
    const x = padding + col * cellSize;
    const y = padding + row * cellSize;
    const radius = cellSize * 0.4;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);

    if (player === 1) {
        // 黑子
        const gradient = ctx.createRadialGradient(x - radius/3, y - radius/3, 0, x, y, radius);
        gradient.addColorStop(0, '#666');
        gradient.addColorStop(1, '#000');
        ctx.fillStyle = gradient;
    } else {
        // 白子
        const gradient = ctx.createRadialGradient(x - radius/3, y - radius/3, 0, x, y, radius);
        gradient.addColorStop(0, '#fff');
        gradient.addColorStop(1, '#ddd');
        ctx.fillStyle = gradient;
    }

    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();
}

// 绘制获胜线标记（带动画）
function drawWinningLine() {
    const { ctx, cellSize, padding, animationTime } = gameState;

    // 使用sin函数创建脉动效果
    const pulse = Math.sin(animationTime * 0.005) * 0.3 + 0.7; // 0.4 到 1.0 之间变化
    const opacity = Math.sin(animationTime * 0.003) * 0.3 + 0.7; // 透明度变化

    gameState.winningLine.forEach(pos => {
        const x = padding + pos.col * cellSize;
        const y = padding + pos.row * cellSize;
        const radius = cellSize * 0.5 * pulse;

        // 绘制外层红色高亮圆圈
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = `rgba(255, 0, 0, ${opacity})`;
        ctx.lineWidth = 4;
        ctx.stroke();

        // 绘制内层橙色圆圈
        ctx.beginPath();
        ctx.arc(x, y, radius - 5, 0, 2 * Math.PI);
        ctx.strokeStyle = `rgba(255, 165, 0, ${opacity * 0.8})`;
        ctx.lineWidth = 2;
        ctx.stroke();

        // 绘制中心黄色光点
        ctx.beginPath();
        ctx.arc(x, y, 3 * pulse, 0, 2 * Math.PI);
        ctx.fillStyle = `rgba(255, 255, 0, ${opacity})`;
        ctx.fill();
    });
}

// 动画循环
function animate() {
    if (gameState.winningLine.length > 0) {
        gameState.animationTime += 16; // 约60fps
        drawBoard();
        gameState.animationId = requestAnimationFrame(animate);
    }
}

// 开始获胜动画
function startWinningAnimation() {
    if (gameState.animationId) {
        cancelAnimationFrame(gameState.animationId);
    }
    gameState.animationTime = 0;
    animate();
}

// 停止动画
function stopAnimation() {
    if (gameState.animationId) {
        cancelAnimationFrame(gameState.animationId);
        gameState.animationId = null;
    }
    gameState.animationTime = 0;
}

// 处理点击事件
function handleClick(e) {
    if (gameState.gameOver) return;

    const rect = gameState.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    processMove(x, y);
}

// 处理触摸事件
function handleTouch(e) {
    e.preventDefault();
    if (gameState.gameOver) return;

    const rect = gameState.canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    processMove(x, y);
}

// 处理落子
function processMove(x, y) {
    const { cellSize, padding } = gameState;

    // 计算最近的交叉点
    const col = Math.round((x - padding) / cellSize);
    const row = Math.round((y - padding) / cellSize);

    // 检查是否在棋盘范围内
    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return;

    // 检查该位置是否已有棋子
    if (gameState.board[row][col] !== 0) return;

    // 人机模式且轮到AI时，玩家不能落子
    if (gameState.mode === 'ai' && gameState.currentPlayer === 2) return;

    // 落子
    makeMove(row, col);
}

// 落子
function makeMove(row, col) {
    // 记录移动历史
    gameState.moveHistory.push({
        row: row,
        col: col,
        player: gameState.currentPlayer
    });

    gameState.board[row][col] = gameState.currentPlayer;
    updateHash(row, col, gameState.currentPlayer); // 更新哈希值
    drawBoard();
    updateUndoButton();

    // 检查胜负
    if (checkWin(row, col)) {
        gameState.gameOver = true;
        startWinningAnimation(); // 启动获胜动画
        showGameOver(gameState.currentPlayer);
        return;
    }

    // 检查平局
    if (isBoardFull()) {
        gameState.gameOver = true;
        showGameOver(0);
        return;
    }

    // 切换玩家
    gameState.currentPlayer = gameState.currentPlayer === 1 ? 2 : 1;
    updateGameInfo();

    // 人机模式下，轮到AI
    if (gameState.mode === 'ai' && gameState.currentPlayer === 2) {
        // 使用短延迟让界面先更新
        setTimeout(() => {
            requestAnimationFrame(aiMove);
        }, 100);
    }
}

// AI落子
async function aiMove() {
    if (gameState.gameOver) return;

    let move;

    switch (gameState.difficulty) {
        case 'easy':
            move = await getEasyMove();
            break;
        case 'medium':
            move = await getMediumMove();
            break;
        case 'hard':
            move = await getHardMove();
            break;
    }

    if (move) {
        makeMove(move.row, move.col);
    }
}

// 棋型评分表
const SCORE = {
    FIVE: 100000,           // 五连
    ALIVE_FOUR: 10000,      // 活四
    DEAD_FOUR: 5000,        // 冲四
    ALIVE_THREE: 5000,      // 活三
    DEAD_THREE: 1000,       // 眠三
    ALIVE_TWO: 500,         // 活二
    DEAD_TWO: 50,           // 眠二
    ONE: 10                 // 单子
};

// 位置权重表（中心位置更有价值）
const POSITION_WEIGHT = [];
function initPositionWeight() {
    const center = Math.floor(BOARD_SIZE / 2);
    for (let i = 0; i < BOARD_SIZE; i++) {
        POSITION_WEIGHT[i] = [];
        for (let j = 0; j < BOARD_SIZE; j++) {
            // 曼哈顿距离的权重
            const distX = Math.abs(i - center);
            const distY = Math.abs(j - center);
            const dist = Math.max(distX, distY);
            POSITION_WEIGHT[i][j] = 8 - dist; // 中心权重8，边缘权重1
        }
    }
}
initPositionWeight();

// 开局库 - 快速响应开局
function getOpeningMove() {
    const pieceCount = countPieces();
    const center = Math.floor(BOARD_SIZE / 2);

    // AI的第一步（玩家已下1子）
    if (pieceCount === 1) {
        // 如果玩家下在中心，AI下在中心附近
        if (gameState.board[center][center] === 1) {
            // 选择中心周围的一个位置（随机选择以增加变化）
            const offsets = [
                [1, 1], [1, 0], [0, 1], [-1, -1], [-1, 0], [0, -1], [1, -1], [-1, 1]
            ];
            const randomOffset = offsets[Math.floor(Math.random() * offsets.length)];
            return { row: center + randomOffset[0], col: center + randomOffset[1] };
        }
        // 如果玩家没下中心，AI直接下中心
        else {
            return { row: center, col: center };
        }
    }

    // AI的第二步（玩家已下2子，AI已下1子）
    if (pieceCount === 3) {
        // 寻找玩家的两个子，判断是否在同一线上
        const playerPieces = [];
        for (let i = 0; i < BOARD_SIZE; i++) {
            for (let j = 0; j < BOARD_SIZE; j++) {
                if (gameState.board[i][j] === 1) {
                    playerPieces.push({ row: i, col: j });
                }
            }
        }

        if (playerPieces.length === 2) {
            const [p1, p2] = playerPieces;
            const dr = p2.row - p1.row;
            const dc = p2.col - p1.col;

            // 如果两子在同一线上，尝试阻断
            if (dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc)) {
                // 尝试在两子之间或两端阻断
                const blockPositions = [];

                // 中间位置
                if (Math.abs(dr) <= 1 && Math.abs(dc) <= 1) {
                    // 两子相邻，在两端阻断
                    const end1 = { row: p1.row - dr, col: p1.col - dc };
                    const end2 = { row: p2.row + dr, col: p2.col + dc };
                    if (isValidPosition(end1.row, end1.col)) blockPositions.push(end1);
                    if (isValidPosition(end2.row, end2.col)) blockPositions.push(end2);
                }

                // 随机选择一个有效的阻断位置
                if (blockPositions.length > 0) {
                    return blockPositions[Math.floor(Math.random() * blockPositions.length)];
                }
            }
        }

        // 否则下在中心附近的好位置
        const goodPositions = [
            [center - 1, center - 1], [center - 1, center + 1],
            [center + 1, center - 1], [center + 1, center + 1],
            [center - 2, center], [center + 2, center],
            [center, center - 2], [center, center + 2]
        ];

        for (const [r, c] of goodPositions) {
            if (isValidPosition(r, c)) {
                return { row: r, col: c };
            }
        }
    }

    // 3步以后返回null，使用正常搜索
    return null;
}

// 检查位置是否有效且为空
function isValidPosition(row, col) {
    return row >= 0 && row < BOARD_SIZE &&
           col >= 0 && col < BOARD_SIZE &&
           gameState.board[row][col] === 0;
}

// 评估局面复杂度（0-1之间）
function evaluateComplexity() {
    const pieceCount = countPieces();
    let complexity = 0;

    // 棋子数量影响（开局和残局简单，中盘复杂）
    if (pieceCount < 10) {
        complexity += 0.3;
    } else if (pieceCount < 30) {
        complexity += 0.7; // 中盘最复杂
    } else {
        complexity += 0.4; // 残局
    }

    // 威胁数量影响
    let threatCount = 0;
    for (let i = 0; i < BOARD_SIZE; i++) {
        for (let j = 0; j < BOARD_SIZE; j++) {
            if (gameState.board[i][j] !== 0) {
                const patterns = analyzePatterns(i, j, gameState.board[i][j]);
                if (patterns.aliveFour > 0 || patterns.deadFour > 0 || patterns.aliveThree > 0) {
                    threatCount++;
                }
            }
        }
    }

    complexity += Math.min(threatCount * 0.1, 0.3);

    return Math.min(complexity, 1.0);
}

// 自适应深度计算
function getAdaptiveDepth(baseDepth, timeLimit) {
    const complexity = evaluateComplexity();
    const pieceCount = countPieces();

    // 根据复杂度调整深度
    let adjustedDepth = baseDepth;

    // 简单局面可以搜索更深
    if (complexity < 0.4 && pieceCount < 15) {
        adjustedDepth += 2;
    } else if (complexity < 0.6) {
        adjustedDepth += 1;
    } else if (complexity > 0.8) {
        // 复杂局面减少深度以保证时间
        adjustedDepth -= 1;
    }

    return Math.max(baseDepth - 2, Math.min(adjustedDepth, baseDepth + 3));
}

// 初级AI - 6步预测深度（自适应）
async function getEasyMove() {
    // 开局库优化：前3步使用固定策略
    const openingMove = getOpeningMove();
    if (openingMove) {
        return openingMove;
    }

    showAIThinking('初级');

    // 等待一帧，确保UI更新
    await new Promise(resolve => setTimeout(resolve, 50));

    // 智能清空缓存（保留部分有用数据）
    if (gameState.transpositionTable.size > 50000) {
        // 只清空一半，保留最近的数据
        const entries = Array.from(gameState.transpositionTable.entries());
        gameState.transpositionTable.clear();
        entries.slice(-25000).forEach(([k, v]) => gameState.transpositionTable.set(k, v));
    }
    gameState.historyTable = {};
    gameState.killerMoves = Array(20).fill(null).map(() => []);
    gameState.searchNodes = 0;

    // 如果能赢，直接赢
    const winMove = findWinningMove(2);
    if (winMove) {
        hideAIThinking();
        return winMove;
    }

    // 如果对手要赢，必须防守
    const blockMove = findWinningMove(1);
    if (blockMove) {
        hideAIThinking();
        return blockMove;
    }

    // VCF搜索（减少深度）
    const vcfMove = findVCF(2, 8);
    if (vcfMove) {
        hideAIThinking();
        return vcfMove;
    }

    // 防守对手的VCF
    const blockVcf = findVCF(1, 6);
    if (blockVcf) {
        hideAIThinking();
        return blockVcf;
    }

    // 检查活四
    const aliveFourMove = findPatternMove(2, 'ALIVE_FOUR');
    if (aliveFourMove) {
        hideAIThinking();
        return aliveFourMove;
    }

    // 防守对手活四
    const blockAliveFour = findPatternMove(1, 'ALIVE_FOUR');
    if (blockAliveFour) {
        hideAIThinking();
        return blockAliveFour;
    }

    // 使用自适应深度迭代加深搜索
    const adaptiveDepth = getAdaptiveDepth(6, 2000);
    console.log(`初级AI开始搜索... 深度=${adaptiveDepth}`);
    const startTime = Date.now();
    const bestMove = iterativeDeepeningSearch(adaptiveDepth, 2000, updateAIThinkingProgress);
    const endTime = Date.now();
    console.log(`搜索完成: ${endTime - startTime}ms, 节点数: ${gameState.searchNodes}`);

    hideAIThinking();
    return bestMove || findBestMoveWithScore(2, 0);
}

// 中级AI - 10步预测深度
async function getMediumMove() {
    // 开局库优化：前3步使用固定策略
    const openingMove = getOpeningMove();
    if (openingMove) {
        return openingMove;
    }

    showAIThinking('中级');

    // 等待一帧，确保UI更新
    await new Promise(resolve => setTimeout(resolve, 50));

    // 智能清空缓存（保留部分有用数据）
    if (gameState.transpositionTable.size > 50000) {
        const entries = Array.from(gameState.transpositionTable.entries());
        gameState.transpositionTable.clear();
        entries.slice(-25000).forEach(([k, v]) => gameState.transpositionTable.set(k, v));
    }
    gameState.historyTable = {};
    gameState.killerMoves = Array(30).fill(null).map(() => []);
    gameState.searchNodes = 0;

    // 如果能赢，直接赢
    const winMove = findWinningMove(2);
    if (winMove) {
        hideAIThinking();
        return winMove;
    }

    // 如果对手要赢，必须防守
    const blockMove = findWinningMove(1);
    if (blockMove) {
        hideAIThinking();
        return blockMove;
    }

    // VCF搜索 - 连续冲四必胜
    const vcfMove = findVCF(2, 10);
    if (vcfMove) {
        hideAIThinking();
        return vcfMove;
    }

    // 防守对手的VCF
    const blockVcf = findVCF(1, 8);
    if (blockVcf) {
        hideAIThinking();
        return blockVcf;
    }

    // 检查活四
    const aliveFourMove = findPatternMove(2, 'ALIVE_FOUR');
    if (aliveFourMove) {
        hideAIThinking();
        return aliveFourMove;
    }

    // 防守对手活四
    const blockAliveFour = findPatternMove(1, 'ALIVE_FOUR');
    if (blockAliveFour) {
        hideAIThinking();
        return blockAliveFour;
    }

    // 检查双冲四
    const doubleFour = findDoubleFour(2);
    if (doubleFour) {
        hideAIThinking();
        return doubleFour;
    }

    // 防守对手双冲四
    const blockDoubleFour = findDoubleFour(1);
    if (blockDoubleFour) {
        hideAIThinking();
        return blockDoubleFour;
    }

    // 检查双活三和活三+冲四的组合
    const criticalMove = findCriticalMove(2);
    if (criticalMove) {
        hideAIThinking();
        return criticalMove;
    }

    // 防守对手的双活三
    const blockCritical = findCriticalMove(1);
    if (blockCritical) {
        hideAIThinking();
        return blockCritical;
    }

    // 使用自适应深度迭代加深搜索
    const adaptiveDepth = getAdaptiveDepth(10, 4000);
    console.log(`中级AI开始搜索... 深度=${adaptiveDepth}`);
    const startTime = Date.now();
    const bestMove = iterativeDeepeningSearch(adaptiveDepth, 4000, updateAIThinkingProgress);
    const endTime = Date.now();
    console.log(`搜索完成: ${endTime - startTime}ms, 节点数: ${gameState.searchNodes}`);

    hideAIThinking();
    return bestMove || findBestMoveWithScore(2, 0);
}

// 高级AI - 14步预测深度（大师级）
async function getHardMove() {
    // 开局库优化：前3步使用固定策略
    const openingMove = getOpeningMove();
    if (openingMove) {
        return openingMove;
    }

    showAIThinking('高级');

    // 等待一帧，确保UI更新
    await new Promise(resolve => setTimeout(resolve, 50));

    // 智能清空缓存（保留部分有用数据）
    if (gameState.transpositionTable.size > 50000) {
        const entries = Array.from(gameState.transpositionTable.entries());
        gameState.transpositionTable.clear();
        entries.slice(-25000).forEach(([k, v]) => gameState.transpositionTable.set(k, v));
    }
    gameState.historyTable = {};
    gameState.killerMoves = Array(40).fill(null).map(() => []);
    gameState.searchNodes = 0;

    // 如果能赢，直接赢
    const winMove = findWinningMove(2);
    if (winMove) {
        hideAIThinking();
        return winMove;
    }

    // 如果对手要赢，必须防守
    const blockMove = findWinningMove(1);
    if (blockMove) {
        hideAIThinking();
        return blockMove;
    }

    // VCF搜索 - 连续冲四必胜
    const vcfMove = findVCF(2, 12);
    if (vcfMove) {
        hideAIThinking();
        return vcfMove;
    }

    // 防守对手的VCF
    const blockVcf = findVCF(1, 10);
    if (blockVcf) {
        // 检查防守点是否安全
        gameState.board[blockVcf.row][blockVcf.col] = 2;
        const counterVcf = findVCF(1, 8);
        gameState.board[blockVcf.row][blockVcf.col] = 0;
        if (!counterVcf) {
            hideAIThinking();
            return blockVcf;
        }
    }

    // VCT搜索 - 连续活三必胜
    const vctMove = findVCT(2, 8);
    if (vctMove) {
        hideAIThinking();
        return vctMove;
    }

    // 防守对手的VCT
    const blockVct = findVCT(1, 6);
    if (blockVct) {
        hideAIThinking();
        return blockVct;
    }

    // 检查活四
    const aliveFourMove = findPatternMove(2, 'ALIVE_FOUR');
    if (aliveFourMove) {
        hideAIThinking();
        return aliveFourMove;
    }

    // 防守对手活四
    const blockAliveFour = findPatternMove(1, 'ALIVE_FOUR');
    if (blockAliveFour) {
        hideAIThinking();
        return blockAliveFour;
    }

    // 检查双冲四
    const doubleFour = findDoubleFour(2);
    if (doubleFour) {
        hideAIThinking();
        return doubleFour;
    }

    // 防守对手双冲四
    const blockDoubleFour = findDoubleFour(1);
    if (blockDoubleFour) {
        hideAIThinking();
        return blockDoubleFour;
    }

    // 检查是否有必胜组合（双活三、活三+冲四）
    const winningCombo = findWinningCombo(2);
    if (winningCombo) {
        hideAIThinking();
        return winningCombo;
    }

    // 防守对手的必胜组合
    const blockCombo = findWinningCombo(1);
    if (blockCombo) {
        hideAIThinking();
        return blockCombo;
    }

    // 寻找活三
    const aliveThree = findAliveThree(2);
    if (aliveThree) {
        hideAIThinking();
        return aliveThree;
    }

    // 防守对手活三
    const blockAliveThree = findAliveThree(1);
    if (blockAliveThree) {
        hideAIThinking();
        return blockAliveThree;
    }

    // 使用自适应深度迭代加深搜索
    const adaptiveDepth = getAdaptiveDepth(14, 6000);
    console.log(`高级AI开始搜索... 深度=${adaptiveDepth}`);
    const startTime = Date.now();
    const bestMove = iterativeDeepeningSearch(adaptiveDepth, 6000, updateAIThinkingProgress);
    const endTime = Date.now();
    console.log(`搜索完成: ${endTime - startTime}ms, 节点数: ${gameState.searchNodes}`);

    hideAIThinking();
    return bestMove || findBestMoveWithDeepSearch();
}

// 检查棋盘是否为空
function isEmpty() {
    for (let i = 0; i < BOARD_SIZE; i++) {
        for (let j = 0; j < BOARD_SIZE; j++) {
            if (gameState.board[i][j] !== 0) return false;
        }
    }
    return true;
}

// 寻找能赢的位置
function findWinningMove(player) {
    for (let i = 0; i < BOARD_SIZE; i++) {
        for (let j = 0; j < BOARD_SIZE; j++) {
            if (gameState.board[i][j] === 0 && hasNeighbor(i, j)) {
                gameState.board[i][j] = player;
                if (checkWin(i, j, false)) {
                    gameState.board[i][j] = 0;
                    return { row: i, col: j };
                }
                gameState.board[i][j] = 0;
            }
        }
    }
    return null;
}

// 寻找关键位置（双活三、活三+冲四等）
function findCriticalMove(player) {
    for (let i = 0; i < BOARD_SIZE; i++) {
        for (let j = 0; j < BOARD_SIZE; j++) {
            if (gameState.board[i][j] === 0 && hasNeighbor(i, j)) {
                gameState.board[i][j] = player;
                const patterns = analyzePatterns(i, j, player);
                gameState.board[i][j] = 0;

                // 双活三或活三+冲四
                if (patterns.aliveFour >= 1 ||
                    patterns.aliveThree >= 2 ||
                    (patterns.aliveThree >= 1 && patterns.deadFour >= 1)) {
                    return { row: i, col: j };
                }
            }
        }
    }
    return null;
}

// 寻找必胜组合
function findWinningCombo(player) {
    let bestMove = null;
    let maxThreats = 0;

    for (let i = 0; i < BOARD_SIZE; i++) {
        for (let j = 0; j < BOARD_SIZE; j++) {
            if (gameState.board[i][j] === 0 && hasNeighbor(i, j)) {
                gameState.board[i][j] = player;
                const patterns = analyzePatterns(i, j, player);
                const threats = patterns.aliveFour + patterns.aliveThree * 0.5 + patterns.deadFour * 0.3;
                gameState.board[i][j] = 0;

                if (threats > maxThreats) {
                    maxThreats = threats;
                    bestMove = { row: i, col: j };
                }
            }
        }
    }

    return maxThreats >= 1.5 ? bestMove : null;
}

// 寻找活三
function findAliveThree(player) {
    for (let i = 0; i < BOARD_SIZE; i++) {
        for (let j = 0; j < BOARD_SIZE; j++) {
            if (gameState.board[i][j] === 0 && hasNeighbor(i, j)) {
                gameState.board[i][j] = player;
                const patterns = analyzePatterns(i, j, player);
                gameState.board[i][j] = 0;

                if (patterns.aliveThree >= 1) {
                    return { row: i, col: j };
                }
            }
        }
    }
    return null;
}

// VCF搜索 - 连续冲四必胜
function findVCF(player, maxDepth) {
    if (maxDepth <= 0) return null;

    // 查找所有能形成冲四或活四的位置
    const threats = [];
    for (let i = 0; i < BOARD_SIZE; i++) {
        for (let j = 0; j < BOARD_SIZE; j++) {
            if (gameState.board[i][j] === 0 && hasNeighbor(i, j)) {
                gameState.board[i][j] = player;
                const patterns = analyzePatterns(i, j, player);
                gameState.board[i][j] = 0;

                if (patterns.aliveFour >= 1 || patterns.deadFour >= 1) {
                    threats.push({ row: i, col: j, patterns });
                }
            }
        }
    }

    // 尝试每个威胁位置
    for (const threat of threats) {
        gameState.board[threat.row][threat.col] = player;

        // 如果赢了，返回这个位置
        if (checkWin(threat.row, threat.col, false)) {
            gameState.board[threat.row][threat.col] = 0;
            return threat;
        }

        // 找对手的所有防守点
        const defenses = findDefenseMoves(player);

        // 如果对手只有一个防守点，继续VCF搜索
        if (defenses.length === 1) {
            gameState.board[defenses[0].row][defenses[0].col] = 3 - player;
            const nextVcf = findVCF(player, maxDepth - 1);
            gameState.board[defenses[0].row][defenses[0].col] = 0;

            if (nextVcf) {
                gameState.board[threat.row][threat.col] = 0;
                return threat;
            }
        } else if (defenses.length === 0) {
            // 没有防守点，已经必胜
            gameState.board[threat.row][threat.col] = 0;
            return threat;
        }

        gameState.board[threat.row][threat.col] = 0;
    }

    return null;
}

// 查找防守位置
function findDefenseMoves(attacker) {
    const defender = 3 - attacker;
    const defenses = [];

    for (let i = 0; i < BOARD_SIZE; i++) {
        for (let j = 0; j < BOARD_SIZE; j++) {
            if (gameState.board[i][j] === 0) {
                gameState.board[i][j] = defender;

                // 如果这个位置能挡住必胜威胁
                let canDefend = true;
                for (let ii = 0; ii < BOARD_SIZE; ii++) {
                    for (let jj = 0; jj < BOARD_SIZE; jj++) {
                        if (gameState.board[ii][jj] === attacker) {
                            if (checkWin(ii, jj, false)) {
                                canDefend = false;
                                break;
                            }
                        }
                    }
                    if (!canDefend) break;
                }

                gameState.board[i][j] = 0;

                if (canDefend && hasNeighbor(i, j)) {
                    defenses.push({ row: i, col: j });
                }
            }
        }
    }

    return defenses;
}

// 查找特定棋型的位置
function findPatternMove(player, patternType) {
    for (let i = 0; i < BOARD_SIZE; i++) {
        for (let j = 0; j < BOARD_SIZE; j++) {
            if (gameState.board[i][j] === 0 && hasNeighbor(i, j)) {
                gameState.board[i][j] = player;
                const patterns = analyzePatterns(i, j, player);
                gameState.board[i][j] = 0;

                if (patternType === 'ALIVE_FOUR' && patterns.aliveFour >= 1) {
                    return { row: i, col: j };
                } else if (patternType === 'DEAD_FOUR' && patterns.deadFour >= 1) {
                    return { row: i, col: j };
                } else if (patternType === 'ALIVE_THREE' && patterns.aliveThree >= 1) {
                    return { row: i, col: j };
                }
            }
        }
    }
    return null;
}

// 查找双冲四
function findDoubleFour(player) {
    for (let i = 0; i < BOARD_SIZE; i++) {
        for (let j = 0; j < BOARD_SIZE; j++) {
            if (gameState.board[i][j] === 0 && hasNeighbor(i, j)) {
                gameState.board[i][j] = player;
                const patterns = analyzePatterns(i, j, player);
                gameState.board[i][j] = 0;

                if (patterns.deadFour >= 2 || (patterns.deadFour >= 1 && patterns.aliveFour >= 1)) {
                    return { row: i, col: j };
                }
            }
        }
    }
    return null;
}

// 分析棋型
function analyzePatterns(row, col, player) {
    const directions = [[1,0], [0,1], [1,1], [1,-1]];
    const patterns = {
        aliveFour: 0,
        deadFour: 0,
        aliveThree: 0,
        deadThree: 0,
        aliveTwo: 0
    };

    for (const [dx, dy] of directions) {
        const line = getLine(row, col, dx, dy, player);
        const pattern = evaluateLine(line);

        if (pattern.type === 'ALIVE_FOUR') patterns.aliveFour++;
        else if (pattern.type === 'DEAD_FOUR') patterns.deadFour++;
        else if (pattern.type === 'ALIVE_THREE') patterns.aliveThree++;
        else if (pattern.type === 'DEAD_THREE') patterns.deadThree++;
        else if (pattern.type === 'ALIVE_TWO') patterns.aliveTwo++;
    }

    return patterns;
}

// 获取一条线上的棋子情况
function getLine(row, col, dx, dy, player) {
    const line = [];

    // 向后看4个位置
    for (let i = -4; i <= 4; i++) {
        const r = row + i * dx;
        const c = col + i * dy;

        if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) {
            line.push(-1); // 边界
        } else if (gameState.board[r][c] === player) {
            line.push(1);  // 己方棋子
        } else if (gameState.board[r][c] === 0) {
            line.push(0);  // 空位
        } else {
            line.push(-1); // 对方棋子
        }
    }

    return line;
}

// 棋型模式查找表（预编译，避免运行时字符串操作）
const PATTERN_TABLE = {
    // 活四
    '011110': { type: 'ALIVE_FOUR', score: SCORE.ALIVE_FOUR },

    // 冲四
    '11110': { type: 'DEAD_FOUR', score: SCORE.DEAD_FOUR },
    '01111': { type: 'DEAD_FOUR', score: SCORE.DEAD_FOUR },
    '11011': { type: 'DEAD_FOUR', score: SCORE.DEAD_FOUR },
    '10111': { type: 'DEAD_FOUR', score: SCORE.DEAD_FOUR },
    '11101': { type: 'DEAD_FOUR', score: SCORE.DEAD_FOUR },

    // 活三
    '001110': { type: 'ALIVE_THREE', score: SCORE.ALIVE_THREE },
    '011100': { type: 'ALIVE_THREE', score: SCORE.ALIVE_THREE },
    '011010': { type: 'ALIVE_THREE', score: SCORE.ALIVE_THREE },
    '010110': { type: 'ALIVE_THREE', score: SCORE.ALIVE_THREE },

    // 眠三
    '001112': { type: 'DEAD_THREE', score: SCORE.DEAD_THREE },
    '211100': { type: 'DEAD_THREE', score: SCORE.DEAD_THREE },
    '010112': { type: 'DEAD_THREE', score: SCORE.DEAD_THREE },
    '211010': { type: 'DEAD_THREE', score: SCORE.DEAD_THREE },
    '011012': { type: 'DEAD_THREE', score: SCORE.DEAD_THREE },
    '210110': { type: 'DEAD_THREE', score: SCORE.DEAD_THREE },
    '10011': { type: 'DEAD_THREE', score: SCORE.DEAD_THREE },
    '11001': { type: 'DEAD_THREE', score: SCORE.DEAD_THREE },
    '10101': { type: 'DEAD_THREE', score: SCORE.DEAD_THREE },

    // 活二
    '001100': { type: 'ALIVE_TWO', score: SCORE.ALIVE_TWO },
    '0011000': { type: 'ALIVE_TWO', score: SCORE.ALIVE_TWO },
    '001010': { type: 'ALIVE_TWO', score: SCORE.ALIVE_TWO },
    '010100': { type: 'ALIVE_TWO', score: SCORE.ALIVE_TWO },
    '000110': { type: 'ALIVE_TWO', score: SCORE.ALIVE_TWO },
    '011000': { type: 'ALIVE_TWO', score: SCORE.ALIVE_TWO },

    // 眠二
    '00110': { type: 'DEAD_TWO', score: SCORE.DEAD_TWO },
    '01100': { type: 'DEAD_TWO', score: SCORE.DEAD_TWO },
    '010010': { type: 'DEAD_TWO', score: SCORE.DEAD_TWO },
    '01001': { type: 'DEAD_TWO', score: SCORE.DEAD_TWO }
};

// 缓存棋型识别结果
const lineCache = new Map();

// 评估一条线的棋型（优化版：使用查找表）
function evaluateLine(line) {
    // 生成缓存key
    const cacheKey = line.join('');
    if (lineCache.has(cacheKey)) {
        return lineCache.get(cacheKey);
    }

    let result = { type: 'NONE', score: 0 };
    let maxScore = 0;

    // 使用滑动窗口检查所有可能的模式
    const lineStr = cacheKey;
    const len = lineStr.length;

    // 检查长度为5-7的所有子串
    for (let start = 0; start < len; start++) {
        for (let windowSize = 5; windowSize <= Math.min(7, len - start); windowSize++) {
            const substr = lineStr.substr(start, windowSize);
            const pattern = PATTERN_TABLE[substr];

            if (pattern && pattern.score > maxScore) {
                maxScore = pattern.score;
                result = pattern;

                // 如果找到活四或更高级别，直接返回
                if (pattern.type === 'ALIVE_FOUR') {
                    lineCache.set(cacheKey, result);
                    // 限制缓存大小
                    if (lineCache.size > 10000) {
                        const firstKey = lineCache.keys().next().value;
                        lineCache.delete(firstKey);
                    }
                    return result;
                }
            }
        }
    }

    // 如果没找到特殊模式，检查是否有棋子
    if (result.type === 'NONE' && lineStr.includes('1')) {
        result = { type: 'ONE', score: SCORE.ONE };
    }

    // 缓存结果
    lineCache.set(cacheKey, result);
    if (lineCache.size > 10000) {
        const firstKey = lineCache.keys().next().value;
        lineCache.delete(firstKey);
    }

    return result;
}

// 使用评分系统找最佳位置
function findBestMoveWithScore(player, searchDepth = 0) {
    let bestScore = -Infinity;
    let bestMove = null;
    const candidates = [];

    // 收集候选位置
    for (let i = 0; i < BOARD_SIZE; i++) {
        for (let j = 0; j < BOARD_SIZE; j++) {
            if (gameState.board[i][j] === 0 && (hasNeighbor(i, j, 2) || isEmpty())) {
                candidates.push({ row: i, col: j });
            }
        }
    }

    if (searchDepth > 0 && candidates.length > 0) {
        // 带搜索的评估
        for (const pos of candidates) {
            gameState.board[pos.row][pos.col] = player;
            const score = minimax(searchDepth, -Infinity, Infinity, false);
            gameState.board[pos.row][pos.col] = 0;

            if (score > bestScore) {
                bestScore = score;
                bestMove = pos;
            }
        }
    } else {
        // 简单评估
        for (const pos of candidates) {
            const score = evaluateMove(pos.row, pos.col, player) +
                         evaluateMove(pos.row, pos.col, 3 - player) * 1.2;
            if (score > bestScore) {
                bestScore = score;
                bestMove = pos;
            }
        }
    }

    return bestMove;
}

// 深度搜索找最佳位置
function findBestMoveWithDeepSearch() {
    let bestScore = -Infinity;
    let bestMove = null;
    const candidates = [];

    // 收集候选位置（限制范围提高效率）
    for (let i = 0; i < BOARD_SIZE; i++) {
        for (let j = 0; j < BOARD_SIZE; j++) {
            if (gameState.board[i][j] === 0 && (hasNeighbor(i, j, 2) || isEmpty())) {
                const aiScore = evaluateMove(i, j, 2);
                const playerScore = evaluateMove(i, j, 1);
                const quickScore = aiScore + playerScore * 1.2;
                candidates.push({ row: i, col: j, score: quickScore });
            }
        }
    }

    // 只评估分数最高的前20个位置
    candidates.sort((a, b) => b.score - a.score);
    const topCandidates = candidates.slice(0, Math.min(20, candidates.length));

    // 使用更深的搜索深度
    const searchDepth = candidates.length < 10 ? 4 : 3;

    for (const pos of topCandidates) {
        gameState.board[pos.row][pos.col] = 2;
        const score = minimax(searchDepth, -Infinity, Infinity, false);
        gameState.board[pos.row][pos.col] = 0;

        if (score > bestScore) {
            bestScore = score;
            bestMove = pos;
        }
    }

    return bestMove || (candidates.length > 0 ? candidates[0] : null);
}

// Minimax算法（带alpha-beta剪枝）
function minimax(depth, alpha, beta, isMaximizing) {
    if (depth === 0) {
        return evaluateBoard();
    }

    const player = isMaximizing ? 2 : 1;
    const candidates = [];

    // 收集候选位置并评分
    for (let i = 0; i < BOARD_SIZE; i++) {
        for (let j = 0; j < BOARD_SIZE; j++) {
            if (gameState.board[i][j] === 0 && hasNeighbor(i, j, 2)) {
                const score = evaluateMove(i, j, player) + evaluateMove(i, j, 3 - player);
                candidates.push({ row: i, col: j, score });
            }
        }
    }

    // 限制搜索宽度，按评分排序
    candidates.sort((a, b) => b.score - a.score);
    const maxCandidates = depth >= 3 ? 8 : 12;
    const topCandidates = candidates.slice(0, Math.min(maxCandidates, candidates.length));

    if (isMaximizing) {
        let maxScore = -Infinity;
        for (const pos of topCandidates) {
            gameState.board[pos.row][pos.col] = 2;

            // 检查是否直接获胜
            if (checkWin(pos.row, pos.col, false)) {
                gameState.board[pos.row][pos.col] = 0;
                return SCORE.FIVE - (4 - depth) * 100; // 优先更短路径的胜利
            }

            // 检查是否形成必胜威胁
            const patterns = analyzePatterns(pos.row, pos.col, 2);
            if (patterns.aliveFour >= 1) {
                gameState.board[pos.row][pos.col] = 0;
                return SCORE.ALIVE_FOUR - (4 - depth) * 100;
            }

            const score = minimax(depth - 1, alpha, beta, false);
            gameState.board[pos.row][pos.col] = 0;

            maxScore = Math.max(maxScore, score);
            alpha = Math.max(alpha, score);
            if (beta <= alpha) break; // Beta剪枝
        }
        return maxScore === -Infinity ? 0 : maxScore;
    } else {
        let minScore = Infinity;
        for (const pos of topCandidates) {
            gameState.board[pos.row][pos.col] = 1;

            // 检查是否直接失败
            if (checkWin(pos.row, pos.col, false)) {
                gameState.board[pos.row][pos.col] = 0;
                return -SCORE.FIVE + (4 - depth) * 100;
            }

            // 检查是否形成必胜威胁
            const patterns = analyzePatterns(pos.row, pos.col, 1);
            if (patterns.aliveFour >= 1) {
                gameState.board[pos.row][pos.col] = 0;
                return -SCORE.ALIVE_FOUR + (4 - depth) * 100;
            }

            const score = minimax(depth - 1, alpha, beta, true);
            gameState.board[pos.row][pos.col] = 0;

            minScore = Math.min(minScore, score);
            beta = Math.min(beta, score);
            if (beta <= alpha) break; // Alpha剪枝
        }
        return minScore === Infinity ? 0 : minScore;
    }
}

// 评估整个棋盘
function evaluateBoard() {
    let aiScore = 0;
    let playerScore = 0;

    // 评估所有已下的棋子
    for (let i = 0; i < BOARD_SIZE; i++) {
        for (let j = 0; j < BOARD_SIZE; j++) {
            if (gameState.board[i][j] === 2) {
                aiScore += evaluateMove(i, j, 2);
            } else if (gameState.board[i][j] === 1) {
                playerScore += evaluateMove(i, j, 1);
            }
        }
    }

    // 稍微重视防守
    return aiScore - playerScore * 1.15;
}

// 评估单个位置的分数（带缓存）
function evaluateMove(row, col, player) {
    // 检查缓存
    const cacheKey = `${row},${col},${player},${gameState.currentHash}`;
    if (gameState.evalCache.has(cacheKey)) {
        return gameState.evalCache.get(cacheKey);
    }

    const original = gameState.board[row][col];
    gameState.board[row][col] = player;

    const directions = [[1,0], [0,1], [1,1], [1,-1]];
    let totalScore = 0;

    for (const [dx, dy] of directions) {
        const line = getLine(row, col, dx, dy, player);
        const pattern = evaluateLine(line);
        totalScore += pattern.score;
    }

    // 添加位置权重
    totalScore += POSITION_WEIGHT[row][col] * 2;

    gameState.board[row][col] = original;

    // 限制缓存大小
    if (gameState.evalCache.size > 50000) {
        const firstKey = gameState.evalCache.keys().next().value;
        gameState.evalCache.delete(firstKey);
    }
    gameState.evalCache.set(cacheKey, totalScore);

    return totalScore;
}

// 迭代加深搜索（带渴望窗口）
function iterativeDeepeningSearch(maxDepth, timeLimit, progressCallback) {
    const startTime = Date.now();
    let bestMove = null;
    let bestScore = -Infinity;

    // 获取所有候选位置
    const candidates = getCandidateMoves(2);
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];

    // 渴望窗口参数
    const ASPIRATION_WINDOW = 500; // 窗口大小

    // 从深度1开始逐步加深
    for (let depth = 1; depth <= maxDepth; depth++) {
        if (Date.now() - startTime > timeLimit) {
            console.log(`时间限制，停止在深度${depth - 1}`);
            break;
        }

        let currentBestMove = null;
        let currentBestScore = -Infinity;
        let alpha = -Infinity;
        let beta = Infinity;

        // 从深度2开始使用渴望窗口
        if (depth >= 2 && bestScore > -Infinity && bestScore < Infinity) {
            alpha = bestScore - ASPIRATION_WINDOW;
            beta = bestScore + ASPIRATION_WINDOW;
        }

        let aspirationFailed = false;

        // 对每个候选位置进行搜索
        for (const move of candidates) {
            gameState.board[move.row][move.col] = 2;
            updateHash(move.row, move.col, 2);

            let score = alphaBetaWithCache(depth - 1, alpha, beta, false, startTime, timeLimit);

            // 如果超出窗口，重新搜索
            if (score <= alpha || score >= beta) {
                aspirationFailed = true;
                // 用完整窗口重新搜索
                score = alphaBetaWithCache(depth - 1, -Infinity, Infinity, false, startTime, timeLimit);
            }

            updateHash(move.row, move.col, 2);
            gameState.board[move.row][move.col] = 0;

            if (score > currentBestScore) {
                currentBestScore = score;
                currentBestMove = move;

                // 动态调整窗口
                if (aspirationFailed) {
                    alpha = score - ASPIRATION_WINDOW;
                    beta = score + ASPIRATION_WINDOW;
                }
            }

            // 时间检查
            if (Date.now() - startTime > timeLimit) break;
        }

        // 更新最佳移动
        if (currentBestMove) {
            bestMove = currentBestMove;
            bestScore = currentBestScore;
            console.log(`深度${depth}: 分数=${bestScore}, 位置=(${bestMove.row},${bestMove.col}), 节点=${gameState.searchNodes}`);

            // 更新进度
            if (progressCallback) {
                progressCallback(depth, maxDepth, bestScore);
            }

            // 将最佳移动移到candidates前面，下一层优先搜索
            const bestIndex = candidates.findIndex(m => m.row === bestMove.row && m.col === bestMove.col);
            if (bestIndex > 0) {
                candidates.splice(0, 0, candidates.splice(bestIndex, 1)[0]);
            }
        }

        // 如果找到必胜，不需要继续搜索
        if (bestScore >= SCORE.FIVE - 1000) {
            console.log('找到必胜路径，停止搜索');
            break;
        }
    }

    return bestMove;
}

// 静态搜索 - 只搜索战术性移动，避免地平线效应
function quiescenceSearch(alpha, beta, isMaximizing, startTime, timeLimit, maxQDepth) {
    gameState.searchNodes++;

    // 时间和深度检查
    if (maxQDepth <= 0 || (gameState.searchNodes % 1000 === 0 && Date.now() - startTime > timeLimit)) {
        return evaluateBoard();
    }

    const standPat = evaluateBoard();

    // 站立评估（不下子的评估）
    if (isMaximizing) {
        if (standPat >= beta) return beta;
        if (standPat > alpha) alpha = standPat;
    } else {
        if (standPat <= alpha) return alpha;
        if (standPat < beta) beta = standPat;
    }

    // 只搜索威胁移动（活三及以上）
    const player = isMaximizing ? 2 : 1;
    const tacticalMoves = [];

    for (let i = 0; i < BOARD_SIZE; i++) {
        for (let j = 0; j < BOARD_SIZE; j++) {
            if (gameState.board[i][j] === 0 && hasNeighbor(i, j, 2)) {
                gameState.board[i][j] = player;
                const patterns = analyzePatterns(i, j, player);
                gameState.board[i][j] = 0;

                // 只考虑强威胁
                if (patterns.aliveFour >= 1 || patterns.deadFour >= 1 || patterns.aliveThree >= 1) {
                    const score = evaluateMove(i, j, player);
                    tacticalMoves.push({ row: i, col: j, score: score });
                }
            }
        }
    }

    // 如果没有战术移动，返回站立评估
    if (tacticalMoves.length === 0) {
        return standPat;
    }

    // 按分数排序
    tacticalMoves.sort((a, b) => b.score - a.score);

    // 只搜索前5个最佳战术移动
    const topMoves = tacticalMoves.slice(0, 5);

    for (const move of topMoves) {
        gameState.board[move.row][move.col] = player;
        updateHash(move.row, move.col, player);

        // 检查是否立即获胜
        if (checkWin(move.row, move.col, false)) {
            updateHash(move.row, move.col, player);
            gameState.board[move.row][move.col] = 0;
            return isMaximizing ? SCORE.FIVE : -SCORE.FIVE;
        }

        const score = quiescenceSearch(alpha, beta, !isMaximizing, startTime, timeLimit, maxQDepth - 1);

        updateHash(move.row, move.col, player);
        gameState.board[move.row][move.col] = 0;

        if (isMaximizing) {
            if (score >= beta) return beta;
            if (score > alpha) alpha = score;
        } else {
            if (score <= alpha) return alpha;
            if (score < beta) beta = score;
        }
    }

    return isMaximizing ? alpha : beta;
}

// 带置换表的Alpha-Beta搜索
function alphaBetaWithCache(depth, alpha, beta, isMaximizing, startTime, timeLimit) {
    gameState.searchNodes++;

    // 时间检查
    if (gameState.searchNodes % 1000 === 0 && Date.now() - startTime > timeLimit) {
        return 0;
    }

    // 检查置换表
    const boardHash = getBoardHash();
    const cached = gameState.transpositionTable.get(boardHash);
    if (cached && cached.depth >= depth) {
        if (cached.flag === 'EXACT') return cached.score;
        if (cached.flag === 'LOWER' && cached.score > alpha) alpha = cached.score;
        if (cached.flag === 'UPPER' && cached.score < beta) beta = cached.score;
        if (alpha >= beta) return cached.score;
    }

    // 终止条件 - 使用静态搜索
    if (depth === 0) {
        return quiescenceSearch(alpha, beta, isMaximizing, startTime, timeLimit, 3);
    }

    const player = isMaximizing ? 2 : 1;

    // 获取候选移动
    const candidates = getCandidateMoves(player);
    if (candidates.length === 0) {
        return evaluateBoard();
    }

    // 移动排序（使用历史启发和杀手移动）
    sortMoves(candidates, depth, player);

    let bestScore = isMaximizing ? -Infinity : Infinity;
    let bestMove = null;
    let flag = 'UPPER';

    for (let i = 0; i < candidates.length; i++) {
        const move = candidates[i];
        gameState.board[move.row][move.col] = player;
        updateHash(move.row, move.col, player); // 增量更新哈希

        // 立即获胜检测（搜索时不保存获胜线）
        if (checkWin(move.row, move.col, false)) {
            updateHash(move.row, move.col, player); // 恢复哈希
            gameState.board[move.row][move.col] = 0;
            const score = isMaximizing ? SCORE.FIVE - depth : -SCORE.FIVE + depth;
            // 记录PV移动
            gameState.pvTable.set(boardHash, move);
            storeInTranspositionTable(boardHash, depth, score, 'EXACT');
            return score;
        }

        let score;
        let needFullSearch = true;

        // PVS + LMR优化
        if (i === 0) {
            // 第一个移动：完整窗口，完整深度
            score = alphaBetaWithCache(depth - 1, alpha, beta, !isMaximizing, startTime, timeLimit);
            needFullSearch = false;
        } else {
            // 延迟移动缩减（LMR）
            // 条件：深度>=3，不是前3个移动，不是威胁移动
            let reduction = 0;
            if (depth >= 3 && i >= 3 && move.priority < 20000) {
                // 根据移动顺序和深度计算缩减量
                reduction = 1;
                if (i >= 6 && depth >= 5) reduction = 2;
                if (i >= 10 && depth >= 7) reduction = 3;
            }

            if (reduction > 0) {
                // 先用缩减深度的空窗口搜索
                const reducedDepth = Math.max(1, depth - 1 - reduction);
                const nullWindow = isMaximizing ? alpha + 1 : beta - 1;
                score = alphaBetaWithCache(reducedDepth, nullWindow - 1, nullWindow, !isMaximizing, startTime, timeLimit);

                // 如果缩减搜索表明这个移动可能更好，需要完整搜索
                needFullSearch = (isMaximizing && score > alpha) || (!isMaximizing && score < beta);
            }

            if (needFullSearch) {
                // 空窗口搜索（完整深度）
                const nullWindow = isMaximizing ? alpha + 1 : beta - 1;
                score = alphaBetaWithCache(depth - 1, nullWindow - 1, nullWindow, !isMaximizing, startTime, timeLimit);

                // 如果空窗口搜索失败，需要重新搜索
                if ((isMaximizing && score > alpha && score < beta) ||
                    (!isMaximizing && score > alpha && score < beta)) {
                    score = alphaBetaWithCache(depth - 1, alpha, beta, !isMaximizing, startTime, timeLimit);
                }
            }
        }

        updateHash(move.row, move.col, player); // 恢复哈希
        gameState.board[move.row][move.col] = 0;

        if (isMaximizing) {
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
                if (score > alpha) {
                    alpha = score;
                    flag = 'EXACT';
                }
            }
        } else {
            if (score < bestScore) {
                bestScore = score;
                bestMove = move;
                if (score < beta) {
                    beta = score;
                    flag = 'EXACT';
                }
            }
        }

        // Alpha-Beta剪枝
        if (alpha >= beta) {
            // 记录杀手移动
            recordKillerMove(move, depth);
            // 更新历史表
            updateHistoryTable(move, depth);
            flag = isMaximizing ? 'LOWER' : 'UPPER';
            break;
        }
    }

    // 记录PV移动
    if (bestMove) {
        gameState.pvTable.set(boardHash, bestMove);
        // 限制PV表大小
        if (gameState.pvTable.size > 50000) {
            const firstKey = gameState.pvTable.keys().next().value;
            gameState.pvTable.delete(firstKey);
        }
    }

    // 存储到置换表
    storeInTranspositionTable(boardHash, depth, bestScore, flag);

    return bestScore;
}

// 获取威胁移动（只考虑威胁和防守）
function getThreatMoves(player) {
    const threats = [];
    const opponent = 3 - player;

    for (let i = 0; i < BOARD_SIZE; i++) {
        for (let j = 0; j < BOARD_SIZE; j++) {
            if (gameState.board[i][j] === 0 && hasNeighbor(i, j, 2)) {
                // 检查自己的威胁
                gameState.board[i][j] = player;
                const myPatterns = analyzePatterns(i, j, player);
                gameState.board[i][j] = 0;

                // 检查对手的威胁
                gameState.board[i][j] = opponent;
                const oppPatterns = analyzePatterns(i, j, opponent);
                gameState.board[i][j] = 0;

                // 只保留有威胁的位置
                if (myPatterns.aliveFour >= 1 || myPatterns.deadFour >= 1 || myPatterns.aliveThree >= 1 ||
                    oppPatterns.aliveFour >= 1 || oppPatterns.deadFour >= 1 || oppPatterns.aliveThree >= 1) {
                    const myScore = evaluateMove(i, j, player);
                    const oppScore = evaluateMove(i, j, opponent);
                    threats.push({ row: i, col: j, score: myScore + oppScore * 1.1 });
                }
            }
        }
    }

    threats.sort((a, b) => b.score - a.score);
    return threats;
}

// 获取候选移动（智能筛选 + 威胁空间搜索）
function getCandidateMoves(player) {
    const opponent = 3 - player;

    // 第一步，下中心
    if (isEmpty()) {
        const center = Math.floor(BOARD_SIZE / 2);
        return [{ row: center, col: center, score: 0 }];
    }

    // 先尝试威胁空间搜索
    const threats = getThreatMoves(player);
    if (threats.length > 0 && threats.length <= 15) {
        // 如果威胁移动数量合理，只使用威胁移动
        return threats;
    }

    // 否则收集所有可能的位置
    const candidates = [];
    for (let i = 0; i < BOARD_SIZE; i++) {
        for (let j = 0; j < BOARD_SIZE; j++) {
            if (gameState.board[i][j] === 0 && hasNeighbor(i, j, 2)) {
                // 快速评估
                const myScore = evaluateMove(i, j, player);
                const oppScore = evaluateMove(i, j, opponent);
                const totalScore = myScore + oppScore * 1.1;

                candidates.push({ row: i, col: j, score: totalScore });
            }
        }
    }

    // 按分数排序，只保留前面的候选
    candidates.sort((a, b) => b.score - a.score);

    // 根据棋局阶段和难度决定候选数量
    const pieceCount = countPieces();
    let maxCandidates;
    if (pieceCount < 6) {
        maxCandidates = 10;
    } else if (pieceCount < 12) {
        maxCandidates = 15;
    } else if (pieceCount < 20) {
        maxCandidates = 20;
    } else {
        maxCandidates = 25; // 高级AI支持更多候选
    }

    return candidates.slice(0, Math.min(maxCandidates, candidates.length));
}

// VCT搜索 - 连续活三必胜
function findVCT(player, maxDepth) {
    if (maxDepth <= 0) return null;

    // 查找所有能形成活三的位置
    const threats = [];
    for (let i = 0; i < BOARD_SIZE; i++) {
        for (let j = 0; j < BOARD_SIZE; j++) {
            if (gameState.board[i][j] === 0 && hasNeighbor(i, j)) {
                gameState.board[i][j] = player;
                const patterns = analyzePatterns(i, j, player);
                gameState.board[i][j] = 0;

                if (patterns.aliveThree >= 1) {
                    threats.push({ row: i, col: j, patterns });
                }
            }
        }
    }

    // 尝试每个威胁位置
    for (const threat of threats) {
        gameState.board[threat.row][threat.col] = player;

        // 检查是否形成了更强的威胁
        const newPatterns = analyzePatterns(threat.row, threat.col, player);
        if (newPatterns.aliveFour >= 1 || newPatterns.deadFour >= 2) {
            gameState.board[threat.row][threat.col] = 0;
            return threat;
        }

        // 找对手的所有防守点
        const defenses = findDefenseMovesForVCT(player);

        // 如果对手只有少数防守点，继续VCT搜索
        if (defenses.length <= 2) {
            let foundVCT = false;
            for (const defense of defenses) {
                gameState.board[defense.row][defense.col] = 3 - player;
                const nextVct = findVCT(player, maxDepth - 1);
                gameState.board[defense.row][defense.col] = 0;

                if (nextVct) {
                    foundVCT = true;
                    break;
                }
            }

            if (foundVCT || defenses.length === 0) {
                gameState.board[threat.row][threat.col] = 0;
                return threat;
            }
        }

        gameState.board[threat.row][threat.col] = 0;
    }

    return null;
}

// 查找VCT的防守位置
function findDefenseMovesForVCT(attacker) {
    const defender = 3 - attacker;
    const defenses = [];

    for (let i = 0; i < BOARD_SIZE; i++) {
        for (let j = 0; j < BOARD_SIZE; j++) {
            if (gameState.board[i][j] === 0 && hasNeighbor(i, j)) {
                gameState.board[i][j] = defender;

                // 检查是否能挡住活三威胁
                let threatLevel = 0;
                for (let ii = 0; ii < BOARD_SIZE; ii++) {
                    for (let jj = 0; jj < BOARD_SIZE; jj++) {
                        if (gameState.board[ii][jj] === attacker) {
                            const patterns = analyzePatterns(ii, jj, attacker);
                            if (patterns.aliveFour >= 1) threatLevel += 10;
                            if (patterns.deadFour >= 2) threatLevel += 8;
                            if (patterns.aliveThree >= 2) threatLevel += 5;
                        }
                    }
                }

                gameState.board[i][j] = 0;

                if (threatLevel < 5) {
                    defenses.push({ row: i, col: j });
                }
            }
        }
    }

    return defenses.slice(0, 5); // 最多返回5个防守点
}

// 显示AI思考提示
function showAIThinking(difficulty) {
    const modal = document.getElementById('aiThinkingModal');
    const text = document.getElementById('aiThinkingText');
    text.textContent = `${difficulty}AI思考中...`;
    modal.classList.remove('hidden');
}

// 隐藏AI思考提示
function hideAIThinking() {
    const modal = document.getElementById('aiThinkingModal');
    modal.classList.add('hidden');
}

// 更新AI思考进度
function updateAIThinkingProgress(depth, maxDepth, score) {
    const details = document.getElementById('aiThinkingDetails');
    const percentage = Math.round((depth / maxDepth) * 100);
    details.textContent = `搜索深度: ${depth}/${maxDepth} (${percentage}%)`;
}

// 移动排序（启发式 + PV移动）
function sortMoves(moves, depth, player) {
    const opponent = 3 - player;
    const boardHash = getBoardHash();
    const pvMove = gameState.pvTable.get(boardHash);

    moves.forEach(move => {
        let priority = move.score || 0;

        // PV移动优先级最高
        if (pvMove && pvMove.row === move.row && pvMove.col === move.col) {
            priority += 100000;
        }

        // 检查是否是杀手移动
        if (gameState.killerMoves[depth]) {
            const isKiller = gameState.killerMoves[depth].some(
                km => km && km.row === move.row && km.col === move.col
            );
            if (isKiller) priority += 10000;
        }

        // 历史启发
        const key = `${move.row},${move.col}`;
        if (gameState.historyTable[key]) {
            priority += gameState.historyTable[key];
        }

        // 威胁检测
        gameState.board[move.row][move.col] = player;
        const patterns = analyzePatterns(move.row, move.col, player);
        if (patterns.aliveFour >= 1) priority += 50000;
        if (patterns.deadFour >= 1) priority += 30000;
        if (patterns.aliveThree >= 1) priority += 15000;
        gameState.board[move.row][move.col] = 0;

        move.priority = priority;
    });

    moves.sort((a, b) => b.priority - a.priority);
}

// 记录杀手移动
function recordKillerMove(move, depth) {
    if (!gameState.killerMoves[depth]) {
        gameState.killerMoves[depth] = [];
    }

    // 保持最多2个杀手移动
    gameState.killerMoves[depth].unshift(move);
    if (gameState.killerMoves[depth].length > 2) {
        gameState.killerMoves[depth].pop();
    }
}

// 更新历史表
function updateHistoryTable(move, depth) {
    const key = `${move.row},${move.col}`;
    if (!gameState.historyTable[key]) {
        gameState.historyTable[key] = 0;
    }
    gameState.historyTable[key] += depth * depth;
}

// 获取棋盘哈希（快速Zobrist哈希）
function getBoardHash() {
    return gameState.currentHash;
}

// 增量更新哈希值
function updateHash(row, col, player) {
    if (player === 0) {
        // 不更新空位
        return;
    }
    gameState.currentHash ^= gameState.zobristTable[row][col][player];
}

// 存储到置换表
function storeInTranspositionTable(hash, depth, score, flag) {
    gameState.transpositionTable.set(hash, { depth, score, flag });

    // 限制置换表大小，防止内存溢出
    if (gameState.transpositionTable.size > 100000) {
        const firstKey = gameState.transpositionTable.keys().next().value;
        gameState.transpositionTable.delete(firstKey);
    }
}

// 计算棋盘上的棋子数
function countPieces() {
    let count = 0;
    for (let i = 0; i < BOARD_SIZE; i++) {
        for (let j = 0; j < BOARD_SIZE; j++) {
            if (gameState.board[i][j] !== 0) count++;
        }
    }
    return count;
}

// 检查是否有邻居
function hasNeighbor(row, col, distance = 1) {
    const directions = [[1,0], [-1,0], [0,1], [0,-1], [1,1], [1,-1], [-1,1], [-1,-1]];

    for (let d = 1; d <= distance; d++) {
        for (const [dx, dy] of directions) {
            const r = row + dx * d;
            const c = col + dy * d;
            if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && gameState.board[r][c] !== 0) {
                return true;
            }
        }
    }

    return false;
}

// 检查胜利
function checkWin(row, col, saveWinningLine = true) {
    const player = gameState.board[row][col];
    const directions = [[1,0], [0,1], [1,1], [1,-1]];

    for (const [dx, dy] of directions) {
        const line = [{row, col}]; // 包含当前位置

        // 正方向
        let r = row + dx, c = col + dy;
        while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && gameState.board[r][c] === player) {
            line.push({row: r, col: c});
            r += dx;
            c += dy;
        }

        // 反方向
        r = row - dx;
        c = col - dy;
        while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && gameState.board[r][c] === player) {
            line.unshift({row: r, col: c}); // 添加到开头
            r -= dx;
            c -= dy;
        }

        if (line.length >= 5) {
            // 只在真实游戏中保存获胜线，搜索时不保存
            if (saveWinningLine) {
                // 只保留前5颗棋子
                gameState.winningLine = line.slice(0, 5);
            }
            return true;
        }
    }

    return false;
}

// 检查棋盘是否已满
function isBoardFull() {
    for (let i = 0; i < BOARD_SIZE; i++) {
        for (let j = 0; j < BOARD_SIZE; j++) {
            if (gameState.board[i][j] === 0) {
                return false;
            }
        }
    }
    return true;
}

// 显示游戏结束
function showGameOver(winner) {
    const modal = document.getElementById('gameOverModal');
    const result = document.getElementById('gameResult');

    if (winner === 0) {
        result.textContent = '平局！';
    } else if (winner === 1) {
        result.textContent = '🎉 黑子获胜！';
    } else {
        result.textContent = '🎉 白子获胜！';
    }

    modal.classList.remove('hidden');
}

// 关闭游戏结束对话框（但保持游戏结束状态和动画）
function closeGameOverModal() {
    const modal = document.getElementById('gameOverModal');
    modal.classList.add('hidden');
}

// 重新开始
function restartGame() {
    startGame(gameState.mode === 'pvp' ? 'pvp' : gameState.difficulty);
}

// 悔棋功能
function undoMove() {
    if (gameState.gameOver) return;
    if (gameState.moveHistory.length === 0) return;

    // 停止动画
    stopAnimation();

    // 清空获胜线（如果有）
    gameState.winningLine = [];

    // 人机模式：撤销两步（玩家+AI）
    if (gameState.mode === 'ai') {
        // 至少需要2步才能悔棋
        if (gameState.moveHistory.length < 2) return;

        // 撤销AI的棋
        const aiMove = gameState.moveHistory.pop();
        updateHash(aiMove.row, aiMove.col, aiMove.player); // 更新哈希
        gameState.board[aiMove.row][aiMove.col] = 0;

        // 撤销玩家的棋
        const playerMove = gameState.moveHistory.pop();
        updateHash(playerMove.row, playerMove.col, playerMove.player); // 更新哈希
        gameState.board[playerMove.row][playerMove.col] = 0;

        // 恢复到玩家回合
        gameState.currentPlayer = 1;
    }
    // 双人模式：撤销一步
    else {
        const lastMove = gameState.moveHistory.pop();
        updateHash(lastMove.row, lastMove.col, lastMove.player); // 更新哈希
        gameState.board[lastMove.row][lastMove.col] = 0;

        // 切换回上一个玩家
        gameState.currentPlayer = lastMove.player;
    }

    // 重绘棋盘
    drawBoard();
    updateGameInfo();
    updateUndoButton();
}

// 更新悔棋按钮状态
function updateUndoButton() {
    const undoBtn = document.getElementById('undoBtn');

    if (gameState.gameOver) {
        undoBtn.disabled = true;
        undoBtn.style.opacity = '0.5';
        undoBtn.style.cursor = 'not-allowed';
        return;
    }

    // 人机模式需要至少2步
    if (gameState.mode === 'ai') {
        if (gameState.moveHistory.length < 2) {
            undoBtn.disabled = true;
            undoBtn.style.opacity = '0.5';
            undoBtn.style.cursor = 'not-allowed';
        } else {
            undoBtn.disabled = false;
            undoBtn.style.opacity = '1';
            undoBtn.style.cursor = 'pointer';
        }
    }
    // 双人模式需要至少1步
    else {
        if (gameState.moveHistory.length < 1) {
            undoBtn.disabled = true;
            undoBtn.style.opacity = '0.5';
            undoBtn.style.cursor = 'not-allowed';
        } else {
            undoBtn.disabled = false;
            undoBtn.style.opacity = '1';
            undoBtn.style.cursor = 'pointer';
        }
    }
}

// 返回菜单
function backToMenu() {
    document.getElementById('gameArea').classList.add('hidden');
    document.getElementById('gameOverModal').classList.add('hidden');
    document.getElementById('modeSelection').classList.remove('hidden');
    gameState.mode = null;
    gameState.difficulty = null;
}

// 窗口大小改变时重新初始化画布
window.addEventListener('resize', () => {
    if (!document.getElementById('gameArea').classList.contains('hidden')) {
        initCanvas();
        drawBoard();
    }
});
