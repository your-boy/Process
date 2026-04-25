# Process

这是一个前后端分离的单仓项目：前端位于 `frontend/`，基于 Vue 3 + Vite；后端位于 `backend/`，基于 Spring Boot + MySQL。当前实现覆盖单用户登录、忘记密码、修改密码、流程图、思维导图、Markdown、思维笔记，以及 PNG/JPG/XMind 导出闭环。


ENGLIST：

This is a decoupled, full-stack monorepo project named "Process." The frontend, located in the `frontend/` directory, is built using Vue 3 and Vite; the backend, located in `backend/`, is powered by Spring Boot and MySQL. The current implementation covers single-user login, password recovery, password modification, flowcharts, mind maps, Markdown editing, and thought notes—including a complete export workflow supporting PNG, JPG, and XMind formats. It is now completely free and open-source.

## 环境要求

- Node.js 16+
- JDK 8
- Maven 3.8+
- MySQL 8.x

## 默认账户

- 用户名：
- 登录密码：
- 默认恢复口令：

当前版本不提供注册功能，只保留登录、忘记密码和登录后修改密码。

## MySQL 初始化

后端默认连接本机 MySQL：数据库 `diagram_editor`，用户名 ，密码 。

先确保本机已经启动 MySQL，再在仓库根目录执行以下导入命令：

```bash
mysql -uroot -proot < SQL/01-create-database.sql
mysql -uroot -proot < SQL/02-schema.sql
mysql -uroot -proot < SQL/03-default-user.sql
```

三份 SQL 的职责如下：

- `SQL/01-create-database.sql`：创建 `diagram_editor` 数据库
- `SQL/02-schema.sql`：创建 `app_user` 和 `diagram` 表
- `SQL/03-default-user.sql`：写入默认用户  及其密码哈希、恢复口令哈希

如果你不手动导入，后端启动时也会根据 `backend/src/main/resources/schema.sql` 自动建表，并通过启动引导代码补齐默认用户；但为了便于留档、备份和手工恢复，仍建议保留并使用 `SQL/` 目录下的脚本。

## 本地运行

先初始化 MySQL，再分别启动前后端。

前端：

```bash
cd frontend
npm install
npm run dev
```

后端：

```bash
cd backend
mvn spring-boot:run
```

默认端口：前端 `5173`，后端 `8080`。

## 当前能力

- 登录：用户名 + 密码登录，前端使用 RSA-OAEP 公钥加密，不传输明文密码
- 账户安全：支持忘记密码和登录后修改密码
- 文档模式：流程图、思维导图、Markdown、思维笔记
- 编辑能力：节点编辑、连线、折叠、图层控制、文本块联动、撤销/重做
- 持久化：文档保存到本地 MySQL，按当前登录用户隔离；离线时保留本地草稿
- 导出：全部模式支持 PNG/JPG，思维导图与思维笔记支持 XMind

## 测试与验证

前端单元测试：

```bash
cd frontend
npm test
```

前端端到端测试：

```bash
cd frontend
npx playwright test
```

前端构建：

```bash
cd frontend
npm run build
```

后端测试：

```bash
cd backend
mvn test
```

## 接口说明

- `GET /api/auth/public-key`：获取前端加密登录使用的 RSA 公钥
- `POST /api/auth/login`：传入 `username` 和 `encryptedPassword`，返回 `userId`、`displayName`、`token`
- `POST /api/auth/forgot-password`：传入 `username`、`encryptedRecoveryCode`、`encryptedNewPassword`
- `POST /api/auth/change-password`：请求头携带 `Authorization: Bearer <token>`，请求体传入加密后的旧密码和新密码
- `POST /api/diagrams`：创建文档，请求头需要 `Authorization: Bearer <token>`
- `GET /api/diagrams/{id}`：按当前登录用户隔离加载文档
- `PUT /api/diagrams/{id}`：按当前登录用户隔离更新文档
- `GET /api/diagrams/ping`：联调健康检查，返回 `pong`
