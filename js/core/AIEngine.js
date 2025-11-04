/**
 * AI引擎 - 提供不同难度的AI策略
 *
 * 职责：
 * - 实现四种难度的AI策略
 * - 提供候选点生成和评估
 * - 支持威胁空间搜索（高级难度）
 * - 提供AI思考动画控制
 */

class AIEngine {
  constructor(eventBus) {
    // 验证依赖
    if (!eventBus) {
      throw new Error('AIEngine requires EventBus instance');
    }

    this.eventBus = eventBus;
    this.logger = logger.createModuleLogger('AIEngine');

    // AI难度定义
    this.DIFFICULTY = {
      BEGINNER: 'BEGINNER',  // 新手
      NORMAL: 'NORMAL',      // 正常
      HARD: 'HARD',          // 困难
      HELL: 'HELL'           // 地狱
    };

    // 搜索深度限制
    this.searchDepths = {
      [this.DIFFICULTY.BEGINNER]: 1,
      [this.DIFFICULTY.NORMAL]: 2,
      [this.DIFFICULTY.HARD]: 3,
      [this.DIFFICULTY.HELL]: 4
    };

    // 思考时间限制（毫秒）
    this.timeLimits = {
      [this.DIFFICULTY.BEGINNER]: 600,
      [this.DIFFICULTY.NORMAL]: 1000,
      [this.DIFFICULTY.HARD]: 2000,
      [this.DIFFICULTY.HELL]: 2400
    };

    // 当前思考状态
    this.isThinking = false;
    this.currentThinking = null;

    this.logger.info('AIEngine initialized');
  }

  /**
   * 计算最佳落子位置
   * @param {Object} gameState - 游戏状态
   * @param {Object} ruleEngine - 规则引擎
   * @param {string} difficulty - AI难度
   * @param {Object} options - 选项
   * @param {Function} options.onProgress - 进度回调
   * @returns {Promise<Object>} 计算结果
   */
  async calculateBestMove(gameState, ruleEngine, difficulty = this.DIFFICULTY.NORMAL, options = {}) {
    const startTime = performance.now();

    if (this.isThinking) {
      throw new Error('AI is already thinking');
    }

    this.isThinking = true;
    this.currentThinking = {
      difficulty,
      startTime,
      gameState: gameState.getSnapshot()
    };

    try {
      this.logger.info('AI thinking started', { difficulty, player: gameState.currentPlayer });
      this.eventBus.emit('ai:thinkingStarted', gameState.currentPlayer, difficulty);

      // 根据难度选择策略
      let result;
      switch (difficulty) {
      case this.DIFFICULTY.BEGINNER:
        result = await this._beginnerStrategy(gameState, ruleEngine, options);
        break;
      case this.DIFFICULTY.NORMAL:
        result = await this._normalStrategy(gameState, ruleEngine, options);
        break;
      case this.DIFFICULTY.HARD:
        result = await this._hardStrategy(gameState, ruleEngine, options);
        break;
      case this.DIFFICULTY.HELL:
        result = await this._hellStrategy(gameState, ruleEngine, options);
        break;
      default:
        throw new Error(`Unknown difficulty: ${difficulty}`);
      }

      const duration = performance.now() - startTime;
      this.logger.performance('calculateBestMove', startTime);
      this.logger.info('AI thinking completed', {
        difficulty,
        position: result.position,
        score: result.score,
        duration
      });

      this.eventBus.emit('ai:thinkingCompleted', result, duration);

      return result;

    } catch (error) {
      const duration = performance.now() - startTime;
      this.logger.error('AI thinking failed', { difficulty, error: error.message, duration });
      this.eventBus.emit('ai:thinkingFailed', error, duration);
      throw error;

    } finally {
      this.isThinking = false;
      this.currentThinking = null;
    }
  }

