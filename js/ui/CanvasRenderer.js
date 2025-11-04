/**
 * Canvas渲染器 - 负责游戏画面的视觉渲染
 *
 * 职责：
 * - 绘制棋盘和棋子
 * - 渲染游戏状态和特效
 * - 处理用户交互
 * - 提供动画效果
 */

class CanvasRenderer {
  constructor(eventBus, canvasElement) {
    // 验证依赖
    if (!eventBus) {
      throw new Error('CanvasRenderer requires EventBus instance');
    }
    if (!canvasElement || canvasElement.tagName !== 'CANVAS') {
      throw new Error('CanvasRenderer requires valid canvas element');
    }

    this.eventBus = eventBus;
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.logger = logger.createModuleLogger('CanvasRenderer');

    // 渲染配置
    this.config = {
      boardSize: 15,
      cellSize: 40,
      boardPadding: 20,
      boardMargin: 30,
      pieceRadius: 16,
      lineWidth: 1,
      starPointRadius: 3,
      coordinateSize: 12,
      animationDuration: 300
    };

    // 颜色配置
    this.colors = {
      background: '#f4e4c1',
      boardLine: '#8b4513',
      blackPiece: '#2c3e50',
      whitePiece: '#ecf0f1',
      blackBorder: '#1a252f',
      whiteBorder: '#bdc3c7',
      lastMove: '#e74c3c',
      forbidden: '#c0392b',
      hint: '#3498db',
      coordinate: '#7f8c8d',
      winLine: '#f39c12'
    };

    // 渲染状态
    this.renderState = {
      gameState: null,
      lastMove: null,
      winLine: null,
      hoveredPosition: null,
      forbiddenMoves: new Set(),
      hints: [],
      animations: [],
      coordinateEnabled: true,
      lastMoveEnabled: true
    };

    // 初始化画布
    this._initializeCanvas();

    // 绑定事件处理器
    this._bindEventHandlers();
    this._bindCanvasEvents();

    this.logger.info('CanvasRenderer initialized');
  }

  /**
   * 初始化画布
   * @private
   */
  _initializeCanvas() {
    const { boardSize, cellSize, boardPadding, boardMargin } = this.config;

    // 计算画布尺寸
    const canvasSize = boardPadding * 2 + boardMargin * 2 + cellSize * (boardSize - 1);

    this.canvas.width = canvasSize;
    this.canvas.height = canvasSize;
    this.canvas.style.width = `${canvasSize}px`;
    this.canvas.style.height = `${canvasSize}px`;

    // 设置默认样式
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    this.logger.info('Canvas initialized', { width: canvasSize, height: canvasSize });
  }

  /**
   * 渲染游戏画面
   * @param {Object} gameState - 游戏状态
   * @param {Object} options - 渲染选项
   */
  render(gameState, options = {}) {
    const startTime = performance.now();

    // 更新渲染状态
    this.renderState.gameState = gameState;

    // 清空画布
    this._clearCanvas();

    // 绘制棋盘
    this._drawBoard();

    // 绘制坐标（如果启用）
    if (this.renderState.coordinateEnabled) {
      this._drawCoordinates();
    }

    // 绘制禁手位置
    if (gameState.settings.forbiddenRules && gameState.currentPlayer === 1) {
      this._drawForbiddenMoves(gameState);
    }

    // 绘制提示
    if (this.renderState.hints.length > 0) {
      this._drawHints();
    }

    // 绘制所有棋子
    this._drawPieces(gameState);

    // 绘制最后落子标记
    if (this.renderState.lastMoveEnabled && this.renderState.lastMove) {
      this._drawLastMoveMarker();
    }

    // 绘制悬停效果
    if (this.renderState.hoveredPosition) {
      this._drawHoverEffect();
    }

    // 绘制获胜线
    if (this.renderState.winLine) {
      this._drawWinLine();
    }

    // 处理动画
    this._processAnimations();

    const duration = performance.now() - startTime;
    this.logger.performance('render', startTime);
  }

  /**
   * 设置最后落子位置
   * @param {Object} move - 落子信息
   */
  setLastMove(move) {
    this.renderState.lastMove = move;
    this.renderState.animations.push({
      type: 'pieceDrop',
      position: { x: move.x, y: move.y },
      startTime: performance.now(),
      duration: this.config.animationDuration
    });
  }

