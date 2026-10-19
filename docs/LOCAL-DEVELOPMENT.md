# 本地开发与上线切换说明

本文档记录本次“MySQL -> H2”本地化改造涉及的文件、启动方式和上线回滚步骤。

## 1. 改造原则

- 不删除原 MySQL 配置和 SQL 脚本。
- 本地默认使用文件型 H2，启动后即可登录、保存文档。
- 线上通过 Spring Profile `prod` 切回 MySQL。
- 本地演示账号只存在于 `local` profile。
- 数据库文件、日志和构建产物都不提交到 Git。

## 2. 配置加载关系

```text
application.properties
  ├─ 默认 spring.profiles.active=local
  ├─ 公共 JPA/端口/Token 配置
  └─ 可选账号初始化开关
        │
        ├─ application-local.properties
        │    ├─ H2 文件数据库
        │    ├─ db/schema-h2.sql
        │    ├─ H2 Console
        │    └─ demo 账号
        │
        └─ application-prod.properties
             ├─ MySQL 8
             ├─ schema.sql
             └─ 可选 APP_DEFAULT_USER_* 首次建号
```

## 3. 本地文件说明

| 文件 | 说明 |
| --- | --- |
| `backend/src/main/resources/application.properties` | 默认激活 `local`，放公共配置 |
| `backend/src/main/resources/application-local.properties` | H2 数据源、建表脚本、H2 控制台、本地账号 |
| `backend/src/main/resources/application-prod.properties` | MySQL 数据源、线上账号策略 |
| `backend/src/main/resources/db/schema-h2.sql` | H2 建表脚本 |
| `backend/src/main/resources/schema.sql` | MySQL 建表脚本，`prod` 使用 |
| `backend/scripts/smoke-test-local.mjs` | 本地 API 冒烟测试 |
| `frontend/.env.example` | 前端 API 地址示例 |
| `frontend/src/editor/services/diagramApi.js` | 读取 `VITE_API_BASE_URL`，默认 `http://localhost:8080` |
| `backend/data/diagram_editor.mv.db` | 运行时生成的本地数据库，已 gitignore |

`SchemaMigrationRunner` 会在启动时补齐增量列。当前会确保 `diagram.sequence_no` 存在，为历史文档按用户
`created_at/id` 顺序回填递增序号，并创建 `(user_id, sequence_no)` 索引；新文档序号由后端创建时写入。

## 4. 本地启动

后端：

```powershell
cd backend
mvn spring-boot:run
```

前端：

```powershell
cd frontend
npm install
npm run dev
```

访问：

- 前端：<http://localhost:5173>
- 后端健康检查：<http://localhost:8080/api/diagrams/ping>
- H2 控制台：<http://localhost:8080/h2-console>

本地账号：

```text
用户名：demo
密码：demo123
恢复口令：RECOVER-2026
```

## 5. 验证本地数据库

启动后端后运行：

```powershell
cd backend
node scripts\smoke-test-local.mjs
```

脚本会真实调用 RSA 公钥接口、登录接口，然后完成文档创建、列表、读取、更新和删除。全部通过时输出：

```text
OK: login, create, list, get and update all passed (http://localhost:8080)
```

## 6. 清空/备份本地数据

清空（先停止后端）：

```powershell
Remove-Item -Recurse -Force backend\data
```

备份（先停止后端）：

```powershell
Copy-Item -Recurse backend\data backend\data-backup-20261017
```

## 7. 上线切回 MySQL

### 7.1 初始化 MySQL

```powershell
mysql -uroot -proot < SQL/01-create-database.sql
mysql -uroot -proot < SQL/02-schema.sql
```

`application-prod.properties` 默认会执行 `backend/src/main/resources/schema.sql` 自动建表；如果线上禁止自动执行 SQL，可设置：

```powershell
$env:DIAGRAM_SQL_INIT_MODE = "never"
```

### 7.2 配置环境变量

```powershell
$env:SPRING_PROFILES_ACTIVE = "prod"
$env:DIAGRAM_DB_URL = "jdbc:mysql://127.0.0.1:3306/diagram_editor?createDatabaseIfNotExist=true&useUnicode=true&characterEncoding=utf8&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Shanghai"
$env:DIAGRAM_DB_USERNAME = "diagram_user"
$env:DIAGRAM_DB_PASSWORD = "替换为真实密码"
$env:APP_AUTH_TOKEN_SECRET = "替换为足够长的随机字符串"
```

### 7.3 首次创建线上账号

生产环境默认不会创建 demo 账号或任何账号。若线上数据库还没有用户，第一次启动时临时提供：

```powershell
$env:APP_DEFAULT_USER_ENABLED = "true"
$env:APP_DEFAULT_USER_USERNAME = "your-name"
$env:APP_DEFAULT_USER_USER_ID = "user-001"
$env:APP_DEFAULT_USER_DISPLAY_NAME = "Your Name"
$env:APP_DEFAULT_USER_PASSWORD = "replace-with-real-password"
$env:APP_DEFAULT_USER_RECOVERY_CODE = "replace-with-real-recovery-code"
```

启动后确认账号可登录，再移除这组 `APP_DEFAULT_USER_*` 变量并重启。

> 也可以在 MySQL 中直接使用 `SQL/03-default-user.sql` 写入账号，但该脚本中的哈希必须由项目相同的 PBKDF2 规则生成。没有现成哈希时，优先使用上面的临时建号方式。

### 7.4 打包运行

```powershell
cd backend
mvn clean package -DskipTests
java -jar target\diagram-backend-0.0.1-SNAPSHOT.jar --spring.profiles.active=prod
```

### 7.5 前端生产构建

```powershell
cd frontend
$env:VITE_API_BASE_URL = "https://api.example.com"
npm run build
```

产物目录：`frontend/dist/`。

## 8. 回滚到本地 H2

```powershell
Remove-Item Env:SPRING_PROFILES_ACTIVE -ErrorAction SilentlyContinue
cd backend
mvn spring-boot:run
```

`application.properties` 中默认值就是 `local`，不设置环境变量也会使用 H2。

## 9. 常见问题

### 端口被占用

```powershell
$env:SERVER_PORT = "8081"
```

或停止占用 `8080`/`5173` 的进程。

### 登录返回 401

- 确认使用 `demo / demo123`（本地）。
- 确认后端启动日志中包含 `The following 1 profile is active: "local"`。
- 确认没有设置 `SPRING_PROFILES_ACTIVE=prod`。

### H2 数据在哪里

默认在 `backend/data/diagram_editor.mv.db`。如果从仓库根目录启动后端，则路径会随工作目录变化。需要固定位置时可覆盖：

```powershell
$env:DIAGRAM_DB_URL = "jdbc:h2:file:D:/documents/personal/Process/backend/data/diagram_editor;MODE=MySQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;DB_CLOSE_ON_EXIT=FALSE"
```

### 切换数据库后旧 Token 失效

密码哈希或 Token Secret 变化后，旧 Token 会失效，重新登录即可。
