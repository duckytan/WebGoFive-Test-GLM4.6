/**
 * 游戏状态管理 - 维护游戏运行时的完整状态
 *
 * 职责：
 * - 维护棋盘数据和游戏状态
 * - 管理落子历史和悔棋
 * - 提供状态快照和恢复功能
 * - 触发状态变化事件
 */

class GameState {
  constructor(eventBus) {
    // 验证依赖
    if (!eventBus) {
      throw new Error('GameState requires EventBus instance');
    }

    this.eventBus = eventBus;
    this.logger = logger.createModuleLogger('GameState');

    // 基础配置
    this.boardSize = 15;
    this.reset();

    // 绑定事件处理器
    this._bindEventHandlers();

    this.logger.info('GameState initialized');
  }

  /**
   * 重置游戏状态
   */
  reset() {
    this.board = Array(this.boardSize).fill().map(() => Array(this.boardSize).fill(0));
    this.currentPlayer = 1; // 1=黑棋, 2=白棋
    this.moveHistory = [];
    this.gameStatus = 'ready'; // ready | playing | finished | paused
    this.winner = null;
    this.startTime = null;
    this.endTime = null;
    this.moveCount = 0;
    this.forbiddenMoves = new Set(); // 禁手位置集合

    // 游戏设置
    this.settings = {
      forbiddenRules: true,
      aiDifficulty: 'NORMAL',
      blackAI: 'NORMAL',
      whiteAI: 'NORMAL',
      firstPlayer: 1,
      boardSize: 15,
      timeLimit: null, // 时间限制（秒）
      soundEnabled: true,
      showCoordinates: true,
      showLastMove: true,
      showHints: false
    };

    // 游戏模式
    this.mode = 'PvP'; // PvP | PvE | EvE

    // 清空禁手集合
    this.forbiddenMoves.clear();

    this.logger.info('Game state reset');
    this.eventBus.emit('state:reset', this.getSnapshot());
  }

  /**
   * 应用落子
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @param {Object} options - 选项
   * @param {boolean} options.silent - 是否静默（不触发事件）
   * @returns {Object} 操作结果
   */
  applyMove(x, y, options = {}) {
    const startTime = performance.now();

    // 验证坐标
    if (!this.isValidPosition(x, y)) {
      const error = `Invalid position: (${x}, ${y})`;
      this.logger.warn('Invalid move position', { x, y });
      throw new Error(error);
    }

    // 检查位置是否为空
    if (this.board[y][x] !== 0) {
      const error = `Position occupied: (${x}, ${y})`;
      this.logger.warn('Position already occupied', { x, y });
      throw new Error(error);
    }

    // 检查游戏状态
    if (this.gameStatus !== 'playing' && this.gameStatus !== 'ready') {
      const error = `Cannot apply move in status: ${this.gameStatus}`;
      this.logger.warn('Invalid game status for move', { status: this.gameStatus });
      throw new Error(error);
    }

    // 创建落子记录
    const move = {
      x,
      y,
      player: this.currentPlayer,
      step: this.moveCount + 1,
      timestamp: Date.now(),
      moveNumber: this.moveHistory.length + 1
    };

    // 应用落子
    this.board[y][x] = this.currentPlayer;
    this.moveHistory.push(move);
    this.moveCount++;

    // 更新游戏状态
    if (this.gameStatus === 'ready') {
      this.gameStatus = 'playing';
      this.startTime = Date.now();
    }

    // 触发事件（如果不是静默模式）
    if (!options.silent) {
      this.eventBus.emit('move:applied', move, this.getSnapshot());
    }

    const duration = performance.now() - startTime;
    this.logger.performance('applyMove', startTime);
    this.logger.info('Move applied', { x, y, player: this.currentPlayer, step: move.step });

    return {
      success: true,
      move,
      gameState: this.getSnapshot()
    };
  }

