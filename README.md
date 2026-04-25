# Process - 在线画图 & 笔记工具

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Process** 是一个完全免费、开源的全栈在线画图与笔记平台，前后端解耦的 Monorepo 项目。

## ✨ 功能特性

| 功能 | 说明 |
|------|------|
| 🔐 用户认证 | 登录 / 忘记密码（邮件重置） / 修改密码 |
| 📊 流程图 | 基于 AntV X6 的在线流程图编辑，支持导出 PNG / JPG / SVG |
| 🧠 思维导图 | 基于 mind-elixir 的思维导图编辑，支持导出 PNG / JPG / XMind |
| 📝 Markdown | 功能完整的 Markdown 编辑器（md-editor-v3），支持导出 .md / HTML |
| 📌 随记 | 颜色标签随记，快速记录灵感 |

## 🛠 技术栈

### 前端

- **框架**：Vue 3 + Vite
- **UI**：Element Plus
- **状态管理**：Pinia
- **路由**：Vue Router 4
- **流程图**：AntV X6
- **思维导图**：mind-elixir
- **Markdown 编辑器**：md-editor-v3
- **HTTP 客户端**：Axios
- **图片导出**：html2canvas

### 后端

- **框架**：Spring Boot 3
- **安全**：Spring Security + JWT（jjwt）
- **ORM**：Spring Data JPA + Hibernate
- **数据库**：MySQL 8
- **邮件服务**：Spring Mail
- **构建工具**：Maven

## 📁 项目结构

```
Process/
├── frontend/              # Vue 3 + Vite 前端
│   ├── src/
│   │   ├── api/          # API 请求封装
│   │   ├── assets/       # 静态资源
│   │   ├── components/   # 公共组件
│   │   ├── router/       # 路由配置
│   │   ├── stores/       # Pinia 状态管理
│   │   ├── utils/        # 工具函数（axios 封装）
│   │   └── views/        # 页面视图
│   │       ├── auth/     # 登录 / 忘记密码 / 重置密码 / 个人设置
│   │       ├── flowchart/# 流程图列表 & 编辑器
│   │       ├── mindmap/  # 思维导图列表 & 编辑器
│   │       ├── markdown/ # Markdown 列表 & 编辑器
│   │       └── notes/    # 随记
│   ├── Dockerfile
│   └── nginx.conf
│
├── backend/               # Spring Boot 后端
│   └── src/main/java/com/process/
│       ├── config/        # 安全配置 / JPA 配置
│       ├── controller/    # REST 控制器
│       ├── dto/           # 数据传输对象
│       ├── entity/        # JPA 实体
│       ├── exception/     # 全局异常处理
│       ├── repository/    # Spring Data 仓库
│       ├── security/      # JWT 工具 / 过滤器
│       └── service/       # 业务逻辑
│
├── docker-compose.yml     # 一键部署配置
└── README.md
```

## 🚀 快速开始

### 方式一：Docker Compose（推荐）

```bash
# 克隆仓库
git clone https://github.com/your-boy/Process.git
cd Process

# 启动所有服务（MySQL + 后端 + 前端）
docker-compose up -d

# 访问 http://localhost
```

### 方式二：手动启动

#### 前置条件

- Node.js >= 18
- Java 17+
- Maven 3.9+
- MySQL 8.0+

#### 1. 初始化数据库

```sql
CREATE DATABASE process_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

#### 2. 创建初始用户

```sql
-- 密码为 "admin123" 的 bcrypt 哈希
INSERT INTO users (username, email, password, created_at, updated_at)
VALUES ('admin', 'admin@example.com',
        '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iKom2N/ufjFGM5hGSMsV2KJ8h97W',
        NOW(), NOW());
```

#### 3. 启动后端

```bash
cd backend

# 修改 src/main/resources/application.yml 中的数据库连接信息
# 然后启动
mvn spring-boot:run
```

后端运行在 http://localhost:8080/api

#### 4. 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端运行在 http://localhost:5173

## 🔑 环境变量

### 后端（application.yml 或环境变量）

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `SPRING_DATASOURCE_URL` | MySQL 连接 URL | `jdbc:mysql://localhost:3306/process_db` |
| `SPRING_DATASOURCE_USERNAME` | 数据库用户名 | `root` |
| `SPRING_DATASOURCE_PASSWORD` | 数据库密码 | `root` |
| `JWT_SECRET` | JWT 签名密钥（≥32字符） | 内置默认值（生产环境务必修改） |
| `MAIL_USERNAME` | 发件邮箱 | - |
| `MAIL_PASSWORD` | 邮箱授权码 | - |
| `FRONTEND_URL` | 前端地址（用于密码重置邮件链接） | `http://localhost:5173` |

## 📤 导出功能

| 类型 | 支持格式 |
|------|---------|
| 流程图 | PNG、JPG、SVG |
| 思维导图 | PNG、JPG、XMind (.xmind) |
| Markdown | .md 文件、HTML |

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

[MIT License](LICENSE) © 2024 your-boy