  /**
   * 设置获胜线
   * @param {Array} winLine - 获胜线路坐标
   */
  setWinLine(winLine) {
    this.renderState.winLine = winLine;
    this.renderState.animations.push({
      type: 'winLine',
      winLine,
      startTime: performance.now(),
      duration: 800
    });
  }

  /**
   * 设置禁手位置
   * @param {Set} forbiddenMoves - 禁手位置集合
   */
  setForbiddenMoves(forbiddenMoves) {
    this.renderState.forbiddenMoves = forbiddenMoves;
  }

  /**
   * 设置提示位置
   * @param {Array} hints - 提示位置数组
   */
  setHints(hints) {
    this.renderState.hints = hints;
  }

  /**
   * 设置悬停位置
   * @param {Object} position - 悬停位置
   */
  setHoveredPosition(position) {
    this.renderState.hoveredPosition = position;
  }

  /**
   * 清空画布
   * @private
   */
  _clearCanvas() {
    this.ctx.fillStyle = this.colors.background;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * 绘制棋盘
   * @private
   */
  _drawBoard() {
    const { boardSize, cellSize, boardPadding, boardMargin, lineWidth } = this.config;
    const startX = boardPadding + boardMargin;
    const startY = boardPadding + boardMargin;

    this.ctx.strokeStyle = this.colors.boardLine;
    this.ctx.lineWidth = lineWidth;

    // 绘制网格线
    for (let i = 0; i < boardSize; i++) {
      // 横线
      this.ctx.beginPath();
      this.ctx.moveTo(startX, startY + i * cellSize);
      this.ctx.lineTo(startX + (boardSize - 1) * cellSize, startY + i * cellSize);
      this.ctx.stroke();

      // 竖线
      this.ctx.beginPath();
      this.ctx.moveTo(startX + i * cellSize, startY);
      this.ctx.lineTo(startX + i * cellSize, startY + (boardSize - 1) * cellSize);
      this.ctx.stroke();
    }

    // 绘制星位
    this._drawStarPoints();
  }

  /**
   * 绘制星位
   * @private
   */
  _drawStarPoints() {
    const { cellSize, boardPadding, boardMargin, starPointRadius } = this.config;
    const startX = boardPadding + boardMargin;
    const startY = boardPadding + boardMargin;

    // 定义星位位置
    const starPoints = [
      { x: 3, y: 3 }, { x: 11, y: 3 },
      { x: 7, y: 7 },
      { x: 3, y: 11 }, { x: 11, y: 11 }
    ];

    this.ctx.fillStyle = this.colors.boardLine;

    starPoints.forEach(point => {
      const x = startX + point.x * cellSize;
      const y = startY + point.y * cellSize;

      this.ctx.beginPath();
      this.ctx.arc(x, y, starPointRadius, 0, Math.PI * 2);
      this.ctx.fill();
    });
  }

  /**
   * 绘制坐标
   * @private
   */
  _drawCoordinates() {
    const { boardSize, cellSize, boardPadding, boardMargin, coordinateSize } = this.config;
    const startX = boardPadding + boardMargin;
    const startY = boardPadding + boardMargin;

    this.ctx.fillStyle = this.colors.coordinate;
    this.ctx.font = `${coordinateSize}px Arial`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    // 绘制字母坐标（A-O）
    for (let i = 0; i < boardSize; i++) {
      const letter = String.fromCharCode(65 + i); // A-O
      const x = startX + i * cellSize;

      // 顶部
      this.ctx.fillText(letter, x, startY - 15);
      // 底部
      this.ctx.fillText(letter, x, startY + (boardSize - 1) * cellSize + 15);
    }

    // 绘制数字坐标（1-15）
    for (let i = 0; i < boardSize; i++) {
      const number = (i + 1).toString();
      const y = startY + i * cellSize;

      // 左侧
      this.ctx.fillText(number, startX - 15, y);
      // 右侧
      this.ctx.fillText(number, startX + (boardSize - 1) * cellSize + 15, y);
    }
  }

  /**
   * 绘制禁手位置
   * @private
   */
  _drawForbiddenMoves(gameState) {
    const { cellSize, boardPadding, boardMargin, pieceRadius } = this.config;
    const startX = boardPadding + boardMargin;
    const startY = boardPadding + boardMargin;

    this.ctx.strokeStyle = this.colors.forbidden;
    this.ctx.lineWidth = 2;

    this.renderState.forbiddenMoves.forEach(moveKey => {
      const [x, y] = moveKey.split(',').map(Number);
      const pixelX = startX + x * cellSize;
      const pixelY = startY + y * cellSize;

      // 绘制X标记
      const offset = pieceRadius * 0.6;
      this.ctx.beginPath();
      this.ctx.moveTo(pixelX - offset, pixelY - offset);
      this.ctx.lineTo(pixelX + offset, pixelY + offset);
      this.ctx.moveTo(pixelX + offset, pixelY - offset);
      this.ctx.lineTo(pixelX - offset, pixelY + offset);
      this.ctx.stroke();
    });
  }

  /**
   * 绘制提示
   * @private
   */
  _drawHints() {
    const { cellSize, boardPadding, boardMargin, pieceRadius } = this.config;
    const startX = boardPadding + boardMargin;
    const startY = boardPadding + boardMargin;

    this.ctx.fillStyle = this.colors.hint;
    this.ctx.globalAlpha = 0.3;

    this.renderState.hints.forEach(hint => {
      const pixelX = startX + hint.x * cellSize;
      const pixelY = startY + hint.y * cellSize;

      this.ctx.beginPath();
      this.ctx.arc(pixelX, pixelY, pieceRadius * 0.8, 0, Math.PI * 2);
      this.ctx.fill();
    });

    this.ctx.globalAlpha = 1.0;
  }

  /**
   * 绘制所有棋子
   * @private
   */
  _drawPieces(gameState) {
    const { boardSize } = this.config;

    for (let y = 0; y < boardSize; y++) {
      for (let x = 0; x < boardSize; x++) {
        const piece = gameState.getPiece(x, y);
        if (piece !== 0) {
          this._drawPiece(x, y, piece);
        }
      }
    }
  }

  /**
   * 绘制单个棋子
   * @private
   */
  _drawPiece(x, y, player) {
    const { cellSize, boardPadding, boardMargin, pieceRadius } = this.config;
    const startX = boardPadding + boardMargin;
    const startY = boardPadding + boardMargin;

    const pixelX = startX + x * cellSize;
    const pixelY = startY + y * cellSize;

    // 检查是否有动画
    const animation = this.renderState.animations.find(
      anim => anim.type === 'pieceDrop' &&
              anim.position.x === x &&
              anim.position.y === y
    );

    let offsetY = 0;
    let scale = 1;
    let alpha = 1;

    if (animation) {
      const progress = Math.min((performance.now() - animation.startTime) / animation.duration, 1);
      const easeProgress = this._easeOutBounce(progress);
      offsetY = -30 * (1 - easeProgress);
      scale = 0.8 + 0.2 * easeProgress;
      alpha = progress;
    }

    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    this.ctx.translate(pixelX, pixelY + offsetY);
    this.ctx.scale(scale, scale);

    // 绘制阴影
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    this.ctx.shadowBlur = 5;
    this.ctx.shadowOffsetX = 2;
    this.ctx.shadowOffsetY = 2;

    // 绘制棋子
    this.ctx.beginPath();
    this.ctx.arc(0, 0, pieceRadius, 0, Math.PI * 2);

    if (player === 1) {
      // 黑棋
      const gradient = this.ctx.createRadialGradient(-5, -5, 0, 0, 0, pieceRadius);
      gradient.addColorStop(0, '#34495e');
      gradient.addColorStop(1, this.colors.blackPiece);
      this.ctx.fillStyle = gradient;
    } else {
      // 白棋
      const gradient = this.ctx.createRadialGradient(-5, -5, 0, 0, 0, pieceRadius);
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(1, this.colors.whitePiece);
      this.ctx.fillStyle = gradient;
    }

    this.ctx.fill();

    // 绘制边框
    this.ctx.shadowColor = 'transparent';
    this.ctx.strokeStyle = player === 1 ? this.colors.blackBorder : this.colors.whiteBorder;
    this.ctx.lineWidth = 1;
    this.ctx.stroke();

    this.ctx.restore();
  }

  /**
   * 绘制最后落子标记
   * @private
   */
  _drawLastMoveMarker() {
    if (!this.renderState.lastMove) {
      return;
    }

    const { cellSize, boardPadding, boardMargin, pieceRadius } = this.config;
    const startX = boardPadding + boardMargin;
    const startY = boardPadding + boardMargin;

    const x = this.renderState.lastMove.x;
    const y = this.renderState.lastMove.y;
    const pixelX = startX + x * cellSize;
    const pixelY = startY + y * cellSize;

    this.ctx.strokeStyle = this.colors.lastMove;
    this.ctx.lineWidth = 2;

    // 绘制方块标记
    const size = pieceRadius * 0.4;
    this.ctx.strokeRect(pixelX - size, pixelY - size, size * 2, size * 2);
  }

  /**
   * 绘制悬停效果
   * @private
   */
  _drawHoverEffect() {
    if (!this.renderState.hoveredPosition) {
      return;
    }

    const { cellSize, boardPadding, boardMargin, pieceRadius } = this.config;
    const startX = boardPadding + boardMargin;
    const startY = boardPadding + boardMargin;

    const x = this.renderState.hoveredPosition.x;
    const y = this.renderState.hoveredPosition.y;
    const pixelX = startX + x * cellSize;
    const pixelY = startY + y * cellSize;

    this.ctx.fillStyle = this.colors.hint;
    this.ctx.globalAlpha = 0.5;

    this.ctx.beginPath();
    this.ctx.arc(pixelX, pixelY, pieceRadius * 0.8, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.globalAlpha = 1.0;
  }

  /**
   * 绘制获胜线
   * @private
   */
  _drawWinLine() {
    if (!this.renderState.winLine || this.renderState.winLine.length < 2) {
      return;
    }

    const { cellSize, boardPadding, boardMargin } = this.config;
    const startX = boardPadding + boardMargin;
    const startY = boardPadding + boardMargin;

    // 检查动画
    const animation = this.renderState.animations.find(anim => anim.type === 'winLine');
    let progress = 1;

    if (animation) {
      progress = Math.min((performance.now() - animation.startTime) / animation.duration, 1);
    }

    this.ctx.strokeStyle = this.colors.winLine;
    this.ctx.lineWidth = 4;
    this.ctx.lineCap = 'round';

    // 绘制连接线
    this.ctx.beginPath();
    for (let i = 0; i < this.renderState.winLine.length; i++) {
      const point = this.renderState.winLine[i];
      const pixelX = startX + point.x * cellSize;
      const pixelY = startY + point.y * cellSize;

      if (i === 0) {
        this.ctx.moveTo(pixelX, pixelY);
      } else {
        this.ctx.lineTo(pixelX, pixelY);
      }

      // 如果动画未完成，提前停止
      if (i / this.renderState.winLine.length > progress) {
        break;
      }
    }
    this.ctx.stroke();
  }

  /**
   * 处理动画
   * @private
   */
  _processAnimations() {
    const now = performance.now();
    this.renderState.animations = this.renderState.animations.filter(animation => {
      return now - animation.startTime < animation.duration;
    });
  }

  /**
   * 缓动函数
   * @private
   */
  _easeOutBounce(t) {
    if (t < 1 / 2.75) {
      return 7.5625 * t * t;
    } else if (t < 2 / 2.75) {
      return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
    } else if (t < 2.5 / 2.75) {
      return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
    } else {
      return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
    }
  }

  /**
   * 将像素坐标转换为棋盘坐标
   * @param {number} pixelX - 像素X坐标
   * @param {number} pixelY - 像素Y坐标
   * @returns {Object|null} 棋盘坐标
   */
  pixelToBoard(pixelX, pixelY) {
    const { cellSize, boardPadding, boardMargin } = this.config;
    const startX = boardPadding + boardMargin;
    const startY = boardPadding + boardMargin;

    const x = Math.round((pixelX - startX) / cellSize);
    const y = Math.round((pixelY - startY) / cellSize);

    if (x >= 0 && x < this.config.boardSize && y >= 0 && y < this.config.boardSize) {
      return { x, y };
    }

    return null;
  }

  /**
   * 将棋盘坐标转换为像素坐标
   * @param {number} boardX - 棋盘X坐标
   * @param {number} boardY - 棋盘Y坐标
   * @returns {Object} 像素坐标
   */
  boardToPixel(boardX, boardY) {
    const { cellSize, boardPadding, boardMargin } = this.config;
    const startX = boardPadding + boardMargin;
    const startY = boardPadding + boardMargin;

    return {
      x: startX + boardX * cellSize,
      y: startY + boardY * cellSize
    };
  }

  /**
   * 绑定事件处理器
   * @private
   */
  _bindEventHandlers() {
    // 游戏状态变化
    this.eventBus.on('state:reset', () => {
      this.renderState.lastMove = null;
      this.renderState.winLine = null;
      this.renderState.forbiddenMoves.clear();
      this.renderState.hints = [];
    });

    // 落子事件
    this.eventBus.on('move:applied', (move) => {
      this.setLastMove(move);
    });

    // 游戏结束
    this.eventBus.on('game:finished', (winner, winLine) => {
      this.setWinLine(winLine);
    });

    // 设置更新
    this.eventBus.on('settings:updated', (settings) => {
      this.renderState.coordinateEnabled = settings.showCoordinates !== false;
      this.renderState.lastMoveEnabled = settings.showLastMove !== false;
    });
  }

  /**
   * 绑定画布事件
   * @private
   */
  _bindCanvasEvents() {
    // 鼠标移动
    this.canvas.addEventListener('mousemove', (event) => {
      const rect = this.canvas.getBoundingClientRect();
      const pixelX = event.clientX - rect.left;
      const pixelY = event.clientY - rect.top;

      const boardPos = this.pixelToBoard(pixelX, pixelY);
      this.setHoveredPosition(boardPos);

      this.eventBus.emit('canvas:mouseMove', boardPos, { pixelX, pixelY });
    });

    // 鼠标离开
    this.canvas.addEventListener('mouseleave', () => {
      this.setHoveredPosition(null);
      this.eventBus.emit('canvas:mouseLeave');
    });

    // 鼠标点击
    this.canvas.addEventListener('click', (event) => {
      const rect = this.canvas.getBoundingClientRect();
      const pixelX = event.clientX - rect.left;
      const pixelY = event.clientY - rect.top;

      const boardPos = this.pixelToBoard(pixelX, pixelY);
      if (boardPos) {
        this.eventBus.emit('canvas:click', boardPos, { pixelX, pixelY });
      }
    });

    // 触摸事件（移动端支持）
    this.canvas.addEventListener('touchstart', (event) => {
      event.preventDefault();
      const touch = event.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const pixelX = touch.clientX - rect.left;
      const pixelY = touch.clientY - rect.top;

      const boardPos = this.pixelToBoard(pixelX, pixelY);
      if (boardPos) {
        this.eventBus.emit('canvas:touch', boardPos, { pixelX, pixelY });
      }
    });
  }

  /**
   * 获取渲染器状态
   * @returns {Object} 渲染器状态
   */
  getStatus() {
    return {
      canvasSize: {
        width: this.canvas.width,
        height: this.canvas.height
      },
      config: this.config,
      renderState: {
        hasLastMove: !!this.renderState.lastMove,
        hasWinLine: !!this.renderState.winLine,
        forbiddenMovesCount: this.renderState.forbiddenMoves.size,
        hintsCount: this.renderState.hints.length,
        animationsCount: this.renderState.animations.length
      }
    };
  }

  /**
   * 销毁渲染器
   */
  destroy() {
    // 移除事件监听器
    this.canvas.removeEventListener('mousemove', this._handleMouseMove);
    this.canvas.removeEventListener('mouseleave', this._handleMouseLeave);
    this.canvas.removeEventListener('click', this._handleClick);
    this.canvas.removeEventListener('touchstart', this._handleTouchStart);

    // 清理状态
    this.renderState = null;

    this.logger.info('CanvasRenderer destroyed');
  }
}

// 模块元信息
CanvasRenderer.__moduleInfo = {
  name: 'CanvasRenderer',
  version: '2.0.0',
  dependencies: ['EventBus', 'Logger'],
  description: 'Canvas渲染器，负责游戏画面的视觉渲染'
};

// 导出模块
if (typeof window !== 'undefined') {
  window.CanvasRenderer = CanvasRenderer;
}
