/**
 * 模式管理器 - 管理游戏模式和流程控制
 *
 * 职责：
 * - 游戏模式切换和管理
 * - 游戏流程控制
 * - 玩家回合管理
 * - AI对手控制
 */

class ModeManager {
  constructor(eventBus) {
    // 验证依赖
    if (!eventBus) {
      throw new Error('ModeManager requires EventBus instance');
    }

    this.eventBus = eventBus;
    this.logger = logger.createModuleLogger('ModeManager');

    // 游戏模式
    this.MODES = {
      PVP: 'PvP', // 双人对战
      PVE: 'PvE', // 人机对战
      EVE: 'EvE'  // 机机对战
    };

    // 管理器状态
    this.state = {
      currentMode: this.MODES.PVP,
      isGameActive: false,
      isAIThinking: false,
      currentPlayer: 1,
      gamePhase: 'waiting', // waiting, playing, finished, paused
      aiConfig: {
        black: 'NORMAL',
        white: 'NORMAL'
      }
    };

    // 组件引用（稍后设置）
    this.gameState = null;
    this.ruleEngine = null;
    this.aiEngine = null;

    // AI思考控制器
    this.aiController = {
      currentTask: null,
      abortController: null
    };

    // 绑定事件处理器
    this._bindEventHandlers();

    this.logger.info('ModeManager initialized');
  }

  /**
   * 设置组件引用
   * @param {Object} components - 组件对象
   */
  setComponents(components) {
    this.gameState = components.gameState;
    this.ruleEngine = components.ruleEngine;
    this.aiEngine = components.aiEngine;

    this.logger.info('Components set');
  }

