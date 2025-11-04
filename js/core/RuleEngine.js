/**
 * 规则引擎 - 五子棋规则判定和禁手检测
 *
 * 职责：
 * - 胜负判定
 * - 禁手检测（三三、四四、长连）
 * - 棋型识别和分析
 * - 合法性验证
 */

class RuleEngine {
  constructor(eventBus) {
    // 验证依赖
    if (!eventBus) {
      throw new Error('RuleEngine requires EventBus instance');
    }

    this.eventBus = eventBus;
    this.logger = logger.createModuleLogger('RuleEngine');

    // 方向向量：水平、垂直、对角线、反对角线
    this.directions = [
      { dx: 1, dy: 0, name: 'horizontal' },
      { dx: 0, dy: 1, name: 'vertical' },
      { dx: 1, dy: 1, name: 'diagDown' },
      { dx: 1, dy: -1, name: 'diagUp' }
    ];

    // 棋型定义
    this.patterns = {
      FIVE: 'five',           // 五连
      OVERLINE: 'overline',   // 长连
      LIVE_FOUR: 'liveFour',  // 活四
      RUSH_FOUR: 'rushFour',  // 冲四
      LIVE_THREE: 'liveThree', // 活三
      SLEEP_THREE: 'sleepThree', // 眠三
      LIVE_TWO: 'liveTwo',    // 活二
      SLEEP_TWO: 'sleepTwo'   // 眠二
    };

    this.logger.info('RuleEngine initialized');
  }

  /**
   * 验证落子是否合法
   * @param {Object} gameState - 游戏状态
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @returns {Object} 验证结果
   */
  validateMove(gameState, x, y) {
    const startTime = performance.now();

    try {
      // 基础验证
      if (!gameState.isValidPosition(x, y)) {
        return {
          valid: false,
          error: 'INVALID_POSITION',
          message: `Invalid position: (${x}, ${y})`
        };
      }

      if (gameState.getPiece(x, y) !== 0) {
        return {
          valid: false,
          error: 'POSITION_OCCUPIED',
          message: `Position occupied: (${x}, ${y})`
        };
      }

      // 禁手检测（仅对黑棋）
      if (gameState.settings.forbiddenRules && gameState.currentPlayer === 1) {
        const forbiddenResult = this.detectForbidden(gameState, x, y);
        if (forbiddenResult.isForbidden) {
          return {
            valid: false,
            error: 'FORBIDDEN_MOVE',
            message: `Forbidden move: ${forbiddenResult.type}`,
            forbiddenInfo: forbiddenResult
          };
        }
      }

      const duration = performance.now() - startTime;
      this.logger.performance('validateMove', startTime);

      return {
        valid: true,
        message: 'Move is valid'
      };

    } catch (error) {
      this.logger.error('Error validating move', { x, y, error: error.message });
      return {
        valid: false,
        error: 'VALIDATION_ERROR',
        message: `Validation error: ${error.message}`
      };
    }
  }

  /**
   * 检查是否获胜
   * @param {Object} gameState - 游戏状态
   * @param {number} x - 最后落子的x坐标
   * @param {number} y - 最后落子的y坐标
   * @param {number} player - 玩家（可选，默认使用当前玩家）
   * @returns {Object} 检查结果
   */
  checkWin(gameState, x, y, player = null) {
    const startTime = performance.now();
    const currentPlayer = player || gameState.currentPlayer;

    // 在每个方向上检查连子数
    for (const direction of this.directions) {
      const result = this._countConsecutive(gameState, x, y, currentPlayer, direction);

      if (result.count >= 5) {
        // 检查是否为长连（禁手）
        const isOverline = result.count > 5 && currentPlayer === 1 && gameState.settings.forbiddenRules;

        const winLine = this._getWinLine(gameState, x, y, currentPlayer, direction, result.count);

        const duration = performance.now() - startTime;
        this.logger.performance('checkWin', startTime);
        this.logger.info('Win detected', {
          x, y, player: currentPlayer,
          direction: direction.name,
          count: result.count,
          isOverline
        });

        return {
          isWin: !isOverline,
          isOverline,
          direction: direction.name,
          count: result.count,
          winLine,
          player: currentPlayer
        };
      }
    }

    const duration = performance.now() - startTime;
    this.logger.performance('checkWin', startTime);

    return {
      isWin: false,
      isOverline: false,
      direction: null,
      count: 0,
      winLine: null,
      player: currentPlayer
    };
  }

