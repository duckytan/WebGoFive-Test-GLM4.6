/**
 * 存档加载服务 - 处理游戏状态的保存和加载
 *
 * 职责：
 * - 游戏状态序列化和反序列化
 * - 本地存储管理
 * - 导入导出功能
 * - 版本兼容性处理
 */

class SaveLoadService {
  constructor(eventBus) {
    // 验证依赖
    if (!eventBus) {
      throw new Error('SaveLoadService requires EventBus instance');
    }

    this.eventBus = eventBus;
    this.logger = logger.createModuleLogger('SaveLoadService');

    // 存储配置
    this.config = {
      storageKey: 'gomoku_savegames',
      maxSaveSlots: 10,
      autoSaveKey: 'gomoku_autosave',
      exportFormat: 'json',
      version: '2.0.0'
    };

    // 存储格式版本映射
    this.versionMigrators = {
      '1.0.0': this._migrateFromV1.bind(this),
      '1.0.1': this._migrateFromV101.bind(this),
      '1.0.2': this._migrateFromV102.bind(this),
      '1.0.3': this._migrateFromV103.bind(this)
    };

    this.logger.info('SaveLoadService initialized');
  }

  /**
   * 保存游戏状态
   * @param {Object} gameState - 游戏状态
   * @param {Object} options - 保存选项
   * @param {string} options.slot - 存储槽位
   * @param {string} options.name - 存档名称
   * @param {string} options.description - 存档描述
   * @param {boolean} options.autoSave - 是否为自动存档
   * @returns {Promise<Object>} 保存结果
   */
  async saveGame(gameState, options = {}) {
    const startTime = performance.now();

    try {
      // 验证游戏状态
      if (!gameState || typeof gameState.getSnapshot !== 'function') {
        throw new Error('Invalid game state provided');
      }

      // 获取状态快照
      const snapshot = gameState.getSnapshot();

      // 创建存档数据
      const saveData = {
        version: this.config.version,
        timestamp: Date.now(),
        name: options.name || `游戏 ${new Date().toLocaleString()}`,
        description: options.description || '',
        gameState: snapshot,
        metadata: this._createMetadata(snapshot, options)
      };

      // 验证存档数据
      this._validateSaveData(saveData);

      let result;
      if (options.autoSave) {
        result = await this._saveAuto(saveData);
      } else {
        result = await this._saveToSlot(saveData, options.slot);
      }

      const duration = performance.now() - startTime;
      this.logger.performance('saveGame', startTime);
      this.logger.info('Game saved', {
        name: saveData.name,
        slot: result.slot,
        autoSave: options.autoSave,
        duration
      });

      this.eventBus.emit('save:completed', saveData, result);

      return {
        success: true,
        saveData,
        slot: result.slot,
        message: `游戏已保存到槽位 ${result.slot}`
      };

    } catch (error) {
      const duration = performance.now() - startTime;
      this.logger.error('Save game failed', { error: error.message, duration });
      this.eventBus.emit('save:failed', error);

      return {
        success: false,
        error: error.message,
        message: `保存失败: ${error.message}`
      };
    }
  }

  /**
   * 加载游戏状态
   * @param {string|number} slot - 存储槽位或存档数据
   * @param {Object} options - 加载选项
   * @returns {Promise<Object>} 加载结果
   */
  async loadGame(slot, options = {}) {
    const startTime = performance.now();

    try {
      let saveData;

      if (typeof slot === 'string' && slot.startsWith('{')) {
        // 直接提供存档数据
        saveData = JSON.parse(slot);
      } else {
        // 从存储槽位加载
        saveData = await this._loadFromSlot(slot);
      }

      // 验证存档数据
      this._validateLoadData(saveData);

      // 版本迁移
      const migratedData = await this._migrateSaveData(saveData);

      // 验证迁移后的数据
      this._validateMigratedData(migratedData);

      const duration = performance.now() - startTime;
      this.logger.performance('loadGame', startTime);
      this.logger.info('Game loaded', {
        name: migratedData.name,
        version: migratedData.version,
        duration
      });

      this.eventBus.emit('load:completed', migratedData);

      return {
        success: true,
        saveData: migratedData,
        message: `游戏 "${migratedData.name}" 加载成功`
      };

    } catch (error) {
      const duration = performance.now() - startTime;
      this.logger.error('Load game failed', { slot, error: error.message, duration });
      this.eventBus.emit('load:failed', error);

      return {
        success: false,
        error: error.message,
        message: `加载失败: ${error.message}`
      };
    }
  }

