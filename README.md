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
- AI 一键生成题目（调用 Dify Workflow）
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
| 前端 | React 19 + Vite |
| 样式 | Tailwind CSS v4 + shadcn/ui |
| 动画 | Framer Motion |
| 图标 | Lucide React |
| Markdown | Marked + Highlight.js + KaTeX |
| 后端 | Python Flask + PostgreSQL |
| 认证 | JWT (HS256，自实现) |
| AI | Dify Workflow API |
| 容器化 | Docker + Docker Compose |
| Web 服务器 | Nginx（反向代理 + 托管前端静态文件） |

## 项目结构

```
flashcard-app/
├── backend/
│   ├── app.py              # Flask API 服务
│   ├── requirements.txt    # Python 依赖
│   ├── Dockerfile
│   └── .env                # 环境变量（不提交）
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/         # shadcn/ui 基础组件（Button, Input, Textarea）
│   │   │   └── modals/     # 业务弹窗（登录、卡片编辑、AI生成、导入、确认）
│   │   ├── lib/
│   │   │   ├── utils.js    # cn() Tailwind 工具函数
│   │   │   ├── jsonRepair.js  # AI 返回 JSON 修复
│   │   │   └── fileLoaders.js # PDF/DOCX 文件解析
│   │   ├── App.jsx         # 主应用组件（闪卡、测试、错题回顾）
│   │   ├── Notes.jsx       # 笔记模块
│   │   ├── api.js          # 后端 API 封装
│   │   ├── index.css       # 全局样式 & CSS 变量主题（Tailwind v4）
│   │   └── main.jsx        # 入口
│   ├── nginx.conf          # Nginx 配置
│   ├── components.json     # shadcn/ui 配置
│   ├── jsconfig.json       # 路径别名配置
│   ├── Dockerfile
│   ├── index.html
│   └── package.json
├── docker-compose.yml      # 编排前端 + 后端 + 数据库
├── deploy.sh               # 服务器一键部署脚本
└── README.md
```

## 快速开始（Docker）

### 1. 配置环境变量

在 `backend/` 下创建 `.env` 文件：

```
DIFY_API_KEY=你的Dify API Key
JWT_SECRET=随机字符串
ADMIN1_USER=admin
ADMIN1_PASS=yourpassword
ADMIN2_USER=
ADMIN2_PASS=
```

### 2. 启动

```bash
docker compose up --build -d
```

访问 `http://localhost`，首次启动自动建表并导入默认题库（80题）。

### 3. 后续更新

```bash
docker compose build frontend   # 仅重建前端
docker compose up -d            # 重启容器
```

或一次重建全部：

```bash
docker compose up --build -d
```

## 部署到服务器

服务器需要安装 Docker 和 Docker Compose。

```bash
# 安装 Docker
curl -fsSL https://get.docker.com | sh

# 克隆代码
git clone https://github.com/yyylegend/flashcard-app.git
cd flashcard-app
git checkout dev

# 创建 backend/.env（填入真实密钥）
nano backend/.env

# 启动
docker compose up --build -d
```

### 一键更新部署

```bash
./deploy.sh
```

脚本会自动 `git pull` → 重建镜像 → 重启容器。

## 架构说明

```
浏览器 → :80 (Nginx)
              │
              ├── 静态文件 (React 构建产物)
              └── /api/* → Flask:5000 (后端容器)
                                │
                                └── PostgreSQL:5432 (数据库容器)
```

数据持久化到 Docker volume `pg_data`，容器重建后数据不丢失。

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
| POST | `/api/ai` | Dify AI 代理 | ✅ |
| GET | `/api/notes` | 获取所有笔记（共享） | ✅ |
| POST | `/api/notes` | 创建笔记 | ✅ |
| GET | `/api/notes/:id` | 获取单条笔记 | ✅ |
| PUT | `/api/notes/:id` | 更新笔记（仅上传者） | ✅ |
| DELETE | `/api/notes/:id` | 删除笔记（仅上传者） | ✅ |

## 数据备份

数据存储在 Docker volume `pg_data` 中。

```bash
# 备份
docker exec flashcard-db pg_dump -U postgres flashcards > backup_$(date +%Y%m%d).sql

# 恢复
docker exec -i flashcard-db psql -U postgres flashcards < backup_20240101.sql
```