  /**
   * 新手策略 - 随机选择，偏向防守
   * @private
   */
  async _beginnerStrategy(gameState, ruleEngine, options) {
    const availableMoves = ruleEngine.getAvailableMoves(gameState, { range: 2 });

    if (availableMoves.length === 0) {
      throw new Error('No available moves');
    }

    // 模拟思考时间
    await this._simulateThinking(200, 400);

    // 添加一些简单的评估
    const scoredMoves = availableMoves.map(move => {
      const score = this._evaluateBasicPosition(gameState, ruleEngine, move.x, move.y);
      return { ...move, score };
    });

    // 按分数排序，加入随机性
    scoredMoves.sort((a, b) => b.score - a.score);

    // 从前50%中随机选择
    const topMoves = scoredMoves.slice(0, Math.ceil(scoredMoves.length / 2));
    const selectedMove = topMoves[Math.floor(Math.random() * topMoves.length)];

    return {
      position: { x: selectedMove.x, y: selectedMove.y },
      score: selectedMove.score,
      strategy: 'BEGINNER',
      thinking: 'Random selection with basic evaluation'
    };
  }

  /**
   * 正常策略 - Minimax + Alpha-Beta剪枝
   * @private
   */
  async _normalStrategy(gameState, ruleEngine, options) {
    const depth = this.searchDepths[this.DIFFICULTY.NORMAL];
    const timeLimit = this.timeLimits[this.DIFFICULTY.NORMAL];

    const result = await this._minimaxSearch(
      gameState,
      ruleEngine,
      depth,
      true,
      -Infinity,
      Infinity,
      timeLimit,
      options.onProgress
    );

    return {
      position: result.position,
      score: result.score,
      strategy: 'NORMAL',
      depth,
      nodesSearched: result.nodesSearched,
      thinking: `Minimax search depth ${depth}`
    };
  }

  /**
   * 困难策略 - 深度搜索 + 威胁分析
   * @private
   */
  async _hardStrategy(gameState, ruleEngine, options) {
    const depth = this.searchDepths[this.DIFFICULTY.HARD];
    const timeLimit = this.timeLimits[this.DIFFICULTY.HARD];

    // 首先进行威胁分析
    const threats = await this._analyzeThreats(gameState, ruleEngine);

    if (threats.critical.length > 0) {
      // 有直接威胁，优先处理
      const criticalMove = threats.critical[0];
      return {
        position: criticalMove.position,
        score: criticalMove.score,
        strategy: 'HARD',
        thinking: 'Critical threat response'
      };
    }

    // 进行深度搜索
    const result = await this._minimaxSearch(
      gameState,
      ruleEngine,
      depth,
      true,
      -Infinity,
      Infinity,
      timeLimit,
      options.onProgress
    );

    return {
      position: result.position,
      score: result.score,
      strategy: 'HARD',
      depth,
      nodesSearched: result.nodesSearched,
      threats,
      thinking: 'Deep search with threat analysis'
    };
  }

  /**
   * 地狱策略 - 威胁空间搜索
   * @private
   */
  async _hellStrategy(gameState, ruleEngine, options) {
    const timeLimit = this.timeLimits[this.DIFFICULTY.HELL];

    // 威胁空间搜索
    const result = await this._threatSpaceSearch(
      gameState,
      ruleEngine,
      timeLimit,
      options.onProgress
    );

    return {
      position: result.position,
      score: result.score,
      strategy: 'HELL',
      nodesSearched: result.nodesSearched,
      threats: result.threats,
      sequences: result.sequences,
      thinking: 'Threat space search'
    };
  }

