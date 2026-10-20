# Process

这是一个前后端分离的单仓项目：前端位于 `frontend/`，基于 Vue 3 + Vite；后端位于 `backend/`，基于 Spring Boot。项目当前实现覆盖单用户登录、忘记密码、修改密码、绘图、思维导图、Markdown、思维笔记，以及 PNG/JPG/PDF/XMind/.drawio 导出闭环。

编辑器支持多页文档、拖拽连线与折点、容器/分组、旋转节点（含旋转态缩放）、图片、超链接、工具提示、图层、参考线、中英文切换；`.drawio` 导入导出保留折点、容器、分组、旋转、图层、页面尺寸和压缩格式。

上线前请对照 [`docs/PRODUCTION-READINESS.md`](docs/PRODUCTION-READINESS.md) 配置生产环境变量、HTTPS、CORS、数据库备份和健康检查。

> 当前仓库已改造成“本地默认 H2、上线可切回 MySQL”的双配置模式。**本地开发不需要安装 MySQL。**

ENGLISH INTRODUCE:

This is a decoupled, full-stack monorepo project named "Process." The frontend is built with Vue 3 + Vite, and the backend uses Spring Boot. Local development uses an embedded file-based H2 database by default; the original MySQL 8 setup is preserved in a separate `prod` profile so it can be restored for online deployment.

## 环境要求

- Node.js 18+（推荐当前 LTS）
- JDK 17+（Spring Boot 3.5 要求）
- Maven 3.8+
- 本地运行**不需要** MySQL
- 只有切换到 `prod` 配置时才需要 MySQL 8.x

## 本地快速启动

### 1. 启动后端（默认 H2）

```powershell
cd D:\documents\personal\Process\backend
mvn spring-boot:run
```

默认配置会：

- 启动在 `http://localhost:8080`
- 使用文件型 H2 数据库：`backend/data/diagram_editor.mv.db`
- 自动创建 `app_user`、`diagram` 表
- 自动创建本地演示账号

本地演示账号（仅 `local` 配置有效）：

| 项目 | 值 |
| --- | --- |
| 用户名 | `demo` |
| 登录密码 | `demo123` |
| 恢复口令 | `RECOVER-2026` |
| 显示名 | `Local Demo User` |

H2 控制台：`http://localhost:8080/h2-console`

```text
JDBC URL: jdbc:h2:file:./data/diagram_editor;MODE=MySQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;DB_CLOSE_ON_EXIT=FALSE
用户名: sa
密码: （留空）
```

后端启动后可运行本地冒烟测试，验证登录、文档新增/查询/修改/删除：

```powershell
cd D:\documents\personal\Process\backend
node scripts\smoke-test-local.mjs
```

### 2. 启动前端

另开一个终端：

```powershell
cd D:\documents\personal\Process\frontend
npm install
npm run dev
```

浏览器打开 `http://127.0.0.1:5173`，使用上面的本地账号登录即可。

前端默认**同源**请求 `/api`，由 Vite 代理转发到 `http://127.0.0.1:8080`。这意味着：

- 不存在跨域（CORS），也不会因为 `localhost` 先解析到 IPv6 `::1` 而偶发连不上；
- Vite 端口被占用时默认**直接报错**（`VITE_DEV_STRICT_PORT=true`），不会静默顺延到 5174 之后被 CORS 拦掉。

所有开发期参数都在 `frontend/.env.example` 里，需要改时复制成 `frontend/.env.local`：

```dotenv
VITE_API_BASE_URL=                       # 留空 = 同源 /api（推荐）
VITE_DEV_HOST=127.0.0.1
VITE_DEV_PORT=5173
VITE_DEV_STRICT_PORT=true
VITE_DEV_API_PROXY_TARGET=http://127.0.0.1:8080
VITE_PREVIEW_PORT=4173
```

## 接口地址：三种部署形态

| 形态 | 前端 `VITE_API_BASE_URL` | 后端 `SERVER_ADDRESS` | 后端 `APP_CORS_ALLOWED_ORIGINS` |
| --- | --- | --- | --- |
| 本地开发（默认） | 留空（走 Vite 代理） | `127.0.0.1` | 不需要 |
| 上线：Nginx 同域反代 `/api` | 留空 | 同机 `127.0.0.1` / 分机 `0.0.0.0` | 不需要（留空） |
| 上线：前后端分域直连 | `https://api.example.com` | `0.0.0.0` | `https://app.example.com`（支持 `https://*.example.com` 通配） |

Nginx 同域反代示例：

