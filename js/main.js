/**
 * H5 五子棋 v2.0 - 主入口文件
 *
 * 职责：
 * - 应用初始化和启动
 * - 全局错误处理
 * - 开发者工具暴露
 */

// 全局应用实例
let app = null;

/**
 * 应用启动函数
 * @param {Object} options - 启动选项
 */
async function startApp(options = {}) {
  try {
    console.log('🚀 Starting H5 Gomoku v2.0...');

    // 检查浏览器兼容性
    if (!checkBrowserCompatibility()) {
      throw new Error('Browser not compatible');
    }

    // 创建游戏控制器
    app = new GameController();

    // 初始化应用
    const initResult = await app.initialize(options);
    if (!initResult.success) {
      throw new Error(initResult.error);
    }

    // 启动应用
    const startResult = app.start();
    if (!startResult.success) {
      throw new Error(startResult.error);
    }

    // 暴露开发者工具
    if (options.debug || window.location.search.includes('debug=true')) {
      exposeDeveloperTools();
    }

    console.log('✅ H5 Gomoku v2.0 started successfully!');
    console.log('📊 Performance Stats:', app.getPerformanceStats());

    // 触发应用启动完成事件
    window.dispatchEvent(new CustomEvent('gomoku:appStarted', {
      detail: { app, initResult, startResult }
    }));

    return app;

  } catch (error) {
    console.error('❌ Failed to start H5 Gomoku v2.0:', error);
    showErrorMessage('应用启动失败: ' + error.message);
    return null;
  }
}

/**
 * 检查浏览器兼容性
 * @returns {boolean} 是否兼容
 */
function checkBrowserCompatibility() {
  // 检查必要的API
  const requiredFeatures = [
    'localStorage',
    'requestAnimationFrame',
    'addEventListener',
    'querySelector'
  ];

  for (const feature of requiredFeatures) {
    if (!(feature in window)) {
      console.error(`Missing required feature: ${feature}`);
      return false;
    }
  }

  // 检查Canvas支持
  const canvas = document.createElement('canvas');
  if (!canvas.getContext || !canvas.getContext('2d')) {
    console.error('Canvas not supported');
    return false;
  }

  // 检查ES6支持
  try {
    eval('const test = () => {}; class Test {};');
  } catch (e) {
    console.error('ES6 not supported');
    return false;
  }

  return true;
}

/**
 * 暴露开发者工具
 */
function exposeDeveloperTools() {
  // 暴露到全局作用域
  window.GomokuDev = {
    // 应用实例
    app,

    // 核心模块
    modules: app ? app.modules : null,

    // 调试工具
    debug: {
      // 获取应用状态
      getState: () => app ? app.getApplicationState() : null,

      // 获取游戏状态
      getGameState: () => app ? app.getGameState() : null,

      // 获取性能统计
      getPerformanceStats: () => app ? app.getPerformanceStats() : null,

      // 切换调试模式
      toggleDebugMode: () => {
        if (app) {
          const currentState = app.getApplicationState().config.debugMode;
          app.setDebugMode(!currentState);
          return !currentState;
        }
        return false;
      },

      // 执行AI落子
      executeAIMove: async (difficulty = 'NORMAL') => {
        if (app && app.modules.modeManager && app.modules.modeManager._isAITurn(app.modules.gameState.currentPlayer)) {
          return await app.modules.modeManager._startAIThinking();
        }
        return null;
      },

      // 验证游戏状态
      validateGameState: () => {
        if (app && app.modules.ruleEngine && app.modules.gameState) {
          return app.modules.ruleEngine.validateState(app.modules.gameState);
        }
        return null;
      },

      // 导出游戏数据
      exportGameData: () => {
        if (app && app.modules.gameState) {
          return JSON.stringify(app.modules.gameState.getSnapshot(), null, 2);
        }
        return null;
      },

      // 导入游戏数据
      importGameData: (jsonData) => {
        try {
          const data = JSON.parse(jsonData);
          if (app && app.modules.gameState) {
            app.modules.gameState.restoreSnapshot(data);
            return true;
          }
        } catch (e) {
          console.error('Import failed:', e);
        }
        return false;
      },

      // 清除所有存档
      clearAllSaves: () => {
        if (app && app.modules.saveLoadService) {
          return app.modules.saveLoadService.clearAllSaves();
        }
        return false;
      },

      // 获取事件历史
      getEventHistory: (eventName, limit) => {
        if (app && app.modules.eventBus) {
          return app.modules.eventBus.getEventHistory(eventName, limit);
        }
        return [];
      },

      // 触发事件
      emitEvent: (eventName, ...args) => {
        if (app && app.modules.eventBus) {
          return app.modules.eventBus.emit(eventName, ...args);
        }
        return false;
      }
    },

    // 测试工具
    test: {
      // 创建测试棋局
      createTestGame: (moves) => {
        if (!app || !app.modules.gameState) {
          return;
        }

        app.modules.gameState.reset();
        moves.forEach(move => {
          app.modules.gameState.applyMove(move.x, move.y, { silent: true });
          app.modules.gameState.switchPlayer();
        });

        app._renderGame();
      },

      // 测试AI性能
      testAIPerformance: async (difficulty = 'NORMAL', iterations = 10) => {
        if (!app || !app.modules.aiEngine || !app.modules.gameState) {
          return;
        }

        const results = [];
        const ruleEngine = app.modules.ruleEngine;

        for (let i = 0; i < iterations; i++) {
          app.modules.gameState.reset();

          const startTime = performance.now();
          const result = await app.modules.aiEngine.calculateBestMove(
            app.modules.gameState,
            ruleEngine,
            difficulty
          );
          const endTime = performance.now();

          results.push({
            iteration: i + 1,
            position: result.position,
            score: result.score,
            duration: endTime - startTime
          });
        }

        return results;
      }
    },

    // 样式工具
    style: {
      // 切换主题
      toggleTheme: () => {
        document.body.classList.toggle('dark-theme');
      },

      // 显示坐标网格
      toggleGrid: () => {
        document.body.classList.toggle('show-grid');
      }
    }
  };

  // 添加控制台快捷方式
  window.g = window.GomokuDev;

  console.log('🔧 Developer tools exposed as window.GomokuDev or window.g');
  console.log('📋 Available commands:');
  console.log('  g.debug.getState() - Get application state');
  console.log('  g.debug.getGameState() - Get game state');
  console.log('  g.debug.toggleDebugMode() - Toggle debug mode');
  console.log('  g.test.createTestGame([{x:7,y:7},{x:7,y:8}]) - Create test game');
  console.log('  g.style.toggleTheme() - Toggle dark theme');
}