  /**
   * Minimax搜索算法
   * @private
   */
  async _minimaxSearch(gameState, ruleEngine, depth, isMaximizing, alpha, beta, timeLimit, onProgress) {
    const startTime = performance.now();
    let nodesSearched = 0;
    let bestMove = null;
    let bestScore = isMaximizing ? -Infinity : Infinity;

    const availableMoves = ruleEngine.getAvailableMoves(gameState, { range: 2 });

    if (availableMoves.length === 0) {
      return { position: null, score: 0, nodesSearched: 0 };
    }

    // 为每个位置评分并排序（优化剪枝效果）
    const scoredMoves = availableMoves.map(move => ({
      ...move,
      score: this._evaluateBasicPosition(gameState, ruleEngine, move.x, move.y)
    }));

    scoredMoves.sort((a, b) => isMaximizing ? b.score - a.score : a.score - b.score);

    for (const move of scoredMoves) {
      // 检查时间限制
      if (performance.now() - startTime > timeLimit) {
        break;
      }

      // 模拟落子
      const tempState = this._createTempState(gameState);
      tempState.applyMove(move.x, move.y, { silent: true });

      nodesSearched++;

      // 递归搜索
      let score;
      if (depth === 0 || tempState.gameStatus === 'finished') {
        score = this._evaluatePosition(tempState, ruleEngine, move.x, move.y);
      } else {
        const result = await this._minimaxSearch(
          tempState, ruleEngine, depth - 1, !isMaximizing, alpha, beta, timeLimit, onProgress
        );
        score = result.score;
        nodesSearched += result.nodesSearched;
      }

      // 更新最佳值
      if (isMaximizing) {
        if (score > bestScore) {
          bestScore = score;
          bestMove = { x: move.x, y: move.y };
        }
        alpha = Math.max(alpha, score);
      } else {
        if (score < bestScore) {
          bestScore = score;
          bestMove = { x: move.x, y: move.y };
        }
        beta = Math.min(beta, score);
      }

      // Alpha-Beta剪枝
      if (beta <= alpha) {
        break;
      }

      // 进度回调
      if (onProgress) {
        const progress = (nodesSearched / (availableMoves.length * Math.pow(3, depth))) * 100;
        onProgress(Math.min(progress, 100));
      }
    }

    return {
      position: bestMove,
      score: bestScore,
      nodesSearched
    };
  }

  /**
   * 威胁空间搜索
   * @private
   */
  async _threatSpaceSearch(gameState, ruleEngine, timeLimit, onProgress) {
    const startTime = performance.now();
    let nodesSearched = 0;
    let bestMove = null;
    let bestScore = -Infinity;

    // 分析当前威胁
    const threats = await this._analyzeThreats(gameState, ruleEngine);

    // 生成威胁序列
    const sequences = this._generateThreatSequences(threats);

    for (const sequence of sequences) {
      if (performance.now() - startTime > timeLimit) {
        break;
      }

      const score = await this._evaluateSequence(gameState, ruleEngine, sequence);
      nodesSearched++;

      if (score > bestScore) {
        bestScore = score;
        bestMove = sequence[0]; // 序列中的第一步
      }

      if (onProgress) {
        const progress = (nodesSearched / sequences.length) * 100;
        onProgress(Math.min(progress, 100));
      }
    }

    return {
      position: bestMove,
      score: bestScore,
      nodesSearched,
      threats,
      sequences: sequences.length
    };
  }

  /**
   * 基础位置评估
   * @private
   */
  _evaluateBasicPosition(gameState, ruleEngine, x, y) {
    const player = gameState.currentPlayer;
    const opponent = player === 1 ? 2 : 1;

    // 评估自己的位置
    const myScore = ruleEngine.evaluatePosition(gameState, x, y, player);

    // 评估对对手的威胁（防守价值）
    const tempState = this._createTempState(gameState);
    tempState.currentPlayer = opponent;
    const opponentScore = ruleEngine.evaluatePosition(tempState, x, y, opponent);

    // 综合评分
    return myScore + opponentScore * 0.8;
  }

  /**
   * 完整位置评估
   * @private
   */
  _evaluatePosition(gameState, ruleEngine, lastX, lastY) {
    const winner = gameState.winner;
    const player = gameState.currentPlayer;

    // 胜负判定
    if (winner === player) {
      return 100000;
    } else if (winner === (player === 1 ? 2 : 1)) {
      return -100000;
    }

    // 综合评估
    let totalScore = 0;
    const boardSize = gameState.boardSize;

    // 遍历所有位置评估
    for (let x = 0; x < boardSize; x++) {
      for (let y = 0; y < boardSize; y++) {
        const piece = gameState.getPiece(x, y);
        if (piece === 0) {
          continue;
        }

        const analysis = ruleEngine.analyzePattern(gameState, x, y, piece);
        const multiplier = piece === player ? 1 : -1;
        totalScore += analysis.score * multiplier;
      }
    }

    // 位置价值（中心位置更有价值）
    if (lastX !== undefined && lastY !== undefined) {
      const centerDistance = Math.abs(lastX - 7) + Math.abs(lastY - 7);
      totalScore += (14 - centerDistance) * 10;
    }

    return totalScore;
  }