  /**
   * 撤回最后一步
   * @param {Object} options - 选项
   * @param {boolean} options.silent - 是否静默
   * @returns {Object} 操作结果
   */
  undoMove(options = {}) {
    if (this.moveHistory.length === 0) {
      this.logger.warn('No moves to undo');
      return { success: false, reason: 'No moves to undo' };
    }

    const lastMove = this.moveHistory.pop();
    this.board[lastMove.y][lastMove.x] = 0;
    this.moveCount--;

    // 恢复游戏状态
    if (this.moveHistory.length === 0) {
      this.gameStatus = 'ready';
      this.startTime = null;
      this.winner = null;
    }

    // 切换回上一个玩家
    this.currentPlayer = lastMove.player;

    if (!options.silent) {
      this.eventBus.emit('move:undone', lastMove, this.getSnapshot());
    }

    this.logger.info('Move undone', lastMove);
    return {
      success: true,
      undoneMove: lastMove,
      gameState: this.getSnapshot()
    };
  }

  /**
   * 切换当前玩家
   */
  switchPlayer() {
    this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
    this.logger.info('Player switched', { newPlayer: this.currentPlayer });
    this.eventBus.emit('player:switched', this.currentPlayer);
  }

  /**
   * 设置游戏状态
   * @param {string} status - 新状态
   */
  setGameStatus(status) {
    const oldStatus = this.gameStatus;
    this.gameStatus = status;

    if (status === 'finished' && !this.endTime) {
      this.endTime = Date.now();
    }

    this.logger.info('Game status changed', { oldStatus, newStatus: status });
    this.eventBus.emit('game:statusChanged', status, oldStatus);
  }

  /**
   * 设置获胜者
   * @param {number} winner - 获胜者（1=黑棋, 2=白棋, null=平局）
   * @param {Array} winLine - 获胜线路坐标
   */
  setWinner(winner, winLine = null) {
    this.winner = winner;
    this.setGameStatus('finished');

    this.logger.info('Game finished', { winner, winLine });
    this.eventBus.emit('game:finished', winner, winLine, this.getSnapshot());
  }

  /**
   * 设置游戏模式
   * @param {string} mode - 游戏模式
   */
  setMode(mode) {
    const oldMode = this.mode;
    this.mode = mode;

    this.logger.info('Game mode changed', { oldMode, newMode: mode });
    this.eventBus.emit('game:modeChanged', mode, oldMode);
  }

  /**
   * 更新设置
   * @param {Object} newSettings - 新设置
   */
  updateSettings(newSettings) {
    const oldSettings = { ...this.settings };
    Object.assign(this.settings, newSettings);

    // 如果棋盘大小改变，重置游戏
    if (newSettings.boardSize && newSettings.boardSize !== this.boardSize) {
      this.boardSize = newSettings.boardSize;
      this.reset();
    }

    this.logger.info('Settings updated', { oldSettings, newSettings: this.settings });
    this.eventBus.emit('settings:updated', this.settings, oldSettings);
  }

  /**
   * 添加禁手位置
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   */
  addForbiddenMove(x, y) {
    const key = `${x},${y}`;
    this.forbiddenMoves.add(key);
  }

  /**
   * 移除禁手位置
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   */
  removeForbiddenMove(x, y) {
    const key = `${x},${y}`;
    this.forbiddenMoves.delete(key);
  }

  /**
   * 检查是否为禁手位置
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @returns {boolean} 是否为禁手
   */
  isForbiddenMove(x, y) {
    return this.forbiddenMoves.has(`${x},${y}`);
  }

  /**
   * 获取指定位置的棋子
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @returns {number} 棋子值（0=空, 1=黑, 2=白）
   */
  getPiece(x, y) {
    if (!this.isValidPosition(x, y)) {
      return null;
    }
    return this.board[y][x];
  }

  /**
   * 设置指定位置的棋子
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @param {number} player - 棋子值
   */
  setPiece(x, y, player) {
    if (this.isValidPosition(x, y)) {
      this.board[y][x] = player;
    }
  }

  /**
   * 验证坐标是否有效
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @returns {boolean} 是否有效
   */
  isValidPosition(x, y) {
    return Number.isInteger(x) && Number.isInteger(y) &&
           x >= 0 && x < this.boardSize &&
           y >= 0 && y < this.boardSize;
  }