  /**
   * 获取存档列表
   * @param {Object} options - 选项
   * @returns {Array} 存档列表
   */
  getSaveList(options = {}) {
    try {
      const saves = this._getAllSaves();

      // 过滤和排序
      let filteredSaves = saves;

      if (options.excludeAuto) {
        filteredSaves = filteredSaves.filter(save => !save.autoSave);
      }

      if (options.sortBy === 'date') {
        filteredSaves.sort((a, b) => b.timestamp - a.timestamp);
      } else if (options.sortBy === 'name') {
        filteredSaves.sort((a, b) => a.name.localeCompare(b.name));
      }

      return filteredSaves.map(save => ({
        slot: save.slot,
        name: save.name,
        description: save.description,
        timestamp: save.timestamp,
        version: save.version,
        gameStatus: save.gameState?.gameStatus,
        moveCount: save.gameState?.moveCount || 0,
        mode: save.gameState?.mode,
        autoSave: save.autoSave || false
      }));

    } catch (error) {
      this.logger.error('Get save list failed', { error: error.message });
      return [];
    }
  }

  /**
   * 删除存档
   * @param {number} slot - 存储槽位
   * @returns {boolean} 是否成功删除
   */
  deleteSave(slot) {
    try {
      const saves = this._getAllSaves();
      const originalLength = saves.length;

      // 删除指定槽位的存档
      const filteredSaves = saves.filter(save => save.slot !== slot);

      if (filteredSaves.length === originalLength) {
        throw new Error(`存档槽位 ${slot} 不存在`);
      }

      // 重新保存
      localStorage.setItem(this.config.storageKey, JSON.stringify(filteredSaves));

      this.logger.info('Save deleted', { slot });
      this.eventBus.emit('save:deleted', slot);

      return true;

    } catch (error) {
      this.logger.error('Delete save failed', { slot, error: error.message });
      return false;
    }
  }

  /**
   * 导出存档
   * @param {number} slot - 存储槽位
   * @param {string} format - 导出格式
   * @returns {string} 导出数据
   */
  exportSave(slot, format = this.config.exportFormat) {
    try {
      const saveData = this._loadFromSlot(slot);

      let exportData;
      if (format === 'json') {
        exportData = JSON.stringify(saveData, null, 2);
      } else if (format === 'base64') {
        const json = JSON.stringify(saveData);
        exportData = btoa(unescape(encodeURIComponent(json)));
      } else {
        throw new Error(`Unsupported export format: ${format}`);
      }

      this.logger.info('Save exported', { slot, format });
      this.eventBus.emit('save:exported', slot, format, exportData);

      return exportData;

    } catch (error) {
      this.logger.error('Export save failed', { slot, format, error: error.message });
      throw error;
    }
  }

  /**
   * 导入存档
   * @param {string} data - 导入数据
   * @param {string} format - 数据格式
   * @param {Object} options - 导入选项
   * @returns {Promise<Object>} 导入结果
   */
  async importSave(data, format = this.config.exportFormat, options = {}) {
    const startTime = performance.now();

    try {
      let saveData;

      if (format === 'json') {
        saveData = JSON.parse(data);
      } else if (format === 'base64') {
        const json = decodeURIComponent(escape(atob(data)));
        saveData = JSON.parse(json);
      } else {
        throw new Error(`Unsupported import format: ${format}`);
      }

      // 验证导入数据
      this._validateLoadData(saveData);

      // 版本迁移
      const migratedData = await this._migrateSaveData(saveData);

      // 保存到指定槽位
      const result = await this._saveToSlot(migratedData, options.slot);

      const duration = performance.now() - startTime;
      this.logger.performance('importSave', startTime);
      this.logger.info('Save imported', {
        name: migratedData.name,
        slot: result.slot,
        format,
        duration
      });

      this.eventBus.emit('save:imported', migratedData, result.slot);

      return {
        success: true,
        saveData: migratedData,
        slot: result.slot,
        message: `存档 "${migratedData.name}" 导入成功`
      };

    } catch (error) {
      const duration = performance.now() - startTime;
      this.logger.error('Import save failed', { format, error: error.message, duration });

      return {
        success: false,
        error: error.message,
        message: `导入失败: ${error.message}`
      };
    }
  }

  /**
   * 自动保存
   * @param {Object} gameState - 游戏状态
   * @returns {Promise<Object>} 保存结果
   */
  async autoSave(gameState) {
    return this.saveGame(gameState, {
      name: '自动存档',
      description: '系统自动保存的游戏进度',
      autoSave: true
    });
  }

