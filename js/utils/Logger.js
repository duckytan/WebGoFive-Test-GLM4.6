/**
 * 日志工具 - 提供统一的日志记录功能
 *
 * 职责：
 * - 提供分级日志记录（debug, info, warn, error）
 * - 支持模块标识和上下文信息
 * - 支持日志持久化存储
 * - 提供日志过滤和搜索功能
 */

class Logger {
  constructor(options = {}) {
    this.level = options.level || this._getLevelFromString(options.levelName) || Logger.LEVEL.INFO;
    this.prefix = options.prefix || 'Gomoku';
    this.enableConsole = options.enableConsole !== false;
    this.enableStorage = options.enableStorage || false;
    this.maxStorageSize = options.maxStorageSize || 1000;
    this.storageKey = options.storageKey || 'gomoku_logs';
    this.modules = new Set();
    this.logBuffer = [];

    // 初始化存储日志
    if (this.enableStorage) {
      this._loadStoredLogs();
    }
  }

  // 日志级别常量
  static LEVEL = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    OFF: 4
  };

  static LEVEL_NAMES = {
    0: 'DEBUG',
    1: 'INFO',
    2: 'WARN',
    3: 'ERROR',
    4: 'OFF'
  };

  /**
   * 记录调试日志
   * @param {string} module - 模块名称
   * @param {string} message - 日志消息
   * @param {...any} args - 额外参数
   */
  debug(module, message, ...args) {
    this._log(Logger.LEVEL.DEBUG, module, message, ...args);
  }

  /**
   * 记录信息日志
   * @param {string} module - 模块名称
   * @param {string} message - 日志消息
   * @param {...any} args - 额外参数
   */
  info(module, message, ...args) {
    this._log(Logger.LEVEL.INFO, module, message, ...args);
  }

  /**
   * 记录警告日志
   * @param {string} module - 模块名称
   * @param {string} message - 日志消息
   * @param {...any} args - 额外参数
   */
  warn(module, message, ...args) {
    this._log(Logger.LEVEL.WARN, module, message, ...args);
  }

  /**
   * 记录错误日志
   * @param {string} module - 模块名称
   * @param {string} message - 日志消息
   * @param {...any} args - 额外参数
   */
  error(module, message, ...args) {
    this._log(Logger.LEVEL.ERROR, module, message, ...args);
  }

  /**
   * 记录性能日志
   * @param {string} module - 模块名称
   * @param {string} operation - 操作名称
   * @param {number} startTime - 开始时间戳
   * @param {number} endTime - 结束时间戳（可选，默认为当前时间）
   */
  performance(module, operation, startTime, endTime = Date.now()) {
    const duration = endTime - startTime;
    this.info(module, `Performance: ${operation} took ${duration}ms`, {
      operation,
      startTime,
      endTime,
      duration
    });
  }

  /**
   * 创建模块专用日志器
   * @param {string} moduleName - 模块名称
   * @returns {Object} 模块专用日志器
   */
  createModuleLogger(moduleName) {
    this.modules.add(moduleName);

    return {
      debug: (message, ...args) => this.debug(moduleName, message, ...args),
      info: (message, ...args) => this.info(moduleName, message, ...args),
      warn: (message, ...args) => this.warn(moduleName, message, ...args),
      error: (message, ...args) => this.error(moduleName, message, ...args),
      performance: (operation, startTime, endTime) => this.performance(moduleName, operation, startTime, endTime)
    };
  }

  /**
   * 设置日志级别
   * @param {number|string} level - 日志级别
   */
  setLevel(level) {
    if (typeof level === 'string') {
      level = this._getLevelFromString(level);
    }
    this.level = level;
  }

  /**
   * 获取日志级别
   * @returns {number} 当前日志级别
   */
  getLevel() {
    return this.level;
  }

  /**
   * 获取日志记录
   * @param {Object} filters - 过滤条件
   * @param {string} filters.module - 模块名称
   * @param {number} filters.level - 日志级别
   * @param {number} filters.startTime - 开始时间戳
   * @param {number} filters.endTime - 结束时间戳
   * @param {number} filters.limit - 限制数量
   * @returns {Array} 日志记录数组
   */
  getLogs(filters = {}) {
    let logs = [...this.logBuffer];

    if (filters.module) {
      logs = logs.filter(log => log.module === filters.module);
    }

    if (filters.level !== undefined) {
      logs = logs.filter(log => log.level >= filters.level);
    }

    if (filters.startTime) {
      logs = logs.filter(log => log.timestamp >= filters.startTime);
    }

    if (filters.endTime) {
      logs = logs.filter(log => log.timestamp <= filters.endTime);
    }

    if (filters.limit && filters.limit > 0) {
      logs = logs.slice(-filters.limit);
    }

    return logs;
  }

  /**
   * 清除日志记录
   * @param {Object} filters - 过滤条件，不传则清除所有
   */
  clearLogs(filters = {}) {
    if (Object.keys(filters).length === 0) {
      this.logBuffer = [];
    } else {
      this.logBuffer = this.logBuffer.filter(log => {
        if (filters.module && log.module === filters.module) {
          return false;
        }
        if (filters.level !== undefined && log.level < filters.level) {
          return false;
        }
        if (filters.startTime && log.timestamp < filters.startTime) {
          return false;
        }
        if (filters.endTime && log.timestamp > filters.endTime) {
          return false;
        }
        return true;
      });
    }

    if (this.enableStorage) {
      this._saveLogs();
    }
  }

  /**
   * 导出日志
   * @param {string} format - 导出格式（'json' | 'text'）
   * @param {Object} filters - 过滤条件
   * @returns {string} 导出的日志内容
   */
  exportLogs(format = 'json', filters = {}) {
    const logs = this.getLogs(filters);

    if (format === 'text') {
      return logs.map(log => {
        const time = new Date(log.timestamp).toISOString();
        const level = Logger.LEVEL_NAMES[log.level];
        return `[${time}] [${level}] [${log.module}] ${log.message} ${log.args ? JSON.stringify(log.args) : ''}`;
      }).join('\n');
    }

    return JSON.stringify(logs, null, 2);
  }

  /**
   * 获取模块列表
   * @returns {string[]} 模块名称数组
   */
  getModules() {
    return Array.from(this.modules);
  }

  /**
   * 获取统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    const stats = {
      totalLogs: this.logBuffer.length,
      moduleCount: this.modules.size,
      levelCounts: {},
      recentLogs: 0
    };

    // 统计各级别日志数量
    Object.values(Logger.LEVEL).forEach(level => {
      if (typeof level === 'number') {
        stats.levelCounts[Logger.LEVEL_NAMES[level]] = 0;
      }
    });

    const oneHourAgo = Date.now() - 60 * 60 * 1000;

    this.logBuffer.forEach(log => {
      const levelName = Logger.LEVEL_NAMES[log.level];
      if (levelName) {
        stats.levelCounts[levelName]++;
      }

      if (log.timestamp > oneHourAgo) {
        stats.recentLogs++;
      }
    });

    return stats;
  }

  /**
   * 内部日志记录方法
   * @private
   * @param {number} level - 日志级别
   * @param {string} module - 模块名称
   * @param {string} message - 日志消息
   * @param {...any} args - 额外参数
   */
  _log(level, module, message, ...args) {
    if (level < this.level) {
      return;
    }

    const logEntry = {
      level,
      module,
      message,
      args: args.length > 0 ? args : null,
      timestamp: Date.now(),
      id: this._generateLogId()
    };

    // 添加到缓冲区
    this.logBuffer.push(logEntry);

    // 限制缓冲区大小
    if (this.logBuffer.length > this.maxStorageSize) {
      this.logBuffer = this.logBuffer.slice(-this.maxStorageSize);
    }

    // 控制台输出
    if (this.enableConsole) {
      this._outputToConsole(logEntry);
    }

    // 存储到本地
    if (this.enableStorage) {
      this._saveLogs();
    }
  }

  /**
   * 输出到控制台
   * @private
   * @param {Object} logEntry - 日志条目
   */
  _outputToConsole(logEntry) {
    const time = new Date(logEntry.timestamp).toISOString();
    const levelName = Logger.LEVEL_NAMES[logEntry.level];
    const prefix = `[${time}] [${levelName}] [${this.prefix}:${logEntry.module}]`;

    const args = logEntry.args ? [prefix, logEntry.message, ...logEntry.args] : [prefix, logEntry.message];

    switch (logEntry.level) {
    case Logger.LEVEL.DEBUG:
      console.debug(...args);
      break;
    case Logger.LEVEL.INFO:
      console.info(...args);
      break;
    case Logger.LEVEL.WARN:
      console.warn(...args);
      break;
    case Logger.LEVEL.ERROR:
      console.error(...args);
      break;
    }
  }

  /**
   * 保存日志到本地存储
   * @private
   */
  _saveLogs() {
    try {
      const data = {
        logs: this.logBuffer,
        modules: Array.from(this.modules),
        timestamp: Date.now()
      };
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save logs to localStorage:', error);
    }
  }

  /**
   * 从本地存储加载日志
   * @private
   */
  _loadStoredLogs() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        const parsed = JSON.parse(data);
        this.logBuffer = parsed.logs || [];
        this.modules = new Set(parsed.modules || []);
      }
    } catch (error) {
      console.warn('Failed to load logs from localStorage:', error);
    }
  }

  /**
   * 从字符串获取日志级别
   * @private
   * @param {string} levelName - 级别名称
   * @returns {number} 日志级别
   */
  _getLevelFromString(levelName) {
    const upperName = (levelName || '').toUpperCase();
    return Logger.LEVEL[upperName];
  }

  /**
   * 生成日志ID
   * @private
   * @returns {string} 唯一ID
   */
  _generateLogId() {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// 创建全局日志器实例
const globalLogger = new Logger({
  prefix: 'Gomoku',
  level: Logger.LEVEL.INFO,
  enableConsole: true,
  enableStorage: true
});

// 模块元信息
Logger.__moduleInfo = {
  name: 'Logger',
  version: '2.0.0',
  dependencies: [],
  description: '日志工具，提供统一的日志记录功能'
};

// 导出模块
if (typeof window !== 'undefined') {
  window.Logger = Logger;
  window.logger = globalLogger;
}