  /**
   * 检测禁手（仅对黑棋）
   * @param {Object} gameState - 游戏状态
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @returns {Object} 禁手检测结果
   */
  detectForbidden(gameState, x, y) {
    const startTime = performance.now();

    // 创建临时棋盘，假设在此位置落子
    const tempBoard = gameState.board.map(row => [...row]);
    tempBoard[y][x] = 1; // 黑棋

    const forbiddenTypes = [];

    // 检测长连
    const overlineResult = this._checkOverline(tempBoard, x, y);
    if (overlineResult.isOverline) {
      forbiddenTypes.push({
        type: 'OVERLINE',
        description: '长连禁手',
        details: overlineResult
      });
    }

    // 检测双三
    const doubleThreeResult = this._checkDoubleThree(tempBoard, x, y);
    if (doubleThreeResult.isDoubleThree) {
      forbiddenTypes.push({
        type: 'DOUBLE_THREE',
        description: '双三禁手',
        details: doubleThreeResult
      });
    }

    // 检测双四
    const doubleFourResult = this._checkDoubleFour(tempBoard, x, y);
    if (doubleFourResult.isDoubleFour) {
      forbiddenTypes.push({
        type: 'DOUBLE_FOUR',
        description: '双四禁手',
        details: doubleFourResult
      });
    }

    const isForbidden = forbiddenTypes.length > 0;

    const duration = performance.now() - startTime;
    this.logger.performance('detectForbidden', startTime);

    if (isForbidden) {
      this.logger.info('Forbidden move detected', { x, y, types: forbiddenTypes.map(t => t.type) });
    }

    return {
      isForbidden,
      types: forbiddenTypes,
      primaryType: forbiddenTypes.length > 0 ? forbiddenTypes[0].type : null
    };
  }

  /**
   * 分析棋型
   * @param {Object} gameState - 游戏状态
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @param {number} player - 玩家
   * @returns {Object} 棋型分析结果
   */
  analyzePattern(gameState, x, y, player) {
    const startTime = performance.now();
    const patterns = [];

    // 在每个方向上分析棋型
    for (const direction of this.directions) {
      const pattern = this._analyzeDirectionPattern(gameState, x, y, player, direction);
      if (pattern) {
        patterns.push(pattern);
      }
    }

    // 统计各种棋型数量
    const patternCount = {
      five: 0,
      overline: 0,
      liveFour: 0,
      rushFour: 0,
      liveThree: 0,
      sleepThree: 0,
      liveTwo: 0,
      sleepTwo: 0
    };

    patterns.forEach(pattern => {
      if (patternCount.hasOwnProperty(pattern.type)) {
        patternCount[pattern.type]++;
      }
    });

    const duration = performance.now() - startTime;
    this.logger.performance('analyzePattern', startTime);

    return {
      position: { x, y },
      player,
      patterns,
      patternCount,
      score: this._calculatePositionScore(patternCount)
    };
  }

  /**
   * 获取所有可落子位置
   * @param {Object} gameState - 游戏状态
   * @param {Object} options - 选项
   * @param {number} options.range - 搜索范围（默认2，表示只考虑已有棋子周围2格内）
   * @param {boolean} options.includeForbidden - 是否包含禁手位置
   * @returns {Array} 可落子位置数组
   */
  getAvailableMoves(gameState, options = {}) {
    const { range = 2, includeForbidden = false } = options;
    const availableMoves = [];
    const searched = new Set();

    // 如果棋盘为空，返回中心点
    if (gameState.moveHistory.length === 0) {
      const center = Math.floor(gameState.boardSize / 2);
      return [{ x: center, y: center }];
    }

    // 遍历已有棋子，查找周围空位
    for (const move of gameState.moveHistory) {
      for (let dx = -range; dx <= range; dx++) {
        for (let dy = -range; dy <= range; dy++) {
          const x = move.x + dx;
          const y = move.y + dy;
          const key = `${x},${y}`;

          // 跳过已搜索位置
          if (searched.has(key)) {
            continue;
          }
          searched.add(key);

          // 验证位置
          if (!gameState.isValidPosition(x, y)) {
            continue;
          }
          if (gameState.getPiece(x, y) !== 0) {
            continue;
          }

          // 检查禁手
          if (!includeForbidden && gameState.settings.forbiddenRules && gameState.currentPlayer === 1) {
            const forbiddenResult = this.detectForbidden(gameState, x, y);
            if (forbiddenResult.isForbidden) {
              continue;
            }
          }

          availableMoves.push({ x, y });
        }
      }
    }

    return availableMoves;
  }

  /**
   * 计算位置分数（用于AI评估）
   * @param {Object} gameState - 游戏状态
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @param {number} player - 玩家
   * @returns {number} 位置分数
   */
  evaluatePosition(gameState, x, y, player) {
    const analysis = this.analyzePattern(gameState, x, y, player);
    return analysis.score;
  }