  /**
   * 获取自动存档
   * @returns {Object|null} 自动存档数据
   */
  getAutoSave() {
    try {
      const autoSaveData = localStorage.getItem(this.config.autoSaveKey);
      if (!autoSaveData) {
        return null;
      }

      const saveData = JSON.parse(autoSaveData);
      this._validateLoadData(saveData);

      return saveData;

    } catch (error) {
      this.logger.error('Get auto save failed', { error: error.message });
      return null;
    }
  }

  /**
   * 清除所有存档
   * @returns {boolean} 是否成功清除
   */
  clearAllSaves() {
    try {
      localStorage.removeItem(this.config.storageKey);
      localStorage.removeItem(this.config.autoSaveKey);

      this.logger.info('All saves cleared');
      this.eventBus.emit('save:clearedAll');

      return true;

    } catch (error) {
      this.logger.error('Clear saves failed', { error: error.message });
      return false;
    }
  }

  /**
   * 获取存储统计信息
   * @returns {Object} 存储统计
   */
  getStorageStats() {
    try {
      const saves = this._getAllSaves();
      const autoSave = this.getAutoSave();

      const totalSize = this._calculateStorageSize();
      const usedSlots = saves.length;
      const availableSlots = this.config.maxSaveSlots - usedSlots;

      return {
        totalSaves: saves.length,
        usedSlots,
        availableSlots,
        hasAutoSave: !!autoSave,
        totalSize: this._formatBytes(totalSize),
        oldestSave: saves.length > 0 ? Math.min(...saves.map(s => s.timestamp)) : null,
        newestSave: saves.length > 0 ? Math.max(...saves.map(s => s.timestamp)) : null
      };

    } catch (error) {
      this.logger.error('Get storage stats failed', { error: error.message });
      return {
        totalSaves: 0,
        usedSlots: 0,
        availableSlots: this.config.maxSaveSlots,
        hasAutoSave: false,
        totalSize: '0 B',
        oldestSave: null,
        newestSave: null
      };
    }
  }

  /**
   * 保存到存储槽位
   * @private
   */
  async _saveToSlot(saveData, slot) {
    const saves = this._getAllSaves();

    // 确定槽位
    if (slot !== undefined) {
      // 指定槽位
      saveData.slot = parseInt(slot);
    } else {
      // 自动分配槽位
      saveData.slot = this._findAvailableSlot(saves);
    }

    if (saveData.slot < 0 || saveData.slot >= this.config.maxSaveSlots) {
      throw new Error(`Invalid save slot: ${saveData.slot}`);
    }

    // 更新或添加存档
    const existingIndex = saves.findIndex(save => save.slot === saveData.slot);
    if (existingIndex >= 0) {
      saves[existingIndex] = saveData;
    } else {
      saves.push(saveData);
    }

    // 保存到本地存储
    localStorage.setItem(this.config.storageKey, JSON.stringify(saves));

    return { slot: saveData.slot };
  }

  /**
   * 自动保存
   * @private
   */
  async _saveAuto(saveData) {
    localStorage.setItem(this.config.autoSaveKey, JSON.stringify(saveData));
    return { slot: 'auto' };
  }

  /**
   * 从存储槽位加载
   * @private
   */
  _loadFromSlot(slot) {
    if (slot === 'auto') {
      const autoSaveData = localStorage.getItem(this.config.autoSaveKey);
      if (!autoSaveData) {
        throw new Error('No auto save found');
      }
      return JSON.parse(autoSaveData);
    }

    const saves = this._getAllSaves();
    const save = saves.find(s => s.slot === parseInt(slot));

    if (!save) {
      throw new Error(`Save slot ${slot} not found`);
    }

    return save;
  }

  /**
   * 获取所有存档
   * @private
   */
  _getAllSaves() {
    try {
      const savesData = localStorage.getItem(this.config.storageKey);
      return savesData ? JSON.parse(savesData) : [];
    } catch (error) {
      this.logger.error('Get all saves failed', { error: error.message });
      return [];
    }
  }

  /**
   * 查找可用槽位
   * @private
   */
  _findAvailableSlot(saves) {
    const usedSlots = saves.map(save => save.slot);

    for (let i = 0; i < this.config.maxSaveSlots; i++) {
      if (!usedSlots.includes(i)) {
        return i;
      }
    }

    throw new Error('No available save slots');
  }