```nginx
server {
    listen 443 ssl;
    server_name app.example.com;

    root /var/www/process/dist;          # npm run build 的产物
    location / {
        try_files $uri $uri/ /index.html;  # SPA 兜底
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8080;  # 保留 /api 前缀，不要加结尾的 /
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

> 反代场景下后端设 `APP_TRUST_FORWARDED_HEADERS=true`（`prod` 配置已默认开启），
> 否则限流与日志拿到的都是 Nginx 的 IP。

## 配置与上线切换（重要）

### 本地 / 上线文件对照

| 文件 | 用途 | 本地是否需要改 |
| --- | --- | --- |
| `backend/src/main/resources/application.properties` | 公共配置；默认激活 `local` | 否 |
| `backend/src/main/resources/application-local.properties` | 本地 H2 数据源、H2 控制台、演示账号 | 否 |
| `backend/src/main/resources/application-prod.properties` | 原 MySQL 8 数据源与线上配置 | 上线时使用 |
| `backend/src/main/resources/db/schema-h2.sql` | 本地 H2 建表脚本 | 否 |
| `backend/src/main/resources/schema.sql` | 线上 MySQL 建表脚本 | 上线时沿用 |
| `SQL/01-create-database.sql` | 手工创建 MySQL 数据库 | 上线时使用 |
| `SQL/02-schema.sql` | 手工创建 MySQL 表 | 上线时使用 |
| `SQL/03-default-user.sql` | 手工写入 MySQL 默认用户 | 上线时按需使用 |
| `frontend/src/editor/services/diagramApi.js` | 前端 API 地址入口 | 否 |
| `frontend/.env.example` | 前端环境变量示例 | 否 |

### 上线切回 MySQL

1. 启动 MySQL 8，并按原项目方式初始化数据库：

   ```powershell
   mysql -uroot -proot < SQL/01-create-database.sql
   mysql -uroot -proot < SQL/02-schema.sql
   ```

   `SQL/02-schema.sql` 已包含最新的 `diagram.sequence_no` 列和 `(user_id, sequence_no)` 索引。

   **已有 MySQL 数据库升级**：`SchemaMigrationRunner` 会在后端启动时自动补 `sequence_no` 列、回填历史文档序号并创建索引。
   因此启动账号至少需要 `ALTER`、`UPDATE`、`CREATE INDEX` 权限。`DIAGRAM_SQL_INIT_MODE=never` 只关闭 schema 脚本执行，
   不会跳过这段增量迁移；若线上禁止应用账号执行 DDL，请先由 DBA 执行等价迁移，再以普通读写账号启动。

2. 准备线上数据库连接。可以修改 `application-prod.properties`，更推荐用环境变量：

   ```powershell
   $env:SPRING_PROFILES_ACTIVE = "prod"
   $env:DIAGRAM_DB_URL = "jdbc:mysql://127.0.0.1:3306/diagram_editor?createDatabaseIfNotExist=true&useUnicode=true&characterEncoding=utf8&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Shanghai"
   $env:DIAGRAM_DB_USERNAME = "diagram_user"
   $env:DIAGRAM_DB_PASSWORD = "请替换为真实密码"
   $env:APP_AUTH_TOKEN_SECRET = "请替换为足够长的随机字符串"
   ```

3. 首次启动时，如线上还没有账号，可临时用环境变量创建第一个账号：

   ```powershell
   $env:APP_DEFAULT_USER_ENABLED = "true"
   $env:APP_DEFAULT_USER_USERNAME = "你的用户名"
   $env:APP_DEFAULT_USER_USER_ID = "user-001"
   $env:APP_DEFAULT_USER_DISPLAY_NAME = "你的显示名"
   $env:APP_DEFAULT_USER_PASSWORD = "你的登录密码"
   $env:APP_DEFAULT_USER_RECOVERY_CODE = "你的恢复口令"

   cd backend
   mvn spring-boot:run
   ```

   账号创建成功后，**移除 `APP_DEFAULT_USER_ENABLED`（或设为 `false`）并重启**，避免线上保留演示/初始化逻辑。已有用户不会被重置。

4. 打包并运行：

   ```powershell
   cd backend
   mvn clean package -DskipTests
   java -jar target\diagram-backend-0.0.1-SNAPSHOT.jar --spring.profiles.active=prod
   ```

5. 前端生产构建时指定线上 API 地址：

   ```powershell
   cd frontend
   $env:VITE_API_BASE_URL = "https://api.example.com"
   npm run build
   ```

   构建产物在 `frontend/dist/`。如果线上由 Nginx 同域反向代理 `/api`，也可以把 `VITE_API_BASE_URL` 设为空字符串。

### 回到本地 H2

```powershell
$env:SPRING_PROFILES_ACTIVE = "local"
cd backend
mvn spring-boot:run
```

不设置 `SPRING_PROFILES_ACTIVE` 时也默认使用 `local`。

如需清空本地数据：先停止后端，删除 `backend/data/` 目录，再重新启动。

## 当前能力

- 登录：用户名 + 密码登录，前端使用 RSA-OAEP 公钥加密，不传输明文密码
- 账户安全：支持忘记密码和登录后修改密码
- 文档模式：绘图、思维导图、Markdown、思维笔记
- 编辑能力：节点编辑、连线、折叠、图层控制、文本块联动、撤销/重做
- 持久化：本地保存到 H2 文件；线上保存到 MySQL，按当前登录用户隔离
- 导出：全部模式支持 PNG/JPG，思维导图与思维笔记支持 XMind

## 测试与验证

前端单元测试：

```powershell
cd frontend
npm test
```

前端构建：

```powershell
cd frontend
npm run build
```

后端测试与打包：

```powershell
cd backend
mvn test
mvn package
```

本地接口冒烟测试（需先启动后端）：

```powershell
cd backend
node scripts\smoke-test-local.mjs
```

## 接口说明

- `GET /api/auth/public-key`：获取前端加密登录使用的 RSA 公钥
- `POST /api/auth/login`：传入 `username` 和 `encryptedPassword`，返回 `userId`、`displayName`、`token`
- `POST /api/auth/forgot-password`：传入 `username`、`encryptedRecoveryCode`、`encryptedNewPassword`
- `POST /api/auth/change-password`：请求头携带 `Authorization: Bearer <token>`，请求体传入加密后的旧密码和新密码
- `POST /api/diagrams`：创建文档，请求头需要 `Authorization: Bearer <token>`
- `GET /api/diagrams`：列出当前用户的文档
- `GET /api/diagrams/{id}`：按当前登录用户隔离加载文档
- `PUT /api/diagrams/{id}`：按当前登录用户隔离更新文档
- `DELETE /api/diagrams/{id}`：删除当前用户的文档
- `GET /api/diagrams/ping`：联调健康检查，返回 `pong`
