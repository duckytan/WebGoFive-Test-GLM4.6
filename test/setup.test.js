/**
 * 测试套件入口文件
 */

// 导入所有测试文件
import './GameState.test.js';

// 全局测试配置
import { expect, vi } from 'vitest';

// 模拟浏览器API
Object.defineProperty(window, 'location', {
  value: {
    search: ''
  },
  writable: true
});

// 模拟performance API
global.performance = {
  now: vi.fn(() => Date.now()),
  memory: {
    usedJSHeapSize: 1000000,
    totalJSHeapSize: 2000000,
    jsHeapSizeLimit: 4000000
  }
};

// 模拟localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};
global.localStorage = localStorageMock;

// 模拟requestAnimationFrame
global.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16));
global.cancelAnimationFrame = vi.fn();

// 模拟Canvas API
const mockContext = {
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  getImageData: vi.fn(() => ({ data: new Array(4) })),
  putImageData: vi.fn(),
  createImageData: vi.fn(() => ({ data: new Array(4) })),
  setTransform: vi.fn(),
  drawImage: vi.fn(),
  save: vi.fn(),
  fillText: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  stroke: vi.fn(),
  translate: vi.fn(),
  scale: vi.fn(),
  rotate: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  measureText: vi.fn(() => ({ width: 0 })),
  transform: vi.fn(),
  rect: vi.fn(),
  clip: vi.fn(),
  createLinearGradient: vi.fn(() => ({
    addColorStop: vi.fn()
  })),
  createRadialGradient: vi.fn(() => ({
    addColorStop: vi.fn()
  }))
};

HTMLCanvasElement.prototype.getContext = vi.fn(() => mockContext);

// 模拟DOM元素
Object.defineProperty(HTMLCanvasElement.prototype, 'width', {
  get: function() { return this._width || 600; },
  set: function(value) { this._width = value; }
});

Object.defineProperty(HTMLCanvasElement.prototype, 'height', {
  get: function() { return this._height || 600; },
  set: function(value) { this._height = value; }
});

// 模拟document方法
document.getElementById = vi.fn((id) => {
  if (id === 'game-canvas') {
    return {
      tagName: 'CANVAS',
      width: 600,
      height: 600,
      style: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };
  }
  return null;
});

document.querySelector = vi.fn(() => null);
document.querySelectorAll = vi.fn(() => []);
document.createElement = vi.fn((tagName) => {
  const element = {
    tagName: tagName.toUpperCase(),
    innerHTML: '',
    textContent: '',
    className: '',
    style: {},
    classList: {
      add: vi.fn(),
      remove: vi.fn(),
      toggle: vi.fn(),
      contains: vi.fn()
    },
    appendChild: vi.fn(),
    removeChild: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    setAttribute: vi.fn(),
    getAttribute: vi.fn()
  };
  
  if (tagName === 'canvas') {
    element.getContext = vi.fn(() => mockContext);
  }
  
  return element;
});

// 模拟CustomEvent
global.CustomEvent = class CustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
    this.bubbles = options.bubbles || false;
    this.cancelable = options.cancelable || false;
  }
};

// 模拟dispatchEvent
window.dispatchEvent = vi.fn();

// 模拟console方法（避免测试输出过多噪音）
global.console = {
  ...console,
  log: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};

// 模拟setTimeout/setInterval
global.setTimeout = setTimeout;
global.clearTimeout = clearTimeout;
global.setInterval = setInterval;
global.clearInterval = clearInterval;

// 模拟btoa/atob（用于base64编码）
global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
global.atob = (str) => Buffer.from(str, 'base64').toString('binary');

// 模拟navigator
global.navigator = {
  userAgent: 'Test Browser',
  platform: 'Test Platform',
  language: 'zh-CN'
};

// 模拟Date
global.Date = Date;

console.log('🧪 Test environment initialized');