/**
 * 事件总线 - 实现模块间解耦通信
 *
 * 职责：
 * - 提供发布/订阅模式的事件系统
 * - 支持事件监听、触发、移除
 * - 支持一次性监听器
 * - 提供事件历史记录功能
 */

class EventBus {
  constructor() {
    this.events = new Map();
    this.onceEvents = new Map();
    this.eventHistory = [];
    this.maxHistorySize = 100;
  }

  /**
   * 订阅事件
   * @param {string} eventName - 事件名称
   * @param {Function} callback - 回调函数
   * @param {Object} options - 选项
   * @param {boolean} options.once - 是否只触发一次
   * @param {number} options.priority - 优先级（数值越大优先级越高）
   * @returns {Function} 取消订阅函数
   */
  on(eventName, callback, options = {}) {
    if (typeof eventName !== 'string' || typeof callback !== 'function') {
      throw new Error('Event name must be string and callback must be function');
    }

    const listener = {
      callback,
      priority: options.priority || 0,
      context: options.context || null,
      id: this._generateListenerId()
    };

    const targetMap = options.once ? this.onceEvents : this.events;

    if (!targetMap.has(eventName)) {
      targetMap.set(eventName, []);
    }

    const listeners = targetMap.get(eventName);
    listeners.push(listener);

    // 按优先级排序（高优先级先执行）
    listeners.sort((a, b) => b.priority - a.priority);

    // 返回取消订阅函数
    return () => this.off(eventName, listener.id);
  }

  /**
   * 订阅一次性事件
   * @param {string} eventName - 事件名称
   * @param {Function} callback - 回调函数
   * @param {Object} options - 选项
   * @returns {Function} 取消订阅函数
   */
  once(eventName, callback, options = {}) {
    return this.on(eventName, callback, { ...options, once: true });
  }

  /**
   * 取消订阅事件
   * @param {string} eventName - 事件名称
   * @param {string|Function} listenerIdOrCallback - 监听器ID或回调函数
   */
  off(eventName, listenerIdOrCallback) {
    if (!this.events.has(eventName) && !this.onceEvents.has(eventName)) {
      return;
    }

    const removeFromMap = (map) => {
      if (!map.has(eventName)) {
        return;
      }

      const listeners = map.get(eventName);
      const filteredListeners = listeners.filter(listener => {
        if (typeof listenerIdOrCallback === 'string') {
          return listener.id !== listenerIdOrCallback;
        } else {
          return listener.callback !== listenerIdOrCallback;
        }
      });

      if (filteredListeners.length === 0) {
        map.delete(eventName);
      } else {
        map.set(eventName, filteredListeners);
      }
    };

    removeFromMap(this.events);
    removeFromMap(this.onceEvents);
  }

  /**
   * 触发事件
   * @param {string} eventName - 事件名称
   * @param {...any} args - 传递给监听器的参数
   * @returns {boolean} 是否有监听器处理了该事件
   */
  emit(eventName, ...args) {
    if (typeof eventName !== 'string') {
      throw new Error('Event name must be string');
    }

    // 记录事件历史
    this._recordEvent(eventName, args);

    let hasListeners = false;
    const allListeners = [];

    // 收集普通监听器
    if (this.events.has(eventName)) {
      allListeners.push(...this.events.get(eventName));
    }

    // 收集一次性监听器
    if (this.onceEvents.has(eventName)) {
      allListeners.push(...this.onceEvents.get(eventName));
      // 清除一次性监听器
      this.onceEvents.delete(eventName);
    }

    if (allListeners.length === 0) {
      return false;
    }

    hasListeners = true;

    // 执行所有监听器
    allListeners.forEach(listener => {
      try {
        if (listener.context) {
          listener.callback.apply(listener.context, args);
        } else {
          listener.callback(...args);
        }
      } catch (error) {
        console.error(`Error in event listener for '${eventName}':`, error);
      }
    });

    return hasListeners;
  }

  /**
   * 获取事件的监听器数量
   * @param {string} eventName - 事件名称
   * @returns {number} 监听器数量
   */
  listenerCount(eventName) {
    const normalCount = this.events.has(eventName) ? this.events.get(eventName).length : 0;
    const onceCount = this.onceEvents.has(eventName) ? this.onceEvents.get(eventName).length : 0;
    return normalCount + onceCount;
  }

  /**
   * 获取所有事件名称
   * @returns {string[]} 事件名称数组
   */
  eventNames() {
    const normalEvents = Array.from(this.events.keys());
    const onceEvents = Array.from(this.onceEvents.keys());
    return [...new Set([...normalEvents, ...onceEvents])];
  }

  /**
   * 清除所有监听器
   * @param {string} eventName - 可选，指定事件名称，不传则清除所有
   */
  removeAllListeners(eventName) {
    if (eventName) {
      this.events.delete(eventName);
      this.onceEvents.delete(eventName);
    } else {
      this.events.clear();
      this.onceEvents.clear();
    }
  }

  /**
   * 获取事件历史
   * @param {string} eventName - 可选，指定事件名称
   * @param {number} limit - 可选，限制返回数量
   * @returns {Array} 事件历史数组
   */
  getEventHistory(eventName, limit) {
    let history = this.eventHistory;

    if (eventName) {
      history = history.filter(event => event.name === eventName);
    }

    if (limit && limit > 0) {
      history = history.slice(-limit);
    }

    return history;
  }

  /**
   * 清除事件历史
   */
  clearEventHistory() {
    this.eventHistory = [];
  }

  /**
   * 等待事件触发（Promise版本）
   * @param {string} eventName - 事件名称
   * @param {number} timeout - 可选，超时时间（毫秒）
   * @returns {Promise} Promise对象
   */
  waitFor(eventName, timeout) {
    return new Promise((resolve, reject) => {
      let timeoutId;

      const cleanup = this.once(eventName, (...args) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        resolve(args);
      });

      if (timeout) {
        timeoutId = setTimeout(() => {
          cleanup();
          reject(new Error(`Event '${eventName}' timeout after ${timeout}ms`));
        }, timeout);
      }
    });
  }

  /**
   * 生成监听器ID
   * @private
   * @returns {string} 唯一ID
   */
  _generateListenerId() {
    return `listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 记录事件历史
   * @private
   * @param {string} eventName - 事件名称
   * @param {Array} args - 事件参数
   */
  _recordEvent(eventName, args) {
    const eventRecord = {
      name: eventName,
      args,
      timestamp: Date.now(),
      id: this._generateListenerId()
    };

    this.eventHistory.push(eventRecord);

    // 限制历史记录大小
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * 获取调试信息
   * @returns {Object} 调试信息
   */
  getDebugInfo() {
    return {
      eventCount: this.events.size,
      onceEventCount: this.onceEvents.size,
      totalListeners: this.eventNames().reduce((total, name) => total + this.listenerCount(name), 0),
      eventHistorySize: this.eventHistory.length,
      eventNames: this.eventNames()
    };
  }
}

// 模块元信息
EventBus.__moduleInfo = {
  name: 'EventBus',
  version: '2.0.0',
  dependencies: [],
  description: '事件总线，提供模块间解耦通信机制'
};

// 导出模块
if (typeof window !== 'undefined') {
  window.EventBus = EventBus;
}