  /**
   * 分析威胁
   * @private
   */
  async _analyzeThreats(gameState, ruleEngine) {
    const threats = {
      critical: [],  // 直接威胁（必须防守）
      serious: [],   // 严重威胁
      moderate: []   // 一般威胁
    };

    const availableMoves = ruleEngine.getAvailableMoves(gameState, { range: 2 });

    for (const move of availableMoves) {
      // 模拟对手落子
      const tempState = this._createTempState(gameState);
      const opponent = gameState.currentPlayer === 1 ? 2 : 1;
      tempState.currentPlayer = opponent;
      tempState.applyMove(move.x, move.y, { silent: true });

      // 检查是否形成威胁
      const winCheck = ruleEngine.checkWin(tempState, move.x, move.y, opponent);
      const analysis = ruleEngine.analyzePattern(tempState, move.x, move.y, opponent);

      const threat = {
        position: { x: move.x, y: move.y },
        score: analysis.score,
        isWin: winCheck.isWin,
        patterns: analysis.patterns
      };

      if (winCheck.isWin) {
        threats.critical.push(threat);
      } else if (analysis.patternCount.liveFour > 0 || analysis.patternCount.rushFour > 1) {
        threats.serious.push(threat);
      } else if (analysis.patternCount.liveThree > 1) {
        threats.moderate.push(threat);
      }
    }

    return threats;
  }

  /**
   * 生成威胁序列
   * @private
   */
  _generateThreatSequences(threats) {
    const sequences = [];

    // 生成进攻序列
    threats.critical.forEach(threat => {
      sequences.push([threat.position]);
    });

    // 生成组合序列
    for (let i = 0; i < threats.serious.length; i++) {
      for (let j = i + 1; j < threats.serious.length; j++) {
        sequences.push([
          threats.serious[i].position,
          threats.serious[j].position
        ]);
      }
    }

    return sequences;
  }

  /**
   * 评估威胁序列
   * @private
   */
  async _evaluateSequence(gameState, ruleEngine, sequence) {
    let totalScore = 0;
    let tempState = gameState;

    for (const move of sequence) {
      tempState = this._createTempState(tempState);
      tempState.applyMove(move.x, move.y, { silent: true });

      const analysis = ruleEngine.analyzePattern(tempState, move.x, move.y, tempState.currentPlayer);
      totalScore += analysis.score;
    }

    return totalScore;
  }

  /**
   * 创建临时游戏状态
   * @private
   */
  _createTempState(gameState) {
    const tempState = Object.create(gameState.constructor.prototype);
    Object.assign(tempState, gameState.getSnapshot());
    tempState.eventBus = gameState.eventBus;
    return tempState;
  }

  /**
   * 模拟思考时间
   * @private
   */
  async _simulateThinking(minTime, maxTime) {
    const delay = minTime + Math.random() * (maxTime - minTime);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * 停止当前思考
   */
  stopThinking() {
    if (this.isThinking) {
      this.isThinking = false;
      this.logger.info('AI thinking stopped');
      this.eventBus.emit('ai:thinkingStopped');
    }
  }

  /**
   * 获取AI状态
   * @returns {Object} AI状态
   */
  getStatus() {
    return {
      isThinking: this.isThinking,
      currentThinking: this.currentThinking,
      supportedDifficulties: Object.values(this.DIFFICULTY)
    };
  }
}

// 模块元信息
AIEngine.__moduleInfo = {
  name: 'AIEngine',
  version: '2.0.0',
  dependencies: ['EventBus', 'Logger'],
  description: 'AI引擎，提供不同难度的AI策略'
};

// 导出模块
if (typeof window !== 'undefined') {
  window.AIEngine = AIEngine;
}