  /**
   * 切换游戏模式
   * @param {string} mode - 游戏模式
   * @param {Object} options - 选项
   * @returns {Object} 切换结果
   */
  switchMode(mode, options = {}) {
    try {
      if (!Object.values(this.MODES).includes(mode)) {
        throw new Error(`Invalid game mode: ${mode}`);
      }

      const oldMode = this.state.currentMode;

      // 如果游戏正在进行，需要先停止
      if (this.state.isGameActive) {
        this._stopCurrentGame();
      }

      // 切换模式
      this.state.currentMode = mode;
      this.gameState.setMode(mode);

      // 更新AI配置
      if (options.aiConfig) {
        this.state.aiConfig = { ...this.state.aiConfig, ...options.aiConfig };
      }

      this.logger.info('Game mode switched', { from: oldMode, to: mode });
      this.eventBus.emit('mode:changed', mode, oldMode);

      return {
        success: true,
        mode,
        previousMode: oldMode,
        message: `已切换到${this._getModeDisplayName(mode)}模式`
      };

    } catch (error) {
      this.logger.error('Switch mode failed', { mode, error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 开始新游戏
   * @param {Object} options - 游戏选项
   * @returns {Object} 开始结果
   */
  startNewGame(options = {}) {
    try {
      if (this.state.isGameActive) {
        throw new Error('Game is already active');
      }

      // 重置游戏状态
      this.gameState.reset();

      // 应用游戏选项
      if (options.settings) {
        this.gameState.updateSettings(options.settings);
      }

      // 设置AI配置
      if (options.aiConfig) {
        this.state.aiConfig = { ...this.state.aiConfig, ...options.aiConfig };
      }

      // 更新状态
      this.state.isGameActive = true;
      this.state.gamePhase = 'playing';
      this.state.currentPlayer = this.gameState.settings.firstPlayer || 1;

      // 开始游戏流程
      this._startGameFlow();

      this.logger.info('New game started', {
        mode: this.state.currentMode,
        firstPlayer: this.state.currentPlayer,
        aiConfig: this.state.aiConfig
      });

      this.eventBus.emit('game:started', {
        mode: this.state.currentMode,
        firstPlayer: this.state.currentPlayer,
        aiConfig: this.state.aiConfig
      });

      return {
        success: true,
        mode: this.state.currentMode,
        currentPlayer: this.state.currentPlayer,
        message: '游戏开始'
      };

    } catch (error) {
      this.logger.error('Start new game failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 处理玩家落子
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @returns {Object} 落子结果
   */
  handlePlayerMove(x, y) {
    try {
      if (!this.state.isGameActive || this.state.gamePhase !== 'playing') {
        throw new Error('Game is not active or not in playing phase');
      }

      if (this.state.isAIThinking) {
        throw new Error('AI is thinking, please wait');
      }

      // 检查是否为当前玩家的回合
      if (!this._isPlayerTurn(this.gameState.currentPlayer)) {
        throw new Error('Not your turn');
      }

      // 验证落子
      const validation = this.ruleEngine.validateMove(this.gameState, x, y);
      if (!validation.valid) {
        throw new Error(validation.message);
      }

      // 执行落子
      const moveResult = this.gameState.applyMove(x, y);

      // 检查获胜
      const winCheck = this.ruleEngine.checkWin(this.gameState, x, y);
      if (winCheck.isWin) {
        this._handleGameWin(this.gameState.currentPlayer, winCheck);
        return {
          success: true,
          move: moveResult.move,
          gameEnded: true,
          winner: this.gameState.currentPlayer,
          winLine: winCheck.winLine
        };
      }

      // 检查平局
      if (this._checkDraw()) {
        this._handleGameDraw();
        return {
          success: true,
          move: moveResult.move,
          gameEnded: true,
          isDraw: true
        };
      }

      // 切换玩家
      this.gameState.switchPlayer();
      this.state.currentPlayer = this.gameState.currentPlayer;

      // 继续游戏流程
      this._continueGameFlow();

      this.logger.info('Player move executed', { x, y, player: moveResult.move.player });
      this.eventBus.emit('move:playerExecuted', moveResult.move, this.state.currentPlayer);

      return {
        success: true,
        move: moveResult.move,
        nextPlayer: this.state.currentPlayer
      };

    } catch (error) {
      this.logger.error('Handle player move failed', { x, y, error: error.message });
      this.eventBus.emit('move:playerFailed', { x, y, error: error.message });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 处理悔棋
   * @returns {Object} 悔棋结果
   */
  handleUndo() {
    try {
      if (!this.state.isGameActive) {
        throw new Error('No game in progress');
      }

      // 如果AI正在思考，停止它
      if (this.state.isAIThinking) {
        this._stopAIThinking();
      }

      // 撤回上一步
      const undoResult = this.gameState.undoMove();

      if (!undoResult.success) {
        throw new Error(undoResult.reason);
      }

      // 更新当前玩家
      this.state.currentPlayer = this.gameState.currentPlayer;

      // 重新开始游戏流程
      this._continueGameFlow();

      this.logger.info('Undo executed', undoResult.undoneMove);
      this.eventBus.emit('move:undone', undoResult.undoneMove, this.state.currentPlayer);

      return {
        success: true,
        undoneMove: undoResult.undoneMove,
        currentPlayer: this.state.currentPlayer
      };

    } catch (error) {
      this.logger.error('Handle undo failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 处理提示请求
   * @returns {Object} 提示结果
   */
  handleHint() {
    try {
      if (!this.state.isGameActive) {
        throw new Error('No game in progress');
      }

      if (this.state.isAIThinking) {
        throw new Error('AI is thinking, please wait');
      }

      // 获取可用位置
      const availableMoves = this.ruleEngine.getAvailableMoves(this.gameState);
      if (availableMoves.length === 0) {
        throw new Error('No available moves');
      }

      // 评估每个位置
      const evaluatedMoves = availableMoves.map(move => ({
        ...move,
        score: this.ruleEngine.evaluatePosition(this.gameState, move.x, move.y, this.gameState.currentPlayer)
      }));

      // 按分数排序，返回最佳位置
      evaluatedMoves.sort((a, b) => b.score - a.score);
      const bestMove = evaluatedMoves[0];

      this.logger.info('Hint generated', { position: bestMove, score: bestMove.score });
      this.eventBus.emit('hint:generated', bestMove);

      return {
        success: true,
        hint: bestMove,
        alternatives: evaluatedMoves.slice(0, 5)
      };

    } catch (error) {
      this.logger.error('Handle hint failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 暂停游戏
   * @returns {Object} 暂停结果
   */
  pauseGame() {
    try {
      if (!this.state.isGameActive || this.state.gamePhase !== 'playing') {
        throw new Error('No active game to pause');
      }

      // 停止AI思考
      if (this.state.isAIThinking) {
        this._stopAIThinking();
      }

      this.state.gamePhase = 'paused';
      this.gameState.setGameStatus('paused');

      this.logger.info('Game paused');
      this.eventBus.emit('game:paused');

      return {
        success: true,
        message: '游戏已暂停'
      };

    } catch (error) {
      this.logger.error('Pause game failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 恢复游戏
   * @returns {Object} 恢复结果
   */
  resumeGame() {
    try {
      if (!this.state.isGameActive || this.state.gamePhase !== 'paused') {
        throw new Error('No paused game to resume');
      }

      this.state.gamePhase = 'playing';
      this.gameState.setGameStatus('playing');

      // 继续游戏流程
      this._continueGameFlow();

      this.logger.info('Game resumed');
      this.eventBus.emit('game:resumed');

      return {
        success: true,
        message: '游戏已恢复'
      };

    } catch (error) {
      this.logger.error('Resume game failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 停止当前游戏
   * @returns {Object} 停止结果
   */
  stopCurrentGame() {
    try {
      if (!this.state.isGameActive) {
        return { success: true, message: 'No game in progress' };
      }

      this._stopCurrentGame();

      this.logger.info('Current game stopped');
      this.eventBus.emit('game:stopped');

      return {
        success: true,
        message: '游戏已停止'
      };

    } catch (error) {
      this.logger.error('Stop game failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取模式管理器状态
   * @returns {Object} 状态信息
   */
  getStatus() {
    return {
      ...this.state,
      modeDisplayName: this._getModeDisplayName(this.state.currentMode),
      isPlayerTurn: this._isPlayerTurn(this.state.currentPlayer),
      isAITurn: this._isAITurn(this.state.currentPlayer),
      canUndo: this.state.isGameActive && this.gameState.moveHistory.length > 0,
      canHint: this.state.isGameActive && !this.state.isAIThinking
    };
  }

  /**
   * 开始游戏流程
   * @private
   */
  _startGameFlow() {
    this.gameState.setGameStatus('playing');

    // 如果是AI先手，开始AI思考
    if (this._isAITurn(this.state.currentPlayer)) {
      this._startAIThinking();
    }
  }

  /**
   * 继续游戏流程
   * @private
   */
  _continueGameFlow() {
    // 检查是否为AI回合
    if (this._isAITurn(this.state.currentPlayer)) {
      this._startAIThinking();
    }
  }

  /**
   * 开始AI思考
   * @private
   */
  async _startAIThinking() {
    try {
      this.state.isAIThinking = true;
      this.aiController.abortController = new AbortController();

      const player = this.state.currentPlayer;
      const aiDifficulty = this._getAIDifficulty(player);

      this.logger.info('AI thinking started', { player, difficulty: aiDifficulty });
      this.eventBus.emit('ai:turnStarted', player, aiDifficulty);

      // 计算AI落子
      const result = await this.aiEngine.calculateBestMove(
        this.gameState,
        this.ruleEngine,
        aiDifficulty,
        {
          signal: this.aiController.abortController.signal,
          onProgress: (progress) => {
            this.eventBus.emit('ai:thinkingProgress', progress);
          }
        }
      );

      // 检查是否被中止
      if (this.aiController.abortController.signal.aborted) {
        throw new Error('AI thinking was aborted');
      }

      // 执行AI落子
      const moveResult = this.gameState.applyMove(result.position.x, result.position.y);

      // 检查获胜
      const winCheck = this.ruleEngine.checkWin(this.gameState, result.position.x, result.position.y, player);
      if (winCheck.isWin) {
        this._handleGameWin(player, winCheck);
        return;
      }

      // 检查平局
      if (this._checkDraw()) {
        this._handleGameDraw();
        return;
      }

      // 切换玩家
      this.gameState.switchPlayer();
      this.state.currentPlayer = this.gameState.currentPlayer;

      this.state.isAIThinking = false;

      this.logger.info('AI move executed', {
        player,
        position: result.position,
        score: result.score,
        nextPlayer: this.state.currentPlayer
      });

      this.eventBus.emit('move:aiExecuted', {
        player,
        move: moveResult.move,
        aiResult: result,
        nextPlayer: this.state.currentPlayer
      });

      // 继续游戏流程
      this._continueGameFlow();

    } catch (error) {
      this.state.isAIThinking = false;
      this.logger.error('AI thinking failed', { error: error.message });
      this.eventBus.emit('ai:thinkingFailed', error);
    }
  }

  /**
   * 停止AI思考
   * @private
   */
  _stopAIThinking() {
    if (this.aiController.abortController) {
      this.aiController.abortController.abort();
      this.aiController.abortController = null;
    }

    this.state.isAIThinking = false;
    this.aiEngine.stopThinking();

    this.logger.info('AI thinking stopped');
    this.eventBus.emit('ai:thinkingStopped');
  }

  /**
   * 停止当前游戏
   * @private
   */
  _stopCurrentGame() {
    // 停止AI思考
    if (this.state.isAIThinking) {
      this._stopAIThinking();
    }

    // 更新状态
    this.state.isGameActive = false;
    this.state.gamePhase = 'waiting';
    this.gameState.setGameStatus('finished');
  }

  /**
   * 处理游戏获胜
   * @private
   */
  _handleGameWin(winner, winCheck) {
    this.state.gamePhase = 'finished';
    this.gameState.setWinner(winner, winCheck.winLine);
    this._stopCurrentGame();

    this.logger.info('Game won', { winner, winLine: winCheck.winLine });
    this.eventBus.emit('game:won', winner, winCheck, this.gameState.getSnapshot());
  }

  /**
   * 处理游戏平局
   * @private
   */
  _handleGameDraw() {
    this.state.gamePhase = 'finished';
    this.gameState.setWinner(null);
    this._stopCurrentGame();

    this.logger.info('Game drawn');
    this.eventBus.emit('game:drawn', this.gameState.getSnapshot());
  }

  /**
   * 检查是否为平局
   * @private
   */
  _checkDraw() {
    const boardSize = this.gameState.boardSize;
    const totalCells = boardSize * boardSize;
    return this.gameState.moveHistory.length >= totalCells;
  }

  /**
   * 检查是否为玩家回合
   * @private
   */
  _isPlayerTurn(player) {
    if (this.state.currentMode === this.MODES.PVP) {
      return true; // 双人模式都是玩家
    } else if (this.state.currentMode === this.MODES.PVE) {
      return player === 1; // 人机模式，玩家执黑
    } else {
      return false; // 机机模式没有玩家回合
    }
  }

  /**
   * 检查是否为AI回合
   * @private
   */
  _isAITurn(player) {
    if (this.state.currentMode === this.MODES.PVP) {
      return false; // 双人模式没有AI
    } else if (this.state.currentMode === this.MODES.PVE) {
      return player === 2; // 人机模式，AI执白
    } else {
      return true; // 机机模式都是AI
    }
  }

  /**
   * 获取AI难度
   * @private
   */
  _getAIDifficulty(player) {
    if (player === 1) {
      return this.state.aiConfig.black;
    } else {
      return this.state.aiConfig.white;
    }
  }

  /**
   * 获取模式显示名称
   * @private
   */
  _getModeDisplayName(mode) {
    const names = {
      [this.MODES.PVP]: '双人对战',
      [this.MODES.PVE]: '人机对战',
      [this.MODES.EVE]: '机机对战'
    };
    return names[mode] || mode;
  }

  /**
   * 绑定事件处理器
   * @private
   */
  _bindEventHandlers() {
    // UI事件
    this.eventBus.on('ui:modeChanged', (mode) => {
      this.switchMode(mode);
    });

    this.eventBus.on('ui:newGameRequested', () => {
      this.startNewGame();
    });

    this.eventBus.on('ui:undoRequested', () => {
      this.handleUndo();
    });

    this.eventBus.on('ui:hintRequested', () => {
      this.handleHint();
    });

    this.eventBus.on('ui:aiLevelChanged', (color, level) => {
      this.state.aiConfig[color] = level;
      this.logger.info('AI level changed', { color, level });
    });

    // Canvas事件
    this.eventBus.on('canvas:click', (position) => {
      this.handlePlayerMove(position.x, position.y);
    });

    // 游戏事件
    this.eventBus.on('game:finished', () => {
      this._stopCurrentGame();
    });
  }

  /**
   * 销毁模式管理器
   */
  destroy() {
    this._stopCurrentGame();
    this.logger.info('ModeManager destroyed');
  }
}

// 模块元信息
ModeManager.__moduleInfo = {
  name: 'ModeManager',
  version: '2.0.0',
  dependencies: ['EventBus', 'Logger'],
  description: '模式管理器，管理游戏模式和流程控制'
};

// 导出模块
if (typeof window !== 'undefined') {
  window.ModeManager = ModeManager;
}
