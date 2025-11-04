/**
 * GameState 测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// 导入GameState类
import '../js/core/GameState.js';

// 模拟依赖
const mockEventBus = {
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn()
};

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  performance: vi.fn(),
  createModuleLogger: vi.fn(() => mockLogger)
};

// 模拟全局logger
global.logger = mockLogger;

describe('GameState', () => {
  let gameState;

  beforeEach(() => {
    // 重置模拟
    vi.clearAllMocks();
    
    // 创建新实例
    gameState = new GameState(mockEventBus);
  });

  describe('初始化', () => {
    it('应该正确初始化游戏状态', () => {
      expect(gameState.boardSize).toBe(15);
      expect(gameState.currentPlayer).toBe(1);
      expect(gameState.moveHistory).toEqual([]);
      expect(gameState.gameStatus).toBe('ready');
      expect(gameState.winner).toBe(null);
    });

    it('应该有正确的默认设置', () => {
      expect(gameState.settings.forbiddenRules).toBe(true);
      expect(gameState.settings.aiDifficulty).toBe('NORMAL');
      expect(gameState.settings.boardSize).toBe(15);
    });
  });

  describe('落子操作', () => {
    it('应该能够成功落子', () => {
      const result = gameState.applyMove(7, 7);
      
      expect(result.success).toBe(true);
      expect(gameState.board[7][7]).toBe(1);
      expect(gameState.moveHistory.length).toBe(1);
      expect(gameState.moveCount).toBe(1);
      expect(gameState.gameStatus).toBe('playing');
    });

    it('应该拒绝无效坐标', () => {
      expect(() => gameState.applyMove(-1, 0)).toThrow('Invalid position');
      expect(() => gameState.applyMove(15, 0)).toThrow('Invalid position');
      expect(() => gameState.applyMove(0, -1)).toThrow('Invalid position');
      expect(() => gameState.applyMove(0, 15)).toThrow('Invalid position');
    });

    it('应该拒绝占用位置', () => {
      gameState.applyMove(7, 7);
      expect(() => gameState.applyMove(7, 7)).toThrow('Position occupied');
    });

    it('应该正确切换玩家', () => {
      gameState.applyMove(7, 7);
      gameState.switchPlayer();
      expect(gameState.currentPlayer).toBe(2);
    });

    it('应该能够悔棋', () => {
      gameState.applyMove(7, 7);
      gameState.applyMove(7, 8);
      
      const result = gameState.undoMove();
      
      expect(result.success).toBe(true);
      expect(gameState.moveHistory.length).toBe(1);
      expect(gameState.board[7][8]).toBe(0);
      expect(gameState.currentPlayer).toBe(2);
    });

    it('应该能够重置游戏', () => {
      gameState.applyMove(7, 7);
      gameState.applyMove(7, 8);
      
      gameState.reset();
      
      expect(gameState.moveHistory).toEqual([]);
      expect(gameState.moveCount).toBe(0);
      expect(gameState.currentPlayer).toBe(1);
      expect(gameState.gameStatus).toBe('ready');
      
      // 检查棋盘是否清空
      for (let y = 0; y < 15; y++) {
        for (let x = 0; x < 15; x++) {
          expect(gameState.board[y][x]).toBe(0);
        }
      }
    });
  });

  describe('状态快照', () => {
    it('应该能够创建状态快照', () => {
      gameState.applyMove(7, 7);
      gameState.applyMove(7, 8);
      
      const snapshot = gameState.getSnapshot();
      
      expect(snapshot.board[7][7]).toBe(1);
      expect(snapshot.board[7][8]).toBe(2);
      expect(snapshot.currentPlayer).toBe(2);
      expect(snapshot.moveHistory.length).toBe(2);
      expect(snapshot.moveCount).toBe(2);
    });

    it('应该能够从快照恢复状态', () => {
      gameState.applyMove(7, 7);
      gameState.applyMove(7, 8);
      
      const snapshot = gameState.getSnapshot();
      gameState.reset();
      gameState.restoreSnapshot(snapshot);
      
      expect(gameState.board[7][7]).toBe(1);
      expect(gameState.board[7][8]).toBe(2);
      expect(gameState.currentPlayer).toBe(2);
      expect(gameState.moveHistory.length).toBe(2);
    });

    it('快照应该是深拷贝', () => {
      gameState.applyMove(7, 7);
      const snapshot = gameState.getSnapshot();
      
      // 修改快照不应该影响原状态
      snapshot.board[7][7] = 2;
      expect(gameState.board[7][7]).toBe(1);
    });
  });

  describe('禁手管理', () => {
    it('应该能够添加禁手位置', () => {
      gameState.addForbiddenMove(7, 7);
      expect(gameState.isForbiddenMove(7, 7)).toBe(true);
    });

    it('应该能够移除禁手位置', () => {
      gameState.addForbiddenMove(7, 7);
      gameState.removeForbiddenMove(7, 7);
      expect(gameState.isForbiddenMove(7, 7)).toBe(false);
    });

    it('应该正确检查禁手位置', () => {
      gameState.addForbiddenMove(7, 7);
      gameState.addForbiddenMove(7, 8);
      
      expect(gameState.isForbiddenMove(7, 7)).toBe(true);
      expect(gameState.isForbiddenMove(7, 8)).toBe(true);
      expect(gameState.isForbiddenMove(7, 9)).toBe(false);
    });
  });

  describe('设置管理', () => {
    it('应该能够更新设置', () => {
      const newSettings = {
        forbiddenRules: false,
        aiDifficulty: 'HARD'
      };
      
      gameState.updateSettings(newSettings);
      
      expect(gameState.settings.forbiddenRules).toBe(false);
      expect(gameState.settings.aiDifficulty).toBe('HARD');
    });

    it('棋盘大小改变时应该重置游戏', () => {
      gameState.applyMove(7, 7);
      
      gameState.updateSettings({ boardSize: 19 });
      
      expect(gameState.boardSize).toBe(19);
      expect(gameState.moveHistory).toEqual([]);
    });
  });

  describe('游戏状态管理', () => {
    it('应该能够设置游戏状态', () => {
      gameState.setGameStatus('playing');
      expect(gameState.gameStatus).toBe('playing');
    });

    it('应该能够设置获胜者', () => {
      gameState.setWinner(1, [{x: 7, y: 7}, {x: 8, y: 8}]);
      
      expect(gameState.winner).toBe(1);
      expect(gameState.gameStatus).toBe('finished');
    });

    it('应该能够设置游戏模式', () => {
      gameState.setMode('PvE');
      expect(gameState.mode).toBe('PvE');
    });
  });

  describe('工具方法', () => {
    it('应该正确验证坐标', () => {
      expect(gameState.isValidPosition(0, 0)).toBe(true);
      expect(gameState.isValidPosition(14, 14)).toBe(true);
      expect(gameState.isValidPosition(15, 15)).toBe(false);
      expect(gameState.isValidPosition(-1, -1)).toBe(false);
    });

    it('应该能够获取和设置棋子', () => {
      gameState.setPiece(7, 7, 1);
      expect(gameState.getPiece(7, 7)).toBe(1);
      
      gameState.setPiece(7, 7, 0);
      expect(gameState.getPiece(7, 7)).toBe(0);
    });

    it('无效坐标应该返回null', () => {
      expect(gameState.getPiece(-1, 0)).toBe(null);
      expect(gameState.getPiece(15, 0)).toBe(null);
    });
  });

  describe('状态验证', () => {
    it('应该验证正确的状态', () => {
      const validation = gameState.validateState();
      expect(validation.valid).toBe(true);
      expect(validation.issues).toEqual([]);
    });

    it('应该检测棋盘大小不匹配', () => {
      gameState.boardSize = 19;
      const validation = gameState.validateState();
      expect(validation.valid).toBe(false);
      expect(validation.issues).toContain('Board size mismatch');
    });

    it('应该检测棋子数量不匹配', () => {
      gameState.moveHistory.push({x: 7, y: 7, player: 1});
      const validation = gameState.validateState();
      expect(validation.valid).toBe(false);
      expect(validation.issues).toContain('Piece count mismatch');
    });
  });

  describe('统计信息', () => {
    it('应该提供正确的统计信息', () => {
      gameState.applyMove(7, 7);
      gameState.applyMove(7, 8);
      
      const stats = gameState.getStats();
      
      expect(stats.moveCount).toBe(2);
      expect(stats.blackMoves).toBe(1);
      expect(stats.whiteMoves).toBe(1);
      expect(stats.gameStatus).toBe('playing');
      expect(stats.mode).toBe('PvP');
    });
  });

  describe('事件触发', () => {
    it('落子时应该触发事件', () => {
      gameState.applyMove(7, 7);
      expect(mockEventBus.emit).toHaveBeenCalledWith('move:applied', expect.any(Object), expect.any(Object));
    });

    it('悔棋时应该触发事件', () => {
      gameState.applyMove(7, 7);
      gameState.undoMove();
      expect(mockEventBus.emit).toHaveBeenCalledWith('move:undone', expect.any(Object), expect.any(Object));
    });

    it('重置时应该触发事件', () => {
      gameState.reset();
      expect(mockEventBus.emit).toHaveBeenCalledWith('state:reset', expect.any(Object));
    });
  });
});