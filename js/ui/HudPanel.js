/**
 * HUD面板 - 处理游戏界面的UI元素和交互
 *
 * 职责：
 * - 管理游戏控制按钮
 * - 显示游戏状态信息
 * - 处理用户输入和设置
 * - 提供模态对话框功能
 */

class HudPanel {
  constructor(eventBus) {
    // 验证依赖
    if (!eventBus) {
      throw new Error('HudPanel requires EventBus instance');
    }

    this.eventBus = eventBus;
    this.logger = logger.createModuleLogger('HudPanel');

    // UI元素引用
    this.elements = {
      // 模式选择
      modeButtons: document.querySelectorAll('.mode-btn'),
      aiSettings: document.getElementById('ai-settings'),
      blackAILevel: document.getElementById('black-ai-level'),
      whiteAILevel: document.getElementById('white-ai-level'),

      // 游戏控制
      newGameBtn: document.getElementById('new-game'),
      undoMoveBtn: document.getElementById('undo-move'),
      hintMoveBtn: document.getElementById('hint-move'),
      saveGameBtn: document.getElementById('save-game'),
      loadGameBtn: document.getElementById('load-game'),

      // 回放控制
      replayControls: document.getElementById('replay-controls'),
      replayPlayBtn: document.getElementById('replay-play'),
      replayPauseBtn: document.getElementById('replay-pause'),
      replayPrevBtn: document.getElementById('replay-prev'),
      replayNextBtn: document.getElementById('replay-next'),
      replaySpeed: document.getElementById('replay-speed'),
      speedDisplay: document.getElementById('speed-display'),

      // 信息显示
      currentMode: document.getElementById('current-mode'),
      currentPlayer: document.getElementById('current-player'),
      moveCount: document.getElementById('move-count'),
      gameTime: document.getElementById('game-time'),
      gameStatus: document.getElementById('game-status'),
      moveList: document.getElementById('move-list'),

      // 设置
      forbiddenRules: document.getElementById('forbidden-rules'),
      showCoordinates: document.getElementById('show-coordinates'),
      soundEnabled: document.getElementById('sound-enabled'),

      // 模态框
      modalOverlay: document.getElementById('modal-overlay'),
      modalTitle: document.getElementById('modal-title'),
      modalBody: document.getElementById('modal-body'),
      modalFooter: document.getElementById('modal-footer'),
      modalClose: document.getElementById('modal-close')
    };

    // 状态管理
    this.state = {
      currentMode: 'PvP',
      currentPlayer: 1,
      gameStatus: 'ready',
      isReplaying: false,
      gameTime: 0,
      gameTimer: null
    };

    // 初始化
    this._initialize();
    this._bindEventHandlers();

    this.logger.info('HudPanel initialized');
  }

  /**
   * 初始化HUD面板
   * @private
   */
  _initialize() {
    // 设置初始状态
    this._updateModeDisplay('PvP');
    this._updatePlayerDisplay(1);
    this._updateGameStatus('ready');
    this._updateMoveCount(0);
    this._updateGameTime(0);

    // 隐藏AI设置和回放控制
    this.elements.aiSettings.style.display = 'none';
    this.elements.replayControls.style.display = 'none';

    // 禁用悔棋按钮
    this.elements.undoMoveBtn.disabled = true;

    this.logger.info('HUD initialized');
  }

  /**
   * 更新模式显示
   * @param {string} mode - 游戏模式
   * @private
   */
  _updateModeDisplay(mode) {
    this.state.currentMode = mode;

    // 更新模式按钮状态
    this.elements.modeButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    // 更新模式文本显示
    const modeTexts = {
      'PvP': '双人对战',
      'PvE': '人机对战',
      'EvE': '机机对战'
    };
    this.elements.currentMode.textContent = `模式: ${modeTexts[mode]}`;

    // 显示/隐藏AI设置
    const showAISettings = mode === 'PvE' || mode === 'EvE';
    this.elements.aiSettings.style.display = showAISettings ? 'block' : 'none';

    this.logger.info('Mode display updated', { mode });
  }