  /**
   * 统计连续棋子数
   * @private
   * @param {Object} gameState - 游戏状态
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @param {number} player - 玩家
   * @param {Object} direction - 方向向量
   * @returns {Object} 统计结果
   */
  _countConsecutive(gameState, x, y, player, direction) {
    let count = 1;
    let leftEnd = null;
    let rightEnd = null;

    // 向正方向搜索
    for (let i = 1; i < gameState.boardSize; i++) {
      const nx = x + direction.dx * i;
      const ny = y + direction.dy * i;

      if (!gameState.isValidPosition(nx, ny)) {
        break;
      }
      if (gameState.getPiece(nx, ny) !== player) {
        rightEnd = gameState.getPiece(nx, ny);
        break;
      }
      count++;
    }

    // 向负方向搜索
    for (let i = 1; i < gameState.boardSize; i++) {
      const nx = x - direction.dx * i;
      const ny = y - direction.dy * i;

      if (!gameState.isValidPosition(nx, ny)) {
        break;
      }
      if (gameState.getPiece(nx, ny) !== player) {
        leftEnd = gameState.getPiece(nx, ny);
        break;
      }
      count++;
    }

    return {
      count,
      leftEnd,
      rightEnd,
      isOpen: leftEnd === 0 && rightEnd === 0
    };
  }

  /**
   * 获取获胜线路
   * @private
   * @param {Object} gameState - 游戏状态
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @param {number} player - 玩家
   * @param {Object} direction - 方向向量
   * @param {number} count - 连子数
   * @returns {Array} 获胜线路坐标
   */
  _getWinLine(gameState, x, y, player, direction, count) {
    const line = [{ x, y }];

    // 向正方向添加坐标
    for (let i = 1; i < count; i++) {
      const nx = x + direction.dx * i;
      const ny = y + direction.dy * i;

      if (!gameState.isValidPosition(nx, ny)) {
        break;
      }
      if (gameState.getPiece(nx, ny) !== player) {
        break;
      }

      line.push({ x: nx, y: ny });
    }

    // 向负方向添加坐标
    for (let i = 1; i < count; i++) {
      const nx = x - direction.dx * i;
      const ny = y - direction.dy * i;

      if (!gameState.isValidPosition(nx, ny)) {
        break;
      }
      if (gameState.getPiece(nx, ny) !== player) {
        break;
      }

      line.unshift({ x: nx, y: ny });
    }

    // 只返回5个坐标（五连）
    return line.slice(0, 5);
  }

  /**
   * 检查长连
   * @private
   * @param {Array} board - 棋盘
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @returns {Object} 检查结果
   */
  _checkOverline(board, x, y) {
    for (const direction of this.directions) {
      let count = 1;

      // 向正方向搜索
      for (let i = 1; i < 15; i++) {
        const nx = x + direction.dx * i;
        const ny = y + direction.dy * i;

        if (nx < 0 || nx >= 15 || ny < 0 || ny >= 15) {
          break;
        }
        if (board[ny][nx] !== 1) {
          break;
        }
        count++;
      }

      // 向负方向搜索
      for (let i = 1; i < 15; i++) {
        const nx = x - direction.dx * i;
        const ny = y - direction.dy * i;

        if (nx < 0 || nx >= 15 || ny < 0 || ny >= 15) {
          break;
        }
        if (board[ny][nx] !== 1) {
          break;
        }
        count++;
      }

      if (count > 5) {
        return { isOverline: true, count, direction: direction.name };
      }
    }

    return { isOverline: false, count: 0 };
  }

  /**
   * 检查双三
   * @private
   * @param {Array} board - 棋盘
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @returns {Object} 检查结果
   */
  _checkDoubleThree(board, x, y) {
    const liveThrees = [];

    for (const direction of this.directions) {
      const pattern = this._analyzeDirectionPatternOnBoard(board, x, y, 1, direction);
      if (pattern && pattern.type === 'liveThree') {
        liveThrees.push(pattern);
      }
    }

    return {
      isDoubleThree: liveThrees.length >= 2,
      liveThrees,
      count: liveThrees.length
    };
  }

  /**
   * 检查双四
   * @private
   * @param {Array} board - 棋盘
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @returns {Object} 检查结果
   */
  _checkDoubleFour(board, x, y) {
    const fours = [];

    for (const direction of this.directions) {
      const pattern = this._analyzeDirectionPatternOnBoard(board, x, y, 1, direction);
      if (pattern && (pattern.type === 'liveFour' || pattern.type === 'rushFour')) {
        fours.push(pattern);
      }
    }

    return {
      isDoubleFour: fours.length >= 2,
      fours,
      count: fours.length
    };
  }

  /**
   * 分析方向上的棋型
   * @private
   * @param {Object} gameState - 游戏状态
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @param {number} player - 玩家
   * @param {Object} direction - 方向向量
   * @returns {Object|null} 棋型信息
   */
  _analyzeDirectionPattern(gameState, x, y, player, direction) {
    // 创建临时棋盘
    const tempBoard = gameState.board.map(row => [...row]);
    tempBoard[y][x] = player;

    return this._analyzeDirectionPatternOnBoard(tempBoard, x, y, player, direction);
  }

