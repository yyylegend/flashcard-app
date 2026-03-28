# 🧠 八股文速记

一个用于面试备考的闪卡应用，支持分类刷题、测试模式、错题回顾、AI 生成题目、Markdown 笔记等功能。

> 此项目由 Claude Code 生成。

## 功能特性

### 闪卡
- 多题库管理，支持分类筛选和答题卡快速跳转
- 测试模式，自动记录掌握/复习状态，完成后撒彩带庆祝
- 错题回顾
- 手动添加、编辑、删除卡片
- **键盘快捷键**：`Space` 显示/隐藏答案，`←` `→` 切换题目

### AI
- AI 一键生成题目（调用 Claude API）
- 导入文档（PDF / TXT / MD / DOCX）由 AI 解析生成题目
- 从笔记一键生成闪卡题库

### 笔记
- 上传或新建 Markdown 笔记，多用户共享可见
- 渲染支持：代码高亮、KaTeX 数学公式、表格、引用块
- 右侧目录导航（TOC），点击标题快速定位
- 标签管理，仅上传者可编辑/删除

### 其他
- 用户登录（JWT 认证），成绩按用户隔离
- 深色 / 浅色主题切换
- Toast 操作反馈

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 19 + Vite 8 |
| 动画 | Framer Motion |
| 图标 | Lucide React |
| Markdown | Marked + Highlight.js + KaTeX |
| 后端 | Python Flask + SQLite |
| 认证 | JWT (HS256，自实现) |
| AI | Claude API (claude-sonnet-4) |

## 项目结构

```
flashcard-app/
├── backend/
│   ├── app.py              # Flask API 服务
│   ├── requirements.txt    # Python 依赖
│   └── flashcards.db       # SQLite 数据库（自动创建）
├── frontend/
│   ├── src/
│   │   ├── App.jsx         # 主应用组件（闪卡、测试、错题回顾）
│   │   ├── Notes.jsx       # 笔记模块
│   │   ├── api.js          # 后端 API 封装
│   │   ├── index.css       # 全局样式 & CSS 变量主题
│   │   └── main.jsx        # 入口
│   ├── index.html
│   └── package.json
├── kill_ports.ps1          # 一键关闭前后端端口（Windows）
└── README.md
```

## 快速开始

### 1. 启动后端

```bash
cd backend

# 创建虚拟环境（推荐）
python -m venv venv
source venv/bin/activate      # Mac/Linux
# venv\Scripts\activate       # Windows

# 安装依赖
pip install -r requirements.txt

# 启动
python app.py
```

后端运行在 `http://localhost:5000`，首次启动自动建表并导入默认题库（80题）。

### 2. 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端运行在 `http://localhost:5173`。

### 3. 环境变量

前端 `.env` 文件：

```
VITE_API_BASE=http://localhost:5000
```

### 4. Windows 一键关闭端口

```powershell
.\kill_ports.ps1
```

## 内置题库（80题）

| 题库 | 题数 | 内容 |
|------|------|------|
| Python 基础 | 30题 | 数据类型、函数、OOP、并发、实战 |
| 计算机网络 | 10题 | TCP/UDP、HTTP、三次握手、URL全过程 |
| 操作系统 | 10题 | 进程线程、死锁、虚拟内存、调度算法 |
| 数据库 SQL | 10题 | 索引、事务、隔离级别、优化、锁 |
| 测试理论 | 10题 | 用例设计、黑白盒、接口、性能、Bug管理 |
| Linux 基础 | 10题 | grep/awk/sed、进程、权限、Shell |

## API 接口

| 方法 | 路径 | 说明 | 需要登录 |
|------|------|------|---------|
| POST | `/api/login` | 用户登录 | ❌ |
| GET | `/api/decks` | 获取所有题库和卡片 | ❌ |
| POST | `/api/decks` | 创建新题库 | ✅ |
| DELETE | `/api/decks/:id` | 删除题库 | ✅ |
| POST | `/api/cards` | 创建卡片 | ✅ |
| PUT | `/api/cards/:id` | 更新卡片 | ✅ |
| DELETE | `/api/cards/:id` | 删除卡片 | ✅ |
| GET | `/api/scores` | 获取当前用户成绩 | ✅ |
| POST | `/api/scores` | 记录答题结果 | ✅ |
| POST | `/api/reset` | 重置当前用户成绩 | ✅ |
| POST | `/api/ai` | Claude AI 代理 | ✅ |
| GET | `/api/notes` | 获取所有笔记（共享） | ✅ |
| POST | `/api/notes` | 创建笔记 | ✅ |
| GET | `/api/notes/:id` | 获取单条笔记 | ✅ |
| PUT | `/api/notes/:id` | 更新笔记（仅上传者） | ✅ |
| DELETE | `/api/notes/:id` | 删除笔记（仅上传者） | ✅ |

## 数据备份

所有数据存储在 `backend/flashcards.db`，复制该文件即可备份。

```bash
# 备份
cp backend/flashcards.db backup_$(date +%Y%m%d).db

# 恢复
cp backup_20240101.db backend/flashcards.db
```
