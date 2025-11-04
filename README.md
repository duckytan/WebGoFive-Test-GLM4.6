# H5 五子棋 v2.0

一个基于 HTML5 Canvas 的五子棋游戏，采用原生 JavaScript ES2020 开发，支持双人对战、人机对战和机机对战三种模式。

## ✨ 特性

- 🎮 **三种游戏模式**：双人对战 (PvP)、人机对战 (PvE)、机机对战 (EvE)
- 🧠 **四级 AI 难度**：新手、正常、困难、地狱
- 🚫 **完整禁手规则**：支持黑棋的三三、四四、长连禁手检测
- 💾 **存档系统**：本地存储游戏进度，支持导入导出
- 🎬 **回放功能**：完整的棋局回放，支持播放控制
- 📱 **响应式设计**：支持桌面端和移动端
- 🎨 **精美动画**：流畅的落子动画和特效
- 🔧 **开发者工具**：完整的调试和测试工具

## 🛠️ 技术栈

- **语言**：JavaScript ES2020
- **渲染**：HTML5 Canvas 2D API
- **架构**：MVC + 事件驱动
- **测试**：Vitest
- **工具**：ESLint + Prettier

## 📁 项目结构

```
h5-gomoku-v2/
├── css/                    # 样式文件
│   ├── style.css          # 主样式
│   └── animations.css     # 动画样式
├── js/                     # JavaScript 模块
│   ├── core/              # 核心模块
│   │   ├── GameState.js   # 游戏状态管理
│   │   ├── RuleEngine.js  # 规则引擎
│   │   └── AIEngine.js    # AI 引擎
│   ├── ui/                # UI 模块
│   │   ├── CanvasRenderer.js # Canvas 渲染器
│   │   └── HudPanel.js    # HUD 面板
│   ├── services/          # 服务模块
│   │   ├── SaveLoadService.js # 存档服务
│   │   └── ReplayService.js  # 回放服务
│   ├── utils/             # 工具模块
│   │   ├── EventBus.js    # 事件总线
│   │   └── Logger.js      # 日志工具
│   ├── ModeManager.js     # 模式管理器
│   ├── GameController.js  # 游戏控制器
│   └── main.js           # 主入口文件
├── test/                  # 测试文件
├── doc/                   # 项目文档
├── index.html            # 主页面
└── README.md             # 项目说明
```

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

然后在浏览器中打开 `http://localhost:8080`

### 运行测试

```bash
npm test
```

### 代码检查和格式化

```bash
npm run lint
npm run format
```

## 🎮 游戏操作

### 基本操作

- **落子**：点击棋盘空位
- **悔棋**：点击"悔棋"按钮或按 `Ctrl+Z`
- **新游戏**：点击"新游戏"按钮或按 `Ctrl+N`
- **保存**：点击"保存"按钮或按 `Ctrl+S`
- **提示**：点击"提示"按钮获得落子建议

### 快捷键

- `Ctrl+Z`：悔棋
- `Ctrl+N`：新游戏
- `Ctrl+S`：保存游戏
- `F11`：切换全屏
- `F12`：切换调试模式

## 🧠 AI 难度说明

| 难度 | 算法 | 响应时间 | 特点 |
|------|------|----------|------|
| 新手 | 随机+简单防守 | <600ms | 适合初学者，AI会犯错 |
| 正常 | Minimax + Alpha-Beta | <1000ms | 普通难度，有一定挑战性 |
| 困难 | 深度搜索+威胁分析 | <2000ms | 较强AI，需要认真思考 |
| 地狱 | 威胁空间搜索 | <2400ms | 最强AI，接近专业水平 |

## 🏗️ 架构设计

### 分层架构

```
┌─────────────────────────────────────────────┐
│           Presentation Layer（展示层）        │
│  CanvasRenderer  HudPanel  Dialog            │
└───────────────────┬─────────────────────────┘
                     │ Events / State Sync
┌─────────────────────────────────────────────┐
│          Application Layer（应用层）         │
│  ModeManager  GameController                │
└───────────────────┬─────────────────────────┘
                     │ Calls Logic APIs
┌─────────────────────────────────────────────┐
│            Logic Layer（逻辑层）             │
│  RuleEngine  AIEngine                       │
└───────────────────┬─────────────────────────┘
                     │ Operate on Data
┌─────────────────────────────────────────────┐
│            Data Layer（数据层）              │
│  GameState  MoveHistory                     │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│           Service Layer（服务层）            │
│  SaveLoadService  ReplayService  Utils      │
└─────────────────────────────────────────────┘
```

### 核心模块

- **GameState**：游戏状态管理，维护棋盘数据和历史记录
- **RuleEngine**：规则引擎，处理胜负判定和禁手检测
- **AIEngine**：AI引擎，提供不同难度的AI策略
- **CanvasRenderer**：Canvas渲染器，负责游戏画面渲染
- **ModeManager**：模式管理器，控制游戏流程和模式切换

## 🧪 测试

项目使用 Vitest 进行单元测试，核心模块都有完整的测试覆盖。

```bash
# 运行所有测试
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage

# 运行测试UI
npm run test:ui
```

## 🔧 开发者工具

在浏览器控制台中，可以使用 `window.GomokuDev` 或 `window.g` 访问开发者工具：

```javascript
// 获取应用状态
g.debug.getState()

// 获取游戏状态
g.debug.getGameState()

// 切换调试模式
g.debug.toggleDebugMode()

// 创建测试棋局
g.test.createTestGame([{x:7,y:7},{x:7,y:8}])

// 测试AI性能
g.debug.testAIPerformance('NORMAL', 10)
```

## 📝 更新日志

### v2.0.0 (2024-01-04)

- 🎉 全新架构重构，采用模块化设计
- ✨ 新增机机对战模式
- 🧠 AI引擎升级，支持威胁空间搜索
- 💾 完整的存档和回放系统
- 📱 响应式设计，支持移动端
- 🎨 全新UI设计，支持动画效果
- 🔧 完善的开发者工具和测试覆盖

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🎯 未来计划

- [ ] 在线对战功能
- [ ] 更多AI算法
- [ ] 自定义棋盘大小
- [ ] 主题系统
- [ ] 多语言支持
- [ ] 音效系统

---

**享受游戏！** 🎉