  /**
   * 在指定棋盘上分析方向棋型
   * @private
   * @param {Array} board - 棋盘
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @param {number} player - 玩家
   * @param {Object} direction - 方向向量
   * @returns {Object|null} 棋型信息
   */
  _analyzeDirectionPatternOnBoard(board, x, y, player, direction) {
    const line = this._getLinePattern(board, x, y, player, direction);
    const pattern = this._matchPattern(line);

    if (!pattern) {
      return null;
    }

    return {
      type: pattern.type,
      direction: direction.name,
      line,
      score: pattern.score
    };
  }

  /**
   * 获取方向上的线条模式
   * @private
   * @param {Array} board - 棋盘
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @param {number} player - 玩家
   * @param {Object} direction - 方向向量
   * @returns {Array} 线条模式
   */
  _getLinePattern(board, x, y, player, direction) {
    const pattern = [];
    const range = 5; // 检查范围

    // 向负方向扩展
    for (let i = range - 1; i >= 0; i--) {
      const nx = x - direction.dx * i;
      const ny = y - direction.dy * i;

      if (nx < 0 || nx >= 15 || ny < 0 || ny >= 15) {
        pattern.push(-1); // 边界
      } else if (board[ny][nx] === player) {
        pattern.push(1); // 己方棋子
      } else if (board[ny][nx] === 0) {
        pattern.push(0); // 空位
      } else {
        pattern.push(2); // 对方棋子
      }
    }

    // 向正方向扩展
    for (let i = 1; i < range; i++) {
      const nx = x + direction.dx * i;
      const ny = y + direction.dy * i;

      if (nx < 0 || nx >= 15 || ny < 0 || ny >= 15) {
        pattern.push(-1); // 边界
      } else if (board[ny][nx] === player) {
        pattern.push(1); // 己方棋子
      } else if (board[ny][nx] === 0) {
        pattern.push(0); // 空位
      } else {
        pattern.push(2); // 对方棋子
      }
    }

    return pattern;
  }

  /**
   * 匹配棋型模式
   * @private
   * @param {Array} line - 线条模式
   * @returns {Object|null} 匹配的棋型
   */
  _matchPattern(line) {
    const lineStr = line.join(',');

    // 五连
    if (lineStr.includes('1,1,1,1,1')) {
      return { type: 'five', score: 100000 };
    }

    // 长连
    if (lineStr.match(/1,1,1,1,1,1/)) {
      return { type: 'overline', score: -100000 };
    }

    // 活四
    if (lineStr.includes('0,1,1,1,1,0')) {
      return { type: 'liveFour', score: 10000 };
    }

    // 冲四
    if (lineStr.includes('1,1,1,1,0') || lineStr.includes('0,1,1,1,1') ||
        lineStr.includes('1,1,1,0,1') || lineStr.includes('1,0,1,1,1')) {
      return { type: 'rushFour', score: 1000 };
    }

    // 活三
    if (lineStr.includes('0,1,1,1,0') || lineStr.includes('0,1,1,0,1,0')) {
      return { type: 'liveThree', score: 1000 };
    }

    // 眠三
    if (lineStr.includes('1,1,1,0') || lineStr.includes('0,1,1,1') ||
        lineStr.includes('1,1,0,1') || lineStr.includes('1,0,1,1')) {
      return { type: 'sleepThree', score: 100 };
    }

    // 活二
    if (lineStr.includes('0,1,1,0') || lineStr.includes('0,1,0,1,0')) {
      return { type: 'liveTwo', score: 100 };
    }

    // 眠二
    if (lineStr.includes('1,1,0') || lineStr.includes('0,1,1') ||
        lineStr.includes('1,0,1')) {
      return { type: 'sleepTwo', score: 10 };
    }

    return null;
  }

  /**
   * 计算位置分数
   * @private
   * @param {Object} patternCount - 棋型统计
   * @returns {number} 总分
   */
  _calculatePositionScore(patternCount) {
    const scores = {
      five: 100000,
      overline: -100000,
      liveFour: 10000,
      rushFour: 1000,
      liveThree: 1000,
      sleepThree: 100,
      liveTwo: 100,
      sleepTwo: 10
    };

    let totalScore = 0;
    for (const [pattern, count] of Object.entries(patternCount)) {
      if (scores[pattern]) {
        totalScore += scores[pattern] * count;
      }
    }

    return totalScore;
  }
}

// 模块元信息
RuleEngine.__moduleInfo = {
  name: 'RuleEngine',
  version: '2.0.0',
  dependencies: ['EventBus', 'Logger'],
  description: '规则引擎，五子棋规则判定和禁手检测'
};

// 导出模块
if (typeof window !== 'undefined') {
  window.RuleEngine = RuleEngine;
}