  /**
   * 获取游戏状态快照
   * @returns {Object} 状态快照
   */
  getSnapshot() {
    return {
      // 基础状态
      board: this.board.map(row => [...row]), // 深拷贝
      currentPlayer: this.currentPlayer,
      moveHistory: [...this.moveHistory],
      gameStatus: this.gameStatus,
      winner: this.winner,

      // 游戏信息
      mode: this.mode,
      settings: { ...this.settings },
      boardSize: this.boardSize,
      moveCount: this.moveCount,

      // 时间信息
      startTime: this.startTime,
      endTime: this.endTime,
      timestamp: Date.now(),

      // 禁手信息
      forbiddenMoves: Array.from(this.forbiddenMoves)
    };
  }

  /**
   * 从快照恢复状态
   * @param {Object} snapshot - 状态快照
   * @param {Object} options - 选项
   * @param {boolean} options.silent - 是否静默
   */
  restoreSnapshot(snapshot, options = {}) {
    if (!snapshot) {
      throw new Error('Invalid snapshot');
    }

    // 恢复状态
    this.board = snapshot.board.map(row => [...row]);
    this.currentPlayer = snapshot.currentPlayer;
    this.moveHistory = [...snapshot.moveHistory];
    this.gameStatus = snapshot.gameStatus;
    this.winner = snapshot.winner;
    this.mode = snapshot.mode;
    this.settings = { ...snapshot.settings };
    this.boardSize = snapshot.boardSize;
    this.moveCount = snapshot.moveCount;
    this.startTime = snapshot.startTime;
    this.endTime = snapshot.endTime;

    // 恢复禁手
    this.forbiddenMoves.clear();
    if (snapshot.forbiddenMoves) {
      snapshot.forbiddenMoves.forEach(pos => this.forbiddenMoves.add(pos));
    }

    if (!options.silent) {
      this.eventBus.emit('state:restored', this.getSnapshot());
    }

    this.logger.info('State restored from snapshot');
  }

  /**
   * 获取游戏统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    const now = Date.now();
    const duration = this.startTime ? now - this.startTime : 0;

    return {
      moveCount: this.moveCount,
      blackMoves: this.moveHistory.filter(m => m.player === 1).length,
      whiteMoves: this.moveHistory.filter(m => m.player === 2).length,
      duration,
      gameStatus: this.gameStatus,
      mode: this.mode,
      winner: this.winner,
      boardSize: this.boardSize
    };
  }

  /**
   * 验证游戏状态一致性
   * @returns {Object} 验证结果
   */
  validateState() {
    const issues = [];

    // 检查棋盘大小
    if (this.board.length !== this.boardSize) {
      issues.push(`Board size mismatch: expected ${this.boardSize}, got ${this.board.length}`);
    }

    // 检查历史记录一致性
    const boardPieceCount = this.board.flat().filter(cell => cell !== 0).length;
    if (boardPieceCount !== this.moveHistory.length) {
      issues.push(`Piece count mismatch: board has ${boardPieceCount}, history has ${this.moveHistory.length}`);
    }

    // 检查玩家状态
    if (this.currentPlayer !== 1 && this.currentPlayer !== 2) {
      issues.push(`Invalid current player: ${this.currentPlayer}`);
    }

    // 检查游戏状态
    const validStatuses = ['ready', 'playing', 'finished', 'paused'];
    if (!validStatuses.includes(this.gameStatus)) {
      issues.push(`Invalid game status: ${this.gameStatus}`);
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * 绑定事件处理器
   * @private
   */
  _bindEventHandlers() {
    // 可以在这里绑定一些内部事件处理器
  }

  /**
   * 销毁实例
   */
  destroy() {
    this.reset();
    this.logger.info('GameState destroyed');
  }
}

// 模块元信息
GameState.__moduleInfo = {
  name: 'GameState',
  version: '2.0.0',
  dependencies: ['EventBus', 'Logger'],
  description: '游戏状态管理，维护游戏运行时的完整状态'
};

// 导出模块
if (typeof window !== 'undefined') {
  window.GameState = GameState;
}
