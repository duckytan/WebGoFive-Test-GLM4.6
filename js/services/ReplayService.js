/**
 * 回放服务 - 处理游戏回放功能
 *
 * 职责：
 * - 回放控制和状态管理
 * - 回放速度控制
 * - 回放事件处理
 * - 回放数据管理
 */

class ReplayService {
  constructor(eventBus) {
    // 验证依赖
    if (!eventBus) {
      throw new Error('ReplayService requires EventBus instance');
    }

    this.eventBus = eventBus;
    this.logger = logger.createModuleLogger('ReplayService');

    // 回放状态
    this.state = {
      isReplaying: false,
      isPaused: true,
      currentStep: 0,
      totalSteps: 0,
      speed: 1.0,
      autoPlay: false,
      moveHistory: [],
      originalGameState: null,
      replayGameState: null,
      timer: null
    };

    // 回放配置
    this.config = {
      minSpeed: 0.5,
      maxSpeed: 3.0,
      speedStep: 0.5,
      defaultSpeed: 1.0,
      stepDelay: 1000, // 基础延迟（毫秒）
      rewindThreshold: 5 // 快退阈值
    };

    this.logger.info('ReplayService initialized');
  }

  /**
   * 开始回放
   * @param {Object} gameState - 游戏状态
   * @param {Object} options - 选项
   * @returns {Object} 回放结果
   */
  startReplay(gameState, options = {}) {
    try {
      // 验证游戏状态
      if (!gameState || !gameState.moveHistory || gameState.moveHistory.length === 0) {
        throw new Error('No moves to replay');
      }

      // 保存原始游戏状态
      this.state.originalGameState = gameState.getSnapshot();

      // 初始化回放状态
      this.state.moveHistory = [...gameState.moveHistory];
      this.state.totalSteps = gameState.moveHistory.length;
      this.state.currentStep = 0;
      this.state.isReplaying = true;
      this.state.isPaused = true;
      this.state.speed = options.speed || this.config.defaultSpeed;
      this.state.autoPlay = options.autoPlay || false;

      // 创建回专用游戏状态
      this.state.replayGameState = this._createReplayGameState(gameState);

      // 重置到初始状态
      this._resetToStep(0);

      this.logger.info('Replay started', {
        totalSteps: this.state.totalSteps,
        autoPlay: this.state.autoPlay,
        speed: this.state.speed
      });

      this.eventBus.emit('replay:started', {
        totalSteps: this.state.totalSteps,
        currentStep: 0,
        moveHistory: this.state.moveHistory
      });

      // 如果自动播放，开始播放
      if (this.state.autoPlay) {
        this.play();
      }

      return {
        success: true,
        totalSteps: this.state.totalSteps,
        currentStep: 0,
        isPlaying: !this.state.isPaused
      };

    } catch (error) {
      this.logger.error('Start replay failed', { error: error.message });
      this.eventBus.emit('replay:failed', error);

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 停止回放
   * @returns {Object} 停止结果
   */
  stopReplay() {
    try {
      if (!this.state.isReplaying) {
        return { success: true, message: 'No replay in progress' };
      }

      // 停止自动播放
      this.pause();

      // 恢复原始游戏状态
      if (this.state.originalGameState) {
        this.eventBus.emit('replay:restoreOriginal', this.state.originalGameState);
      }

      // 清理状态
      this._cleanup();

      this.logger.info('Replay stopped');
      this.eventBus.emit('replay:stopped');

      return {
        success: true,
        message: 'Replay stopped'
      };

    } catch (error) {
      this.logger.error('Stop replay failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 播放回放
   * @returns {Object} 播放结果
   */
  play() {
    try {
      if (!this.state.isReplaying) {
        throw new Error('No replay in progress');
      }

      if (!this.state.isPaused) {
        return { success: true, message: 'Already playing' };
      }

      this.state.isPaused = false;
      this.state.autoPlay = true;

      // 开始自动播放
      this._startAutoPlay();

      this.logger.info('Replay playing');
      this.eventBus.emit('replay:playing', {
        currentStep: this.state.currentStep,
        speed: this.state.speed
      });

      return {
        success: true,
        isPlaying: true,
        currentStep: this.state.currentStep,
        speed: this.state.speed
      };

    } catch (error) {
      this.logger.error('Play replay failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 暂停回放
   * @returns {Object} 暂停结果
   */
  pause() {
    try {
      if (!this.state.isReplaying || this.state.isPaused) {
        return { success: true, message: 'Replay already paused' };
      }

      this.state.isPaused = true;
      this.state.autoPlay = false;

      // 停止自动播放
      this._stopAutoPlay();

      this.logger.info('Replay paused');
      this.eventBus.emit('replay:paused', {
        currentStep: this.state.currentStep
      });

      return {
        success: true,
        isPlaying: false,
        currentStep: this.state.currentStep
      };

    } catch (error) {
      this.logger.error('Pause replay failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 下一步
   * @returns {Object} 步进结果
   */
  nextStep() {
    try {
      if (!this.state.isReplaying) {
        throw new Error('No replay in progress');
      }

      if (this.state.currentStep >= this.state.totalSteps) {
        return { success: true, message: 'Already at last step', isEnd: true };
      }

      // 暂停自动播放
      if (!this.state.isPaused) {
        this.pause();
      }

      // 执行下一步
      const nextStepIndex = this.state.currentStep + 1;
      this._executeStep(nextStepIndex);

      this.state.currentStep = nextStepIndex;

      this.logger.info('Replay next step', { step: nextStepIndex });
      this.eventBus.emit('replay:stepForward', {
        step: nextStepIndex,
        move: this.state.moveHistory[nextStepIndex - 1],
        isEnd: nextStepIndex >= this.state.totalSteps
      });

      return {
        success: true,
        currentStep: nextStepIndex,
        move: this.state.moveHistory[nextStepIndex - 1],
        isEnd: nextStepIndex >= this.state.totalSteps
      };

    } catch (error) {
      this.logger.error('Next step failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 上一步
   * @returns {Object} 步退结果
   */
  prevStep() {
    try {
      if (!this.state.isReplaying) {
        throw new Error('No replay in progress');
      }

      if (this.state.currentStep <= 0) {
        return { success: true, message: 'Already at first step', isStart: true };
      }

      // 暂停自动播放
      if (!this.state.isPaused) {
        this.pause();
      }

      // 回退到上一步
      const prevStepIndex = this.state.currentStep - 1;
      this._resetToStep(prevStepIndex);

      this.state.currentStep = prevStepIndex;

      this.logger.info('Replay previous step', { step: prevStepIndex });
      this.eventBus.emit('replay:stepBackward', {
        step: prevStepIndex,
        isStart: prevStepIndex <= 0
      });

      return {
        success: true,
        currentStep: prevStepIndex,
        isStart: prevStepIndex <= 0
      };

    } catch (error) {
      this.logger.error('Previous step failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 跳转到指定步骤
   * @param {number} step - 目标步骤
   * @returns {Object} 跳转结果
   */
  jumpToStep(step) {
    try {
      if (!this.state.isReplaying) {
        throw new Error('No replay in progress');
      }

      if (step < 0 || step > this.state.totalSteps) {
        throw new Error(`Invalid step: ${step}, must be between 0 and ${this.state.totalSteps}`);
      }

      // 暂停自动播放
      if (!this.state.isPaused) {
        this.pause();
      }

      // 跳转到指定步骤
      this._resetToStep(step);
      this.state.currentStep = step;

      this.logger.info('Replay jump to step', { step });
      this.eventBus.emit('replay:jumped', {
        step,
        isStart: step <= 0,
        isEnd: step >= this.state.totalSteps
      });

      return {
        success: true,
        currentStep: step,
        isStart: step <= 0,
        isEnd: step >= this.state.totalSteps
      };

    } catch (error) {
      this.logger.error('Jump to step failed', { step, error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 设置回放速度
   * @param {number} speed - 播放速度
   * @returns {Object} 设置结果
   */
  setSpeed(speed) {
    try {
      if (speed < this.config.minSpeed || speed > this.config.maxSpeed) {
        throw new Error(`Speed must be between ${this.config.minSpeed} and ${this.config.maxSpeed}`);
      }

      const oldSpeed = this.state.speed;
      this.state.speed = speed;

      // 如果正在播放，重新启动定时器
      if (!this.state.isPaused) {
        this._stopAutoPlay();
        this._startAutoPlay();
      }

      this.logger.info('Replay speed changed', { oldSpeed, newSpeed: speed });
      this.eventBus.emit('replay:speedChanged', {
        oldSpeed,
        newSpeed: speed
      });

      return {
        success: true,
        oldSpeed,
        newSpeed: speed
      };

    } catch (error) {
      this.logger.error('Set speed failed', { speed, error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取回放状态
   * @returns {Object} 回放状态
   */
  getReplayState() {
    return {
      ...this.state,
      progress: this.state.totalSteps > 0 ? this.state.currentStep / this.state.totalSteps : 0,
      canPlay: this.state.isReplaying && this.state.isPaused && this.state.currentStep < this.state.totalSteps,
      canPause: this.state.isReplaying && !this.state.isPaused,
      canNext: this.state.isReplaying && this.state.currentStep < this.state.totalSteps,
      canPrev: this.state.isReplaying && this.state.currentStep > 0,
      isAtStart: this.state.currentStep <= 0,
      isAtEnd: this.state.currentStep >= this.state.totalSteps
    };
  }

  /**
   * 获取回放统计
   * @returns {Object} 回放统计
   */
  getReplayStats() {
    if (!this.state.isReplaying) {
      return null;
    }

    const stats = {
      totalSteps: this.state.totalSteps,
      currentStep: this.state.currentStep,
      progress: this.state.totalSteps > 0 ? (this.state.currentStep / this.state.totalSteps * 100).toFixed(1) : 0,
      speed: this.state.speed,
      isPlaying: !this.state.isPaused,
      duration: 0 // 可以计算实际播放时长
    };

    // 计算黑白棋步数
    if (this.state.moveHistory.length > 0) {
      stats.blackMoves = this.state.moveHistory.filter((move, index) => index % 2 === 0).length;
      stats.whiteMoves = this.state.moveHistory.filter((move, index) => index % 2 === 1).length;
    }

    return stats;
  }

  /**
   * 创建回放专用游戏状态
   * @private
   */
  _createReplayGameState(originalState) {
    // 创建新的游戏状态实例用于回放
    const replayState = Object.create(originalState.constructor.prototype);

    // 复制原始状态但不包含历史
    const snapshot = originalState.getSnapshot();
    snapshot.moveHistory = [];
    snapshot.moveCount = 0;
    snapshot.gameStatus = 'ready';
    snapshot.startTime = null;
    snapshot.endTime = null;

    Object.assign(replayState, snapshot);
    replayState.eventBus = this.eventBus;

    return replayState;
  }

  /**
   * 重置到指定步骤
   * @private
   */
  _resetToStep(step) {
    // 重置游戏状态
    this.state.replayGameState.reset();

    // 执行到指定步骤前的所有落子
    for (let i = 0; i < step; i++) {
      const move = this.state.moveHistory[i];
      this.state.replayGameState.applyMove(move.x, move.y, { silent: true });
      this.state.replayGameState.switchPlayer();
    }

    // 触发状态更新事件
    this.eventBus.emit('replay:stateUpdated', {
      step,
      gameState: this.state.replayGameState.getSnapshot()
    });
  }

  /**
   * 执行指定步骤
   * @private
   */
  _executeStep(step) {
    const move = this.state.moveHistory[step - 1];

    // 应用落子
    this.state.replayGameState.applyMove(move.x, move.y, { silent: true });

    // 触发落子事件
    this.eventBus.emit('replay:moveApplied', {
      step,
      move,
      gameState: this.state.replayGameState.getSnapshot()
    });

    // 检查游戏是否结束
    if (step >= this.state.totalSteps) {
      this.pause();
      this.eventBus.emit('replay:finished');
    }
  }

  /**
   * 开始自动播放
   * @private
   */
  _startAutoPlay() {
    if (this.state.timer) {
      clearInterval(this.state.timer);
    }

    const delay = this.config.stepDelay / this.state.speed;

    this.state.timer = setInterval(() => {
      if (this.state.currentStep >= this.state.totalSteps) {
        this.pause();
        this.eventBus.emit('replay:finished');
        return;
      }

      this.nextStep();
    }, delay);
  }

  /**
   * 停止自动播放
   * @private
   */
  _stopAutoPlay() {
    if (this.state.timer) {
      clearInterval(this.state.timer);
      this.state.timer = null;
    }
  }

  /**
   * 清理回放状态
   * @private
   */
  _cleanup() {
    this._stopAutoPlay();

    this.state = {
      isReplaying: false,
      isPaused: true,
      currentStep: 0,
      totalSteps: 0,
      speed: 1.0,
      autoPlay: false,
      moveHistory: [],
      originalGameState: null,
      replayGameState: null,
      timer: null
    };
  }

  /**
   * 导出回放数据
   * @param {string} format - 导出格式
   * @returns {string} 导出数据
   */
  exportReplay(format = 'json') {
    try {
      if (!this.state.isReplaying) {
        throw new Error('No replay in progress');
      }

      const replayData = {
        version: '2.0.0',
        timestamp: Date.now(),
        originalGameState: this.state.originalGameState,
        moveHistory: this.state.moveHistory,
        metadata: {
          totalSteps: this.state.totalSteps,
          currentStep: this.state.currentStep,
          speed: this.state.speed
        }
      };

      if (format === 'json') {
        return JSON.stringify(replayData, null, 2);
      } else if (format === 'base64') {
        const json = JSON.stringify(replayData);
        return btoa(unescape(encodeURIComponent(json)));
      } else {
        throw new Error(`Unsupported export format: ${format}`);
      }

    } catch (error) {
      this.logger.error('Export replay failed', { format, error: error.message });
      throw error;
    }
  }

  /**
   * 销毁回放服务
   */
  destroy() {
    this.stopReplay();
    this.logger.info('ReplayService destroyed');
  }
}

// 模块元信息
ReplayService.__moduleInfo = {
  name: 'ReplayService',
  version: '2.0.0',
  dependencies: ['EventBus', 'Logger'],
  description: '回放服务，处理游戏回放功能'
};

// 导出模块
if (typeof window !== 'undefined') {
  window.ReplayService = ReplayService;
}
