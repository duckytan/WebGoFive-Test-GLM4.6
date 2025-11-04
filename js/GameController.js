/**
 * 游戏控制器 - 协调各个模块，提供统一的API
 *
 * 职责：
 * - 初始化和协调各个模块
 * - 提供统一的游戏API
 * - 处理模块间通信
 * - 管理应用生命周期
 */

class GameController {
  constructor() {
    // Safety check for logger
    if (typeof logger === 'undefined') {
      console.error('Logger not available when creating GameController');
      this.logger = {
        info: (msg, data) => console.log('[GameController]', msg, data),
        error: (msg, data) => console.error('[GameController]', msg, data),
        warn: (msg, data) => console.warn('[GameController]', msg, data),
        performance: (op, start) => console.log('[GameController]', `Performance: ${op} took ${Date.now() - start}ms`)
      };
    } else {
      this.logger = logger.createModuleLogger('GameController');
    }

    // 模块实例
    this.modules = {
      eventBus: null,
      gameState: null,
      ruleEngine: null,
      aiEngine: null,
      canvasRenderer: null,
      hudPanel: null,
      saveLoadService: null,
      replayService: null,
      modeManager: null
    };

    // 应用状态
    this.appState = {
      initialized: false,
      componentsReady: false,
      gameActive: false,
      currentView: 'game' // game, replay, menu
    };

    // 配置
    this.config = {
      autoSave: true,
      autoSaveInterval: 60000, // 1分钟
      debugMode: false,
      performanceMonitoring: true
    };

    // 定时器
    this.timers = {
      autoSave: null
    };

    this.logger.info('GameController created');
  }

  /**
   * 初始化应用
   * @param {Object} options - 初始化选项
   * @returns {Promise<Object>} 初始化结果
   */
  async initialize(options = {}) {
    const startTime = performance.now();

    try {
      this.logger.info('Application initialization started');

      // 合并配置
      Object.assign(this.config, options);

      // 初始化事件总线
      await this._initializeEventBus();

      // 初始化核心模块
      await this._initializeCoreModules();

      // 初始化UI模块
      await this._initializeUIModules();

      // 初始化服务模块
      await this._initializeServiceModules();

      // 设置模块引用
      this._setupModuleReferences();

      // 绑定事件处理器
      this._bindEventHandlers();

      // 启动自动保存
      if (this.config.autoSave) {
        this._startAutoSave();
      }

      this.appState.initialized = true;
      this.appState.componentsReady = true;

      const duration = performance.now() - startTime;
      this.logger.performance('initialize', startTime);
      this.logger.info('Application initialization completed', { duration });

      // 触发初始化完成事件
      this.modules.eventBus.emit('app:initialized', {
        duration,
        modules: Object.keys(this.modules)
      });

      return {
        success: true,
        message: '应用初始化成功',
        duration,
        modules: Object.keys(this.modules)
      };

    } catch (error) {
      const duration = performance.now() - startTime;
      this.logger.error('Application initialization failed', { error: error.message, duration });

      return {
        success: false,
        error: error.message,
        message: '应用初始化失败'
      };
    }
  }