  /**
   * 更新玩家显示
   * @param {number} player - 当前玩家
   * @private
   */
  _updatePlayerDisplay(player) {
    this.state.currentPlayer = player;
    const playerText = player === 1 ? '黑棋' : '白棋';
    this.elements.currentPlayer.textContent = `当前: ${playerText}`;
  }

  /**
   * 更新游戏状态
   * @param {string} status - 游戏状态
   * @private
   */
  _updateGameStatus(status) {
    this.state.gameStatus = status;

    const statusTexts = {
      'ready': '准备',
      'playing': '进行中',
      'finished': '已结束',
      'paused': '暂停'
    };

    this.elements.gameStatus.textContent = statusTexts[status] || status;

    // 更新按钮状态
    const isPlaying = status === 'playing';
    const canUndo = status === 'playing' || status === 'finished';

    this.elements.undoMoveBtn.disabled = !canUndo;
    this.elements.hintMoveBtn.disabled = !isPlaying;
  }

  /**
   * 更新步数显示
   * @param {number} count - 步数
   * @private
   */
  _updateMoveCount(count) {
    this.elements.moveCount.textContent = count.toString();
  }

  /**
   * 更新游戏时间
   * @param {number} seconds - 游戏时间（秒）
   * @private
   */
  _updateGameTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const timeText = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    this.elements.gameTime.textContent = timeText;
  }

  /**
   * 开始游戏计时
   * @private
   */
  _startGameTimer() {
    this._stopGameTimer();

    this.state.gameTimer = setInterval(() => {
      this.state.gameTime++;
      this._updateGameTime(this.state.gameTime);
    }, 1000);
  }

  /**
   * 停止游戏计时
   * @private
   */
  _stopGameTimer() {
    if (this.state.gameTimer) {
      clearInterval(this.state.gameTimer);
      this.state.gameTimer = null;
    }
  }

  /**
   * 重置游戏时间
   * @private
   */
  _resetGameTime() {
    this._stopGameTimer();
    this.state.gameTime = 0;
    this._updateGameTime(0);
  }

  /**
   * 更新落子记录
   * @param {Array} moveHistory - 落子历史
   * @private
   */
  _updateMoveList(moveHistory) {
    this.elements.moveList.innerHTML = '';

    moveHistory.forEach((move, index) => {
      const moveItem = document.createElement('div');
      moveItem.className = `move-item ${move.player === 1 ? 'black' : 'white'}`;

      const moveNumber = index + 1;
      const playerText = move.player === 1 ? '黑' : '白';
      const position = `${String.fromCharCode(65 + move.x)}${move.y + 1}`;

      moveItem.innerHTML = `
        <span class="move-number">${moveNumber}.</span>
        <span class="move-player">${playerText}</span>
        <span class="move-position">${position}</span>
      `;

      this.elements.moveList.appendChild(moveItem);
    });

    // 滚动到最新
    this.elements.moveList.scrollTop = this.elements.moveList.scrollHeight;
  }

  /**
   * 显示模态对话框
   * @param {string} title - 标题
   * @param {string|HTMLElement} content - 内容
   * @param {Array} buttons - 按钮配置
   * @private
   */
  _showModal(title, content, buttons = []) {
    this.elements.modalTitle.textContent = title;

    if (typeof content === 'string') {
      this.elements.modalBody.innerHTML = content;
    } else {
      this.elements.modalBody.innerHTML = '';
      this.elements.modalBody.appendChild(content);
    }

    // 清空并添加按钮
    this.elements.modalFooter.innerHTML = '';
    buttons.forEach(btn => {
      const button = document.createElement('button');
      button.className = btn.class || 'modal-btn';
      button.textContent = btn.text;
      button.onclick = btn.onclick || (() => this._hideModal());
      this.elements.modalFooter.appendChild(button);
    });

    // 显示模态框
    this.elements.modalOverlay.style.display = 'flex';
    this.elements.modalOverlay.classList.add('fade-in');
  }

  /**
   * 隐藏模态对话框
   * @private
   */
  _hideModal() {
    this.elements.modalOverlay.style.display = 'none';
    this.elements.modalOverlay.classList.remove('fade-in');
  }

  /**
   * 显示游戏结束对话框
   * @param {number} winner - 获胜者
   * @param {Object} stats - 游戏统计
   * @private
   */
  _showGameEndDialog(winner, stats) {
    const winnerText = winner === 1 ? '黑棋' : winner === 2 ? '白棋' : '平局';
    const title = winner ? `${winnerText}获胜！` : '平局！';

    const content = `
      <div class="game-end-summary">
        <h3>游戏统计</h3>
        <p>总步数: ${stats.moveCount}</p>
        <p>游戏时长: ${Math.floor(stats.duration / 1000 / 60)}分${Math.floor(stats.duration / 1000 % 60)}秒</p>
        <p>黑棋步数: ${stats.blackMoves}</p>
        <p>白棋步数: ${stats.whiteMoves}</p>
      </div>
    `;

    const buttons = [
      {
        text: '新游戏',
        class: 'modal-btn primary',
        onclick: () => {
          this._hideModal();
          this.eventBus.emit('ui:newGameRequested');
        }
      },
      {
        text: '查看回放',
        class: 'modal-btn',
        onclick: () => {
          this._hideModal();
          this.eventBus.emit('ui:replayRequested');
        }
      },
      {
        text: '关闭',
        class: 'modal-btn',
        onclick: () => this._hideModal()
      }
    ];

    this._showModal(title, content, buttons);
  }

  /**
   * 显示保存/加载对话框
   * @param {string} type - 'save' | 'load'
   * @private
   */
  _showSaveLoadDialog(type) {
    const title = type === 'save' ? '保存游戏' : '加载游戏';

    if (type === 'save') {
      const content = `
        <div class="save-game-form">
          <p>是否保存当前游戏状态？</p>
          <p>保存后可以随时继续游戏。</p>
        </div>
      `;

      const buttons = [
        {
          text: '保存',
          class: 'modal-btn primary',
          onclick: () => {
            this._hideModal();
            this.eventBus.emit('ui:saveGameRequested');
          }
        },
        {
          text: '取消',
          class: 'modal-btn',
          onclick: () => this._hideModal()
        }
      ];

      this._showModal(title, content, buttons);
    } else {
      const content = `
        <div class="load-game-form">
          <p>是否加载之前保存的游戏？</p>
          <p>当前游戏进度将会丢失。</p>
        </div>
      `;

      const buttons = [
        {
          text: '加载',
          class: 'modal-btn primary',
          onclick: () => {
            this._hideModal();
            this.eventBus.emit('ui:loadGameRequested');
          }
        },
        {
          text: '取消',
          class: 'modal-btn',
          onclick: () => this._hideModal()
        }
      ];

      this._showModal(title, content, buttons);
    }
  }

  /**
   * 显示设置对话框
   * @private
   */
  _showSettingsDialog() {
    const content = `
      <div class="settings-form">
        <div class="setting-item">
          <label>
            <input type="checkbox" ${this.elements.forbiddenRules.checked ? 'checked' : ''}>
            启用禁手规则
          </label>
        </div>
        <div class="setting-item">
          <label>
            <input type="checkbox" ${this.elements.showCoordinates.checked ? 'checked' : ''}>
            显示坐标
          </label>
        </div>
        <div class="setting-item">
          <label>
            <input type="checkbox" ${this.elements.soundEnabled.checked ? 'checked' : ''}>
            启用音效
          </label>
        </div>
      </div>
    `;

    const buttons = [
      {
        text: '确定',
        class: 'modal-btn primary',
        onclick: () => {
          this._hideModal();
          // 设置已通过复选框直接更新
        }
      },
      {
        text: '取消',
        class: 'modal-btn',
        onclick: () => this._hideModal()
      }
    ];

    this._showModal('游戏设置', content, buttons);
  }

  /**
   * 绑定事件处理器
   * @private
   */
  _bindEventHandlers() {
    // 模式选择按钮
    this.elements.modeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        this._updateModeDisplay(mode);
        this.eventBus.emit('ui:modeChanged', mode);
      });
    });

    // AI难度选择
    this.elements.blackAILevel.addEventListener('change', () => {
      this.eventBus.emit('ui:aiLevelChanged', 'black', this.elements.blackAILevel.value);
    });

    this.elements.whiteAILevel.addEventListener('change', () => {
      this.eventBus.emit('ui:aiLevelChanged', 'white', this.elements.whiteAILevel.value);
    });

    // 游戏控制按钮
    this.elements.newGameBtn.addEventListener('click', () => {
      this.eventBus.emit('ui:newGameRequested');
    });

    this.elements.undoMoveBtn.addEventListener('click', () => {
      this.eventBus.emit('ui:undoRequested');
    });

    this.elements.hintMoveBtn.addEventListener('click', () => {
      this.eventBus.emit('ui:hintRequested');
    });

    this.elements.saveGameBtn.addEventListener('click', () => {
      this._showSaveLoadDialog('save');
    });

    this.elements.loadGameBtn.addEventListener('click', () => {
      this._showSaveLoadDialog('load');
    });

    // 回放控制
    this.elements.replayPlayBtn.addEventListener('click', () => {
      this.eventBus.emit('ui:replayPlay');
    });

    this.elements.replayPauseBtn.addEventListener('click', () => {
      this.eventBus.emit('ui:replayPause');
    });

    this.elements.replayPrevBtn.addEventListener('click', () => {
      this.eventBus.emit('ui:replayPrev');
    });

    this.elements.replayNextBtn.addEventListener('click', () => {
      this.eventBus.emit('ui:replayNext');
    });

    this.elements.replaySpeed.addEventListener('input', () => {
      const speed = parseFloat(this.elements.replaySpeed.value);
      this.elements.speedDisplay.textContent = `${speed}x`;
      this.eventBus.emit('ui:replaySpeedChanged', speed);
    });

    // 设置复选框
    this.elements.forbiddenRules.addEventListener('change', () => {
      this.eventBus.emit('ui:settingChanged', 'forbiddenRules', this.elements.forbiddenRules.checked);
    });

    this.elements.showCoordinates.addEventListener('change', () => {
      this.eventBus.emit('ui:settingChanged', 'showCoordinates', this.elements.showCoordinates.checked);
    });

    this.elements.soundEnabled.addEventListener('change', () => {
      this.eventBus.emit('ui:settingChanged', 'soundEnabled', this.elements.soundEnabled.checked);
    });

    // 模态框关闭
    this.elements.modalClose.addEventListener('click', () => {
      this._hideModal();
    });

    this.elements.modalOverlay.addEventListener('click', (event) => {
      if (event.target === this.elements.modalOverlay) {
        this._hideModal();
      }
    });

    // 游戏事件监听
    this.eventBus.on('state:reset', () => {
      this._resetGameTime();
      this._updateGameStatus('ready');
      this._updateMoveCount(0);
      this._updateMoveList([]);
    });

    this.eventBus.on('move:applied', () => {
      this._updateMoveCount(this.state.gameTime); // 这里需要从gameState获取
    });

    this.eventBus.on('player:switched', (player) => {
      this._updatePlayerDisplay(player);
    });

    this.eventBus.on('game:statusChanged', (status) => {
      this._updateGameStatus(status);

      if (status === 'playing') {
        this._startGameTimer();
      } else if (status === 'finished') {
        this._stopGameTimer();
      }
    });

    this.eventBus.on('game:finished', (winner, winLine, gameState) => {
      const stats = gameState.getStats();
      this._showGameEndDialog(winner, stats);
    });

    this.eventBus.on('game:modeChanged', (mode) => {
      this._updateModeDisplay(mode);
    });

    this.eventBus.on('settings:updated', (settings) => {
      // 同步设置到UI
      this.elements.forbiddenRules.checked = settings.forbiddenRules;
      this.elements.showCoordinates.checked = settings.showCoordinates;
      this.elements.soundEnabled.checked = settings.soundEnabled;
    });

    // 帮助和关于链接
    document.getElementById('help-link').addEventListener('click', (event) => {
      event.preventDefault();
      this._showHelpDialog();
    });

    document.getElementById('about-link').addEventListener('click', (event) => {
      event.preventDefault();
      this._showAboutDialog();
    });
  }

  /**
   * 显示帮助对话框
   * @private
   */
  _showHelpDialog() {
    const content = `
      <div class="help-content">
        <h3>游戏规则</h3>
        <p>五子棋是一种双人对弈的纯策略型棋类游戏，目标是在棋盘上形成连续的五个棋子。</p>
        
        <h4>基本规则</h4>
        <ul>
          <li>黑棋先行，双方轮流落子</li>
          <li>先形成五连者获胜</li>
          <li>黑棋有禁手限制（三三、四四、长连）</li>
          <li>白棋无禁手限制</li>
        </ul>
        
        <h4>操作说明</h4>
        <ul>
          <li>点击棋盘空位落子</li>
          <li>使用悔棋按钮撤销上一步</li>
          <li>使用提示按钮获得落子建议</li>
          <li>可以保存和加载游戏进度</li>
        </ul>
        
        <h4>AI难度</h4>
        <ul>
          <li><strong>新手：</strong>适合初学者，AI会犯错</li>
          <li><strong>正常：</strong>普通难度，有一定挑战性</li>
          <li><strong>困难：</strong>较强AI，需要认真思考</li>
          <li><strong>地狱：</strong>最强AI，接近专业水平</li>
        </ul>
      </div>
    `;

    const buttons = [
      {
        text: '关闭',
        class: 'modal-btn primary',
        onclick: () => this._hideModal()
      }
    ];

    this._showModal('游戏帮助', content, buttons);
  }

  /**
   * 显示关于对话框
   * @private
   */
  _showAboutDialog() {
    const content = `
      <div class="about-content">
        <h3>H5 五子棋 v2.0</h3>
        <p>一个基于HTML5 Canvas的五子棋游戏</p>
        
        <h4>特性</h4>
        <ul>
          <li>支持双人对战、人机对战、机机对战</li>
          <li>完整的禁手规则实现</li>
          <li>四级AI难度</li>
          <li>游戏存档和回放功能</li>
          <li>响应式设计，支持移动端</li>
        </ul>
        
        <h4>技术栈</h4>
        <ul>
          <li>原生JavaScript ES2020</li>
          <li>HTML5 Canvas 2D</li>
          <li>模块化架构设计</li>
        </ul>
        
        <p style="margin-top: 20px; text-align: center; color: #666;">
          © 2024 Gomoku Development Team
        </p>
      </div>
    `;

    const buttons = [
      {
        text: '关闭',
        class: 'modal-btn primary',
        onclick: () => this._hideModal()
      }
    ];

    this._showModal('关于游戏', content, buttons);
  }

  /**
   * 获取HUD状态
   * @returns {Object} HUD状态
   */
  getStatus() {
    return {
      ...this.state,
      aiSettings: {
        black: this.elements.blackAILevel.value,
        white: this.elements.whiteAILevel.value
      },
      settings: {
        forbiddenRules: this.elements.forbiddenRules.checked,
        showCoordinates: this.elements.showCoordinates.checked,
        soundEnabled: this.elements.soundEnabled.checked
      }
    };
  }

  /**
   * 销毁HUD面板
   */
  destroy() {
    // 停止计时器
    this._stopGameTimer();

    // 移除事件监听器
    // 这里需要移除所有添加的事件监听器

    // 清理状态
    this.state = null;

    this.logger.info('HudPanel destroyed');
  }
}

// 模块元信息
HudPanel.__moduleInfo = {
  name: 'HudPanel',
  version: '2.0.0',
  dependencies: ['EventBus', 'Logger'],
  description: 'HUD面板，处理游戏界面的UI元素和交互'
};

// 导出模块
if (typeof window !== 'undefined') {
  window.HudPanel = HudPanel;
}