/**
 * 显示错误信息
 * @param {string} message - 错误信息
 */
function showErrorMessage(message) {
  // 创建错误提示元素
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-overlay';
  errorDiv.innerHTML = `
    <div class="error-dialog">
      <h2>⚠️ 启动错误</h2>
      <p>${message}</p>
      <button onclick="location.reload()">重新加载</button>
    </div>
  `;

  // 添加样式
  const style = document.createElement('style');
  style.textContent = `
    .error-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      font-family: Arial, sans-serif;
    }
    
    .error-dialog {
      background: white;
      padding: 2rem;
      border-radius: 10px;
      max-width: 500px;
      text-align: center;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    }
    
    .error-dialog h2 {
      color: #e74c3c;
      margin-bottom: 1rem;
    }
    
    .error-dialog p {
      color: #333;
      margin-bottom: 1.5rem;
      line-height: 1.5;
    }
    
    .error-dialog button {
      background: #3498db;
      color: white;
      border: none;
      padding: 0.8rem 2rem;
      border-radius: 5px;
      cursor: pointer;
      font-size: 1rem;
    }
    
    .error-dialog button:hover {
      background: #2980b9;
    }
  `;

  // 添加到页面
  document.head.appendChild(style);
  document.body.appendChild(errorDiv);
}

/**
 * 页面加载完成后启动应用
 */
document.addEventListener('DOMContentLoaded', async () => {
  // 检查是否已加载所有必需的模块
  const requiredModules = [
    'EventBus', 'Logger', 'GameState', 'RuleEngine', 'AIEngine',
    'CanvasRenderer', 'HudPanel', 'SaveLoadService', 'ReplayService',
    'ModeManager', 'GameController'
  ];

  const missingModules = requiredModules.filter(name => !window[name]);
  if (missingModules.length > 0) {
    console.error('Missing required modules:', missingModules);
    showErrorMessage(`缺少必需模块: ${missingModules.join(', ')}`);
    return;
  }

  // 启动应用
  await startApp({
    debug: window.location.search.includes('debug=true'),
    autoSave: true,
    performanceMonitoring: true
  });
});

/**
 * 页面卸载前清理
 */
window.addEventListener('beforeunload', () => {
  if (app) {
    // 自动保存
    if (app.getApplicationState().gameActive) {
      app.saveGame({ name: '退出自动保存', description: '页面卸载前自动保存' });
    }

    // 清理资源
    app.destroy();
  }
});

/**
 * 处理未捕获的错误
 */
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);

  // 如果应用已启动，记录错误
  if (app && app.modules.eventBus) {
    app.modules.eventBus.emit('app:globalError', {
      message: event.error.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error.stack
    });
  }
});

/**
 * 处理未处理的Promise拒绝
 */
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);

  // 如果应用已启动，记录错误
  if (app && app.modules.eventBus) {
    app.modules.eventBus.emit('app:unhandledRejection', {
      reason: event.reason
    });
  }
});

/**
 * 热键支持
 */
document.addEventListener('keydown', (event) => {
  // Ctrl+Z: 悔棋
  if (event.ctrlKey && event.key === 'z') {
    event.preventDefault();
    if (app && app.modules.modeManager) {
      app.modules.modeManager.handleUndo();
    }
  }

  // Ctrl+N: 新游戏
  if (event.ctrlKey && event.key === 'n') {
    event.preventDefault();
    if (app) {
      app.startNewGame();
    }
  }

  // Ctrl+S: 保存游戏
  if (event.ctrlKey && event.key === 's') {
    event.preventDefault();
    if (app) {
      app.saveGame();
    }
  }

  // F11: 切换全屏
  if (event.key === 'F11') {
    event.preventDefault();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  // F12: 切换调试模式
  if (event.key === 'F12') {
    event.preventDefault();
    if (app) {
      app.setDebugMode(!app.getApplicationState().config.debugMode);
    }
  }
});

// 导出启动函数（用于外部调用）
window.startGomokuApp = startApp;