  /**
   * 启动应用
   * @returns {Object} 启动结果
   */
  start() {
    try {
      if (!this.appState.initialized) {
        throw new Error('Application not initialized');
      }

      this.logger.info('Application started');

      // 触发应用启动事件
      this.modules.eventBus.emit('app:started');

      // 尝试加载自动存档
      this._tryLoadAutoSave();

      return {
        success: true,
        message: '应用启动成功'
      };

    } catch (error) {
      this.logger.error('Application start failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 停止应用
   * @returns {Object} 停止结果
   */
  stop() {
    try {
      this.logger.info('Application stopping');

      // 停止定时器
      this._stopAutoSave();

      // 停止当前游戏
      if (this.modules.modeManager) {
        this.modules.modeManager.stopCurrentGame();
      }

      // 自动保存
      if (this.config.autoSave && this.modules.saveLoadService && this.modules.gameState) {
        this.modules.saveLoadService.autoSave(this.modules.gameState);
      }

      this.appState.gameActive = false;

      this.logger.info('Application stopped');

      return {
        success: true,
        message: '应用已停止'
      };

    } catch (error) {
      this.logger.error('Application stop failed', { error: error.message });
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
      if (!this.appState.componentsReady) {
        throw new Error('Application components not ready');
      }

      const result = this.modules.modeManager.startNewGame(options);

      if (result.success) {
        this.appState.gameActive = true;
        this.appState.currentView = 'game';
      }

      return result;

    } catch (error) {
      this.logger.error('Start new game failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 保存游戏
   * @param {Object} options - 保存选项
   * @returns {Promise<Object>} 保存结果
   */
  async saveGame(options = {}) {
    try {
      if (!this.modules.gameState) {
        throw new Error('Game state not available');
      }

      return await this.modules.saveLoadService.saveGame(this.modules.gameState, options);

    } catch (error) {
      this.logger.error('Save game failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 加载游戏
   * @param {string|number} slot - 存储槽位
   * @param {Object} options - 加载选项
   * @returns {Promise<Object>} 加载结果
   */
  async loadGame(slot, options = {}) {
    try {
      const result = await this.modules.saveLoadService.loadGame(slot, options);

      if (result.success) {
        // 恢复游戏状态
        this.modules.gameState.restoreSnapshot(result.saveData.gameState);

        // 更新应用状态
        this.appState.gameActive = true;
        this.appState.currentView = 'game';

        // 重新渲染
        this._renderGame();
      }

      return result;

    } catch (error) {
      this.logger.error('Load game failed', { slot, error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 开始回放
   * @param {Object} gameState - 游戏状态
   * @param {Object} options - 回放选项
   * @returns {Object} 回放结果
   */
  startReplay(gameState, options = {}) {
    try {
      const result = this.modules.replayService.startReplay(gameState, options);

      if (result.success) {
        this.appState.currentView = 'replay';
      }

      return result;

    } catch (error) {
      this.logger.error('Start replay failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取应用状态
   * @returns {Object} 应用状态
   */
  getApplicationState() {
    return {
      ...this.appState,
      config: { ...this.config },
      modules: Object.keys(this.modules).reduce((acc, key) => {
        acc[key] = !!this.modules[key];
        return acc;
      }, {})
    };
  }

  /**
   * 获取游戏状态
   * @returns {Object|null} 游戏状态
   */
  getGameState() {
    return this.modules.gameState ? this.modules.gameState.getSnapshot() : null;
  }

  /**
   * 获取游戏统计
   * @returns {Object|null} 游戏统计
   */
  getGameStats() {
    return this.modules.gameState ? this.modules.gameState.getStats() : null;
  }

  /**
   * 获取存档列表
   * @param {Object} options - 选项
   * @returns {Array} 存档列表
   */
  getSaveList(options = {}) {
    return this.modules.saveLoadService ? this.modules.saveLoadService.getSaveList(options) : [];
  }

  /**
   * 导出存档
   * @param {number} slot - 存储槽位
   * @param {string} format - 导出格式
   * @returns {string} 导出数据
   */
  exportSave(slot, format = 'json') {
    if (!this.modules.saveLoadService) {
      throw new Error('SaveLoadService not available');
    }
    return this.modules.saveLoadService.exportSave(slot, format);
  }

  /**
   * 导入存档
   * @param {string} data - 导入数据
   * @param {string} format - 数据格式
   * @param {Object} options - 导入选项
   * @returns {Promise<Object>} 导入结果
   */
  async importSave(data, format = 'json', options = {}) {
    if (!this.modules.saveLoadService) {
      throw new Error('SaveLoadService not available');
    }
    return await this.modules.saveLoadService.importSave(data, format, options);
  }

  /**
   * 切换调试模式
   * @param {boolean} enabled - 是否启用
   */
  setDebugMode(enabled) {
    this.config.debugMode = enabled;
    logger.setLevel(enabled ? Logger.LEVEL.DEBUG : Logger.LEVEL.INFO);

    this.logger.info('Debug mode changed', { enabled });
    this.modules.eventBus.emit('app:debugModeChanged', enabled);
  }

  /**
   * 获取性能统计
   * @returns {Object} 性能统计
   */
  getPerformanceStats() {
    if (!this.config.performanceMonitoring) {
      return null;
    }

    return {
      memory: performance.memory ? {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit
      } : null,
      timing: performance.timing ? {
        loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart,
        domReady: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart
      } : null,
      modules: Object.keys(this.modules).reduce((acc, key) => {
        if (this.modules[key] && typeof this.modules[key].getStatus === 'function') {
          acc[key] = this.modules[key].getStatus();
        }
        return acc;
      }, {})
    };
  }

  /**
   * 初始化事件总线
   * @private
   */
  async _initializeEventBus() {
    this.modules.eventBus = new EventBus();
    this.logger.info('EventBus initialized');
  }

  /**
   * 初始化核心模块
   * @private
   */
  async _initializeCoreModules() {
    // 游戏状态
    this.modules.gameState = new GameState(this.modules.eventBus);

    // 规则引擎
    this.modules.ruleEngine = new RuleEngine(this.modules.eventBus);

    // AI引擎
    this.modules.aiEngine = new AIEngine(this.modules.eventBus);

    this.logger.info('Core modules initialized');
  }

  /**
   * 初始化UI模块
   * @private
   */
  async _initializeUIModules() {
    // Canvas渲染器
    const canvas = document.getElementById('game-canvas');
    if (!canvas) {
      throw new Error('Game canvas not found');
    }
    this.modules.canvasRenderer = new CanvasRenderer(this.modules.eventBus, canvas);

    // HUD面板
    this.modules.hudPanel = new HudPanel(this.modules.eventBus);

    this.logger.info('UI modules initialized');
  }

  /**
   * 初始化服务模块
   * @private
   */
  async _initializeServiceModules() {
    // 存档加载服务
    this.modules.saveLoadService = new SaveLoadService(this.modules.eventBus);

    // 回放服务
    this.modules.replayService = new ReplayService(this.modules.eventBus);

    // 模式管理器
    this.modules.modeManager = new ModeManager(this.modules.eventBus);

    this.logger.info('Service modules initialized');
  }

  /**
   * 设置模块引用
   * @private
   */
  _setupModuleReferences() {
    // 为模式管理器设置组件引用
    this.modules.modeManager.setComponents({
      gameState: this.modules.gameState,
      ruleEngine: this.modules.ruleEngine,
      aiEngine: this.modules.aiEngine
    });

    this.logger.info('Module references set up');
  }

  /**
   * 绑定事件处理器
   * @private
   */
  _bindEventHandlers() {
    const eventBus = this.modules.eventBus;

    // 游戏状态变化 - 重新渲染
    eventBus.on('state:changed', () => {
      this._renderGame();
    });

    eventBus.on('move:applied', () => {
      this._renderGame();
    });

    eventBus.on('game:finished', () => {
      this._renderGame();
    });

    // UI事件 - 存档加载
    eventBus.on('ui:saveGameRequested', () => {
      this.saveGame();
    });

    eventBus.on('ui:loadGameRequested', () => {
      // 显示存档选择对话框
      this._showLoadGameDialog();
    });

    eventBus.on('ui:replayRequested', () => {
      if (this.modules.gameState) {
        this.startReplay(this.modules.gameState);
      }
    });

    // 回放事件
    eventBus.on('replay:stateUpdated', () => {
      this._renderGame();
    });

    // 错误处理
    eventBus.on('error', (error) => {
      this.logger.error('Application error', { error: error.message });
    });

    // 性能监控
    if (this.config.performanceMonitoring) {
      eventBus.on('move:applied', () => {
        this._checkPerformance();
      });
    }

    this.logger.info('Event handlers bound');
  }

  /**
   * 渲染游戏
   * @private
   */
  _renderGame() {
    if (this.modules.gameState && this.modules.canvasRenderer) {
      this.modules.canvasRenderer.render(this.modules.gameState);
    }
  }

  /**
   * 启动自动保存
   * @private
   */
  _startAutoSave() {
    if (this.timers.autoSave) {
      clearInterval(this.timers.autoSave);
    }

    this.timers.autoSave = setInterval(() => {
      if (this.appState.gameActive && this.modules.gameState) {
        this.modules.saveLoadService.autoSave(this.modules.gameState);
      }
    }, this.config.autoSaveInterval);

    this.logger.info('Auto save started', { interval: this.config.autoSaveInterval });
  }

  /**
   * 停止自动保存
   * @private
   */
  _stopAutoSave() {
    if (this.timers.autoSave) {
      clearInterval(this.timers.autoSave);
      this.timers.autoSave = null;
    }
  }

  /**
   * 尝试加载自动存档
   * @private
   */
  _tryLoadAutoSave() {
    try {
      const autoSave = this.modules.saveLoadService.getAutoSave();
      if (autoSave) {
        this.modules.gameState.restoreSnapshot(autoSave.gameState);
        this.appState.gameActive = true;
        this._renderGame();

        this.logger.info('Auto save loaded');
        this.modules.eventBus.emit('app:autoSaveLoaded');
      }
    } catch (error) {
      this.logger.error('Load auto save failed', { error: error.message });
    }
  }

  /**
   * 显示加载游戏对话框
   * @private
   */
  _showLoadGameDialog() {
    const saves = this.getSaveList({ excludeAuto: true });

    if (saves.length === 0) {
      this.modules.eventBus.emit('ui:showModal', '加载游戏', '没有可用的存档。');
      return;
    }

    // 创建存档列表HTML
    const saveListHTML = saves.map(save => `
      <div class="save-item" data-slot="${save.slot}">
        <div class="save-name">${save.name}</div>
        <div class="save-info">
          <span class="save-date">${new Date(save.timestamp).toLocaleString()}</span>
          <span class="save-mode">${save.mode}</span>
          <span class="save-moves">${save.moveCount}步</span>
        </div>
        <div class="save-description">${save.description || ''}</div>
      </div>
    `).join('');

    const content = `
      <div class="load-game-dialog">
        <div class="save-list">
          ${saveListHTML}
        </div>
      </div>
    `;

    // 显示模态框
    this.modules.eventBus.emit('ui:showModal', '加载游戏', content, [
      {
        text: '加载',
        class: 'modal-btn primary',
        onclick: () => {
          const selectedSave = document.querySelector('.save-item.selected');
          if (selectedSave) {
            const slot = parseInt(selectedSave.dataset.slot);
            this.loadGame(slot);
          }
        }
      },
      {
        text: '取消',
        class: 'modal-btn',
        onclick: () => {
          this.modules.eventBus.emit('ui:hideModal');
        }
      }
    ]);

    // 添加选择事件
    setTimeout(() => {
      document.querySelectorAll('.save-item').forEach(item => {
        item.addEventListener('click', () => {
          document.querySelectorAll('.save-item').forEach(i => i.classList.remove('selected'));
          item.classList.add('selected');
        });
      });
    }, 100);
  }

  /**
   * 检查性能
   * @private
   */
  _checkPerformance() {
    if (!this.config.performanceMonitoring) {
      return;
    }

    const stats = this.getPerformanceStats();
    if (stats && stats.memory) {
      const memoryUsage = stats.memory.used / stats.memory.total;

      if (memoryUsage > 0.8) {
        this.logger.warn('High memory usage detected', { usage: memoryUsage });
        this.modules.eventBus.emit('app:highMemoryUsage', memoryUsage);
      }
    }
  }

  /**
   * 销毁应用
   */
  destroy() {
    try {
      this.logger.info('Application destroying');

      // 停止应用
      this.stop();

      // 销毁所有模块
      Object.values(this.modules).forEach(module => {
        if (module && typeof module.destroy === 'function') {
          module.destroy();
        }
      });

      // 清理定时器
      Object.values(this.timers).forEach(timer => {
        if (timer) {
          clearInterval(timer);
        }
      });

      // 重置状态
      this.appState = {
        initialized: false,
        componentsReady: false,
        gameActive: false,
        currentView: 'game'
      };

      this.logger.info('Application destroyed');

    } catch (error) {
      this.logger.error('Application destroy failed', { error: error.message });
    }
  }
}

// 模块元信息
GameController.__moduleInfo = {
  name: 'GameController',
  version: '2.0.0',
  dependencies: [],
  description: '游戏控制器，协调各个模块，提供统一的API'
};

// 导出模块
if (typeof window !== 'undefined') {
  window.GameController = GameController;
}
