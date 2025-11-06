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
    ctx: null
};

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
    // 初始化棋盘
    gameState.board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(0));
    gameState.currentPlayer = 1;
    gameState.gameOver = false;
    gameState.difficulty = difficulty;

    // 隐藏选择界面，显示游戏界面
    document.getElementById('modeSelection').classList.add('hidden');
    document.getElementById('difficultySelection').classList.add('hidden');
    document.getElementById('gameArea').classList.remove('hidden');
    document.getElementById('gameOverModal').classList.add('hidden');

    // 更新游戏信息
    updateGameInfo();

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
    gameState.board[row][col] = gameState.currentPlayer;
    drawBoard();

    // 检查胜负
    if (checkWin(row, col)) {
        gameState.gameOver = true;
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
        setTimeout(aiMove, 500);
    }
}

// AI落子
function aiMove() {
    if (gameState.gameOver) return;

    let move;

    switch (gameState.difficulty) {
        case 'easy':
            move = getEasyMove();
            break;
        case 'medium':
            move = getMediumMove();
            break;
        case 'hard':
            move = getHardMove();
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

// 初级AI - 随机落子（但会避免太蠢的下法）
function getEasyMove() {
    // 如果能赢，直接赢
    const winMove = findWinningMove(2);
    if (winMove) return winMove;

    // 如果对手要赢，必须防守
    const blockMove = findWinningMove(1);
    if (blockMove) return blockMove;

    // 否则在有邻居的位置随机下
    const emptyCells = [];
    for (let i = 0; i < BOARD_SIZE; i++) {
        for (let j = 0; j < BOARD_SIZE; j++) {
            if (gameState.board[i][j] === 0 && (hasNeighbor(i, j) || isEmpty())) {
                emptyCells.push({ row: i, col: j });
            }
        }
    }

    if (emptyCells.length > 0) {
        return emptyCells[Math.floor(Math.random() * emptyCells.length)];
    }

    return null;
}

// 中级AI - 使用评分系统和浅层搜索
function getMediumMove() {
    // 如果能赢，直接赢
    const winMove = findWinningMove(2);
    if (winMove) return winMove;

    // 如果对手要赢，必须防守
    const blockMove = findWinningMove(1);
    if (blockMove) return blockMove;

    // 检查活四
    const aliveFourMove = findPatternMove(2, 'ALIVE_FOUR');
    if (aliveFourMove) return aliveFourMove;

    // 防守对手活四
    const blockAliveFour = findPatternMove(1, 'ALIVE_FOUR');
    if (blockAliveFour) return blockAliveFour;

    // 检查双冲四
    const doubleFour = findDoubleFour(2);
    if (doubleFour) return doubleFour;

    // 防守对手双冲四
    const blockDoubleFour = findDoubleFour(1);
    if (blockDoubleFour) return blockDoubleFour;

    // 检查双活三和活三+冲四的组合
    const criticalMove = findCriticalMove(2);
    if (criticalMove) return criticalMove;

    // 防守对手的双活三
    const blockCritical = findCriticalMove(1);
    if (blockCritical) return blockCritical;

    // 使用评分系统找最佳位置（带浅层搜索）
    return findBestMoveWithScore(2, 1);
}

// 高级AI - 更深的搜索和更强的算法
function getHardMove() {
    // 如果能赢，直接赢
    const winMove = findWinningMove(2);
    if (winMove) return winMove;

    // 如果对手要赢，必须防守
    const blockMove = findWinningMove(1);
    if (blockMove) return blockMove;

    // VCF搜索 - 连续冲四必胜
    const vcfMove = findVCF(2, 8);
    if (vcfMove) return vcfMove;

    // 防守对手的VCF
    const blockVcf = findVCF(1, 6);
    if (blockVcf) {
        // 检查防守点是否安全
        gameState.board[blockVcf.row][blockVcf.col] = 2;
        const counterVcf = findVCF(1, 4);
        gameState.board[blockVcf.row][blockVcf.col] = 0;
        if (!counterVcf) return blockVcf;
    }

    // 检查活四
    const aliveFourMove = findPatternMove(2, 'ALIVE_FOUR');
    if (aliveFourMove) return aliveFourMove;

    // 防守对手活四
    const blockAliveFour = findPatternMove(1, 'ALIVE_FOUR');
    if (blockAliveFour) return blockAliveFour;

    // 检查双冲四
    const doubleFour = findDoubleFour(2);
    if (doubleFour) return doubleFour;

    // 防守对手双冲四
    const blockDoubleFour = findDoubleFour(1);
    if (blockDoubleFour) return blockDoubleFour;

    // 检查是否有必胜组合（双活三、活三+冲四）
    const winningCombo = findWinningCombo(2);
    if (winningCombo) return winningCombo;

    // 防守对手的必胜组合
    const blockCombo = findWinningCombo(1);
    if (blockCombo) return blockCombo;

    // 寻找活三
    const aliveThree = findAliveThree(2);
    if (aliveThree) return aliveThree;

    // 防守对手活三
    const blockAliveThree = findAliveThree(1);
    if (blockAliveThree) return blockAliveThree;

    // 使用深度搜索找最佳位置（增加深度）
    return findBestMoveWithDeepSearch();
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
                if (checkWin(i, j)) {
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
        if (checkWin(threat.row, threat.col)) {
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
                            if (checkWin(ii, jj)) {
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

// 评估一条线的棋型
function evaluateLine(line) {
    const str = line.join('');
    let totalScore = 0;

    // 活四：_XXXX_（两端都是空）
    if (str.includes('011110')) {
        return { type: 'ALIVE_FOUR', score: SCORE.ALIVE_FOUR };
    }

    // 冲四：检测各种冲四形态
    const deadFourPatterns = [
        '11110', '01111',  // 一端封闭
        '11011', '10111', '11101'  // 跳四
    ];
    for (const pattern of deadFourPatterns) {
        if (str.includes(pattern)) {
            return { type: 'DEAD_FOUR', score: SCORE.DEAD_FOUR };
        }
    }

    // 活三：两端都能成活四
    const aliveThreePatterns = [
        '001110', '011100',    // 连续三子两端空
        '011010', '010110'     // 跳活三
    ];
    for (const pattern of aliveThreePatterns) {
        if (str.includes(pattern)) {
            totalScore += SCORE.ALIVE_THREE;
        }
    }
    if (totalScore > 0) return { type: 'ALIVE_THREE', score: totalScore };

    // 眠三：只能在一端形成活四
    const deadThreePatterns = [
        '001112', '211100',    // 一端被堵
        '010112', '211010',
        '011012', '210110',
        '10011', '11001',      // 跳眠三
        '10101', '2011102'
    ];
    for (const pattern of deadThreePatterns) {
        if (str.includes(pattern)) {
            totalScore += SCORE.DEAD_THREE;
        }
    }
    if (totalScore > 0) return { type: 'DEAD_THREE', score: totalScore };

    // 活二：能形成活三
    const aliveTwoPatterns = [
        '001100', '0011000',   // 连续二子
        '001010', '010100',    // 跳二
        '000110', '011000'
    ];
    for (const pattern of aliveTwoPatterns) {
        if (str.includes(pattern)) {
            totalScore += SCORE.ALIVE_TWO;
        }
    }
    if (totalScore > 0) return { type: 'ALIVE_TWO', score: totalScore };

    // 眠二
    if (str.includes('00110') || str.includes('01100') ||
        str.includes('010010') || str.includes('01001')) {
        return { type: 'DEAD_TWO', score: SCORE.DEAD_TWO };
    }

    // 单子
    if (str.includes('1')) {
        return { type: 'ONE', score: SCORE.ONE };
    }

    return { type: 'NONE', score: 0 };
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
            if (checkWin(pos.row, pos.col)) {
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
            if (checkWin(pos.row, pos.col)) {
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

// 评估单个位置的分数
function evaluateMove(row, col, player) {
    const original = gameState.board[row][col];
    gameState.board[row][col] = player;

    const directions = [[1,0], [0,1], [1,1], [1,-1]];
    let totalScore = 0;

    for (const [dx, dy] of directions) {
        const line = getLine(row, col, dx, dy, player);
        const pattern = evaluateLine(line);
        totalScore += pattern.score;
    }

    gameState.board[row][col] = original;
    return totalScore;
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
function checkWin(row, col) {
    const player = gameState.board[row][col];
    const directions = [[1,0], [0,1], [1,1], [1,-1]];

    for (const [dx, dy] of directions) {
        let count = 1;

        // 正方向
        let r = row + dx, c = col + dy;
        while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && gameState.board[r][c] === player) {
            count++;
            r += dx;
            c += dy;
        }

        // 反方向
        r = row - dx;
        c = col - dy;
        while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && gameState.board[r][c] === player) {
            count++;
            r -= dx;
            c -= dy;
        }

        if (count >= 5) {
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

// 重新开始
function restartGame() {
    startGame(gameState.mode === 'pvp' ? 'pvp' : gameState.difficulty);
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