  /**
   * 创建元数据
   * @private
   */
  _createMetadata(snapshot, options) {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      saveOptions: {
        autoSave: options.autoSave || false,
        customName: !!options.name,
        customDescription: !!options.description
      },
      gameStats: {
        moveCount: snapshot.moveCount,
        gameStatus: snapshot.gameStatus,
        mode: snapshot.mode,
        duration: snapshot.endTime ? snapshot.endTime - snapshot.startTime : 0
      }
    };
  }

  /**
   * 验证存档数据
   * @private
   */
  _validateSaveData(saveData) {
    if (!saveData || typeof saveData !== 'object') {
      throw new Error('Invalid save data format');
    }

    const required = ['version', 'timestamp', 'gameState'];
    for (const field of required) {
      if (!(field in saveData)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (!saveData.gameState || typeof saveData.gameState !== 'object') {
      throw new Error('Invalid game state in save data');
    }

    // 验证游戏状态结构
    const gameStateRequired = ['board', 'currentPlayer', 'moveHistory', 'gameStatus'];
    for (const field of gameStateRequired) {
      if (!(field in saveData.gameState)) {
        throw new Error(`Missing required game state field: ${field}`);
      }
    }
  }

  /**
   * 验证加载数据
   * @private
   */
  _validateLoadData(saveData) {
    this._validateSaveData(saveData);

    if (typeof saveData.version !== 'string') {
      throw new Error('Invalid version format');
    }

    if (!Array.isArray(saveData.gameState.board)) {
      throw new Error('Invalid board format');
    }

    if (!Array.isArray(saveData.gameState.moveHistory)) {
      throw new Error('Invalid move history format');
    }
  }

  /**
   * 验证迁移后的数据
   * @private
   */
  _validateMigratedData(saveData) {
    // 验证版本是否为当前版本
    if (saveData.version !== this.config.version) {
      throw new Error(`Version mismatch after migration: expected ${this.config.version}, got ${saveData.version}`);
    }

    this._validateSaveData(saveData);
  }

  /**
   * 迁移存档数据
   * @private
   */
  async _migrateSaveData(saveData) {
    if (saveData.version === this.config.version) {
      return saveData;
    }

    this.logger.info('Migrating save data', { from: saveData.version, to: this.config.version });

    let migratedData = { ...saveData };

    // 按版本顺序迁移
    const versionKeys = Object.keys(this.versionMigrators).sort();

    for (const version of versionKeys) {
      if (this._compareVersions(migratedData.version, version) < 0) {
        if (this.versionMigrators[version]) {
          migratedData = await this.versionMigrators[version](migratedData);
          this.logger.info('Migrated to version', { version });
        }
      }
    }

    // 更新到当前版本
    migratedData.version = this.config.version;
    migratedData.migratedAt = Date.now();

    return migratedData;
  }

  /**
   * 版本比较
   * @private
   */
  _compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;

      if (p1 < p2) {
        return -1;
      }
      if (p1 > p2) {
        return 1;
      }
    }

    return 0;
  }

  /**
   * 计算存储大小
   * @private
   */
  _calculateStorageSize() {
    let totalSize = 0;

    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        totalSize += localStorage[key].length;
      }
    }

    return totalSize;
  }

  /**
   * 格式化字节数
   * @private
   */
  _formatBytes(bytes) {
    if (bytes === 0) {
      return '0 B';
    }

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // 版本迁移方法
  async _migrateFromV1(saveData) {
    // v1.0.0 到当前版本的迁移逻辑
    const migrated = { ...saveData };

    // 添加新字段
    if (!migrated.gameState.settings) {
      migrated.gameState.settings = {
        forbiddenRules: true,
        aiDifficulty: 'NORMAL',
        blackAI: 'NORMAL',
        whiteAI: 'NORMAL',
        firstPlayer: 1
      };
    }

    return migrated;
  }

  async _migrateFromV101(saveData) {
    // v1.0.1 到当前版本的迁移逻辑
    return this._migrateFromV1(saveData);
  }

  async _migrateFromV102(saveData) {
    // v1.0.2 到当前版本的迁移逻辑
    return this._migrateFromV1(saveData);
  }

  async _migrateFromV103(saveData) {
    // v1.0.3 到当前版本的迁移逻辑
    return this._migrateFromV1(saveData);
  }
}

// 模块元信息
SaveLoadService.__moduleInfo = {
  name: 'SaveLoadService',
  version: '2.0.0',
  dependencies: ['EventBus', 'Logger'],
  description: '存档加载服务，处理游戏状态的保存和加载'
};

// 导出模块
if (typeof window !== 'undefined') {
  window.SaveLoadService = SaveLoadService;
}
