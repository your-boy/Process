# Process 项目真实鼠标 / 键盘输入覆盖报告

> 执行日期：2026-10-18
> 环境：Windows / Chromium（Playwright 1.54）/ Vue 3 + Vite 4 / Spring Boot 3.5 + H2
> 后端：`http://127.0.0.1:8080`（local profile，H2 文件库）
> 前端：Vite dev server（`5173` / 验证配置 `4174`）

## 1. 测试方式

本次测试分两层执行：

1. **可重复回归层（主）**：Playwright 通过 CDP `Input.dispatchMouseEvent` / `Input.dispatchKeyEvent`
   发送浏览器真实事件管线的鼠标、滚轮、拖拽和键盘事件；不使用 `el.click()`、`dispatchEvent`
   或直接调用业务状态函数来替代操作。
2. **桌面验收层**：使用 CUA（computer-use）驱动真实 Chrome 进程，验证了浏览器启动、
   `Ctrl+L` 地址栏、剪贴板粘贴、回车导航等 OS 级输入链路。

所有断言直接读取应用文档状态（节点、连线、文本块、图层、页面、视口、保存状态）或 DOM 状态，
不依赖截图比对。

## 2. 新增测试文件

| 文件 | 覆盖模块 | 用例数 |
| --- | --- | --- |
| `frontend/tests/e2e/input-auth-workspace.spec.js` | 登录、忘记密码、修改密码、主题/语言、新建弹窗、文件卡片、卡片右键菜单、多页缩略图切换、文本块缩略图、空白文档统一状态、数据库序号、批量框选/单项取消、卡片/列表视图、类型筛选、列表列排序、服务端分页、轻量 localStorage + IndexedDB 持久化、工作区搜索 | 18 |
| `frontend/tests/e2e/input-flowchart.spec.js` | 流程图画布：拖入、拖动、框选、缩放、连线、点击连线、右键菜单、快捷键、参考线、图层、长文本浮层、连线属性 | 9 |
| `frontend/tests/e2e/input-mindmap.spec.js` | 思维导图：主题编辑、键盘层级操作、折叠、大纲拖拽、属性、边界/概要/关系、演示、文本块、快捷样式归位、搜索重置 | 6 |
| `frontend/tests/e2e/input-markdown-note.spec.js` | Markdown 编辑器、源码、工具栏、代码块属性/高亮/焦点同步/拖动重排/缩放、导出、思维笔记富文本/双栏/页面、块体拖动、属性抽屉排版 | 9 |
| `frontend/tests/e2e/input-shell-import-export.spec.js` | 标题/模式/保存/历史/快捷键、属性面板、画布右键、导入导出、1280×720 自适应、窗口缩放 | 6 |
| `frontend/tests/e2e/support/input-helpers.js` | 真实输入工具函数与状态读取 | — |

当前真实输入 E2E 合计 **60** 个用例。

## 3. 输入覆盖矩阵

### 3.1 认证与会话

| 操作 | 输入方式 | 结果 |
| --- | --- | --- |
| 空用户名 / 空密码校验 | 鼠标点提交、键盘 Enter | 通过 |
| 用户名 → 密码 Tab 焦点切换 | 键盘 Tab | 通过 |
| 密码显隐 | 鼠标点击眼睛按钮 | 通过 |
| 错误密码提示 | 键盘输入 + Enter | 通过 |
| 退出后重新登录 | 鼠标 + 键盘 | 通过 |
| 忘记密码模式、三个显隐按钮、长度/一致性校验、返回登录 | 鼠标 + 键盘 | 通过 |
| 修改密码面板三次显隐、空值/长度/一致性校验、收起清空 | 鼠标 + 键盘 | 通过 |
| 修改密码三个字段：左侧标签与右侧输入框同一水平线、间距一致 | 视觉断言 | 通过（修复后） |
| 主题切换、中文/英文切换 | 鼠标点击 | 通过 |

### 3.2 工作区与新建弹窗

| 操作 | 输入方式 | 结果 |
| --- | --- | --- |
| 新建弹窗标题栏拖动 | 鼠标按下-移动-松开 | 通过 |
| 遮罩点击关闭 | 鼠标 | 通过 |
| 模式卡片点击创建 | 鼠标 | 通过 |
| 文件卡片“更多操作 → 打开/重命名/删除” | 鼠标 + 键盘输入 + Enter | 通过 |
| 文件卡片右键菜单：打开/重命名/删除、指针位置定位、Esc/外部点击关闭 | 鼠标 + 键盘 | 通过 |
| 多页文档缩略图：页码切换、当前页高亮、不误打开文档 | 鼠标 | 通过 |
| 思维导图文本块进入工作区缩略图，并在卡片中显示文本内容 | 鼠标 + 键盘 | 通过（修复后） |
| 空白文档：画布与卡片预览不显示提示框/文字/分类，列表摘要使用 `—` | 视觉断言 | 通过（修复后） |
| `Ctrl/⌘ + 左键拖动`框选多张卡片、已选数量、批量删除、取消选择 | 鼠标 + 键盘 | 通过 |
| 选中卡片左上角打勾、点击打勾或已选卡片单独取消、常驻批量删除按钮、卡片/列表视图切换 | 鼠标 | 通过 |
| 卡片/列表自适应分页：按窗口高度计算每页数量、上一页/下一页、页码直达、无页面纵向溢出 | 鼠标 + 窗口缩放 | 通过 |
| 手动每页数量：10 / 20 / 40 / 60 / 100，选择器直接显示视口计算出的具体页数 | 鼠标 + 窗口缩放 | 通过（修复后） |
| 手动分页切换视图保留、刷新后持久化、内容超出时内部滚动 | 鼠标 + 页面刷新 | 通过（新增） |
| 服务端分页/筛选/排序：只请求当前页；列表投影不读取正文 LOB | 网络请求 + 数据库断言 | 通过（新增） |
| 工作区 localStorage 只保存轻量元数据，完整缓存写入 IndexedDB | 页面存储检查 | 通过（新增） |
| 卡片和列表显示数据库持久化序号；列表支持序号排序；保存后序号写入数据库 | 鼠标 + 键盘 + 数据库读取 | 通过（新增） |
| 中文搜索框占位符“搜索文档标题 / 内容”及“查询 / 重置”按钮无 i18n key 泄漏 | 鼠标 + 键盘 | 通过 |
| 按文档类型筛选：全部 / 绘图 / 思维导图 / Markdown / 思维笔记，卡片和列表同步 | 鼠标 + 键盘 | 通过 |
| 列表表头排序：标题、类型、摘要、页数，点击升序、再次点击降序，显示方向箭头 | 鼠标 | 通过 |
| 工作区搜索框 + 查询 + 重置；按标题/摘要/正文检索并显示无结果状态 | 鼠标 + 键盘 | 通过 |
| 重命名 Esc 取消 | 键盘 | 通过（修复后） |
| 重命名弹窗：“文件名”标签与输入框左右并排、中心线对齐 | 视觉断言 | 通过（修复后） |
| 文件卡片删除 | 鼠标 | 通过 |

### 3.3 流程图画布

| 操作 | 输入方式 | 结果 |
| --- | --- | --- |
| 空画布显示纯文字虚线提示框，无 SVG / 图片图标，不会与画布元素混淆 | 视觉断言 | 通过（修复后） |
| 图形库搜索框过滤 | 键盘输入 / 清空 | 通过 |
| 从图形库拖入画布 | 鼠标按下-移动-松开 | 通过 |
| 节点单击 / Shift 多选 | 鼠标 | 通过 |
| 空白处拖拽框选 | 鼠标 | 通过 |
| 单节点 / 多节点拖动 | 鼠标 | 通过 |
| 四方向缩放手柄 | 鼠标 | 通过 |
| 连接点拖线建边 | 鼠标 | 通过（修复后） |
| 单击连接点后再点目标节点建边，Esc/空白取消 | 鼠标 + 键盘 | 通过 |
| 连线选择、双击改标签 | 鼠标 + 键盘 | 通过 |
| 连线属性面板：标签、起终点、预设、路线、线型、箭头、颜色、删除 | 鼠标 + 键盘 | 通过 |
| 连线折点手柄拖动 | 鼠标 | 通过 |
| 连线路由/线型/箭头/颜色工具栏 | 鼠标 | 通过 |
| 节点右键复制/粘贴/副本/剪切/锁定/置顶/置底/删除 | 鼠标 + 键盘 | 通过 |
| 画布右键新建/全选/粘贴/适应/网格/清除参考线 | 鼠标 | 通过 |
| N / Shift+D / Delete / Ctrl+Z / Ctrl+Y / Ctrl+A / Ctrl+C / Ctrl+V / Ctrl+X / Ctrl+D / Ctrl+G / Ctrl+Shift+G | 键盘 | 通过（多选删除修复后） |
| 方向键平移、+/- 缩放 | 键盘 | 通过 |
| F2 / Enter 打开文字浮层，Enter 提交，Esc 取消 | 键盘 | 通过 |
| 长文本浮层自动换行、无横向/纵向截断 | 键盘 + 鼠标 | 通过 |
| 编辑浮层内按住拖动节点（自动提交文字后移动） | 鼠标 | 通过 |
| `?` 快捷键面板打开/关闭 | 键盘 + 鼠标 | 通过 |
| 滚轮平移、Ctrl+滚轮缩放、Space+左键 / 中键拖动 | 鼠标 + 键盘 | 通过 |
| 网格开关、画布尺寸输入、A4 预设 | 鼠标 + 键盘 | 通过 |
| 从标尺拖出参考线、移动、双击删除 | 鼠标 | 通过 |
| 图层显隐 / 锁定 / 上下移动 | 鼠标 | 通过 |

### 3.4 思维导图

| 操作 | 输入方式 | 结果 |
| --- | --- | --- |
| 双击主题进入编辑 | 鼠标 + 键盘 | 通过 |
| Tab 子主题、Enter 同级、Shift+Tab 提升、Ctrl+Enter 插入父主题 | 键盘 | 通过 |
| 删除分支、根主题删除保护 | 键盘 | 通过 |
| 节点拖动 | 鼠标 | 通过 |
| 拖动叶子主题只移动自身，父/兄弟主题和连线另一端不跟着位移 | 鼠标 | 通过 |
| 长文本浮层自动换行、编辑时直接拖动节点 | 键盘 + 鼠标 | 通过 |
| 连点两次折叠/展开 | 鼠标 | 通过 |
| 大纲拖拽调整层级 | HTML5 drag（真实鼠标） | 通过 |
| 大纲上移/下移/缩进/取消缩进 | 鼠标 | 通过 |
| 浮动主题、布局、主题、分支样式、彩虹、编号 | 鼠标 | 通过 |
| 全部折叠 / 展开 | 鼠标 | 通过 |
| 单节点锁定/快捷配色只在右侧属性抽屉，不新增顶部整行 | 鼠标 | 通过 |
| 搜索栏靠左；按标签文本/“标签”筛选命中；重置恢复搜索、筛选和全部节点 | 鼠标 + 键盘 | 通过 |
| 形状、粗体、斜体、字号、文字颜色 | 鼠标 + 键盘 | 通过 |
| 标记添加/移除、优先级、进度 | 鼠标 | 通过 |
| 备注、标签、任务日期、负责人 | 键盘 | 通过 |
| 任务日期字段：“开始 / 截止”标签与日期输入框左右并排、中心线对齐 | 视觉断言 | 通过（修复后） |
| 附件添加/移除、链接/提示/图片 | 键盘 + 鼠标 | 通过 |
| 边界添加/移除、关系线添加/删除、概要添加/编辑/删除 | 鼠标 + 键盘 | 通过 |
| 聚焦、演示进入/键盘翻页/按钮翻页/Esc 退出 | 鼠标 + 键盘 | 通过 |
| Ctrl+F 聚焦搜索、输入过滤 | 键盘 | 通过 |
| M 新建文本块、拖动、缩放、删除 | 键盘 + 鼠标 | 通过 |

### 3.5 Markdown 与思维笔记

| 操作 | 输入方式 | 结果 |
| --- | --- | --- |
| TipTap 正文键盘输入 | 键盘 | 通过 |
| 粗体/斜体/下划线/删除线/行内代码 | 键盘快捷键 + 工具栏鼠标 | 通过 |
| 标题 1/2/3、无序/有序/任务列表、引用、代码块 | 鼠标 | 通过 |
| 代码块属性：语言、背景色、文字色、边框色/宽度、圆角、内边距、自动换行、恢复默认 | 鼠标 + 键盘 | 通过（新增） |
| 代码块按语言语法高亮；纯文本无语法色；单个背景层，无重复底色 | 视觉 + DOM 断言 | 通过（修复后） |
| 点击正文关闭属性浮层；切换两个代码块后属性读取当前光标所在块的独立值 | 鼠标 + DOM 断言 | 通过（新增） |
| 代码块 Ctrl+左键整体拖动重排；拖动中显示插入线/圆点/目标高亮/grabbing；普通左键拖手柄调整宽高 | 鼠标拖动 | 通过（修复后） |
| 代码块属性写入 fenced-code info 字符串，源码切换后仍保留 | 键盘 + 鼠标 | 通过（新增） |
| 表格插入前选择行数/列数；表内减行/加行、减列/加列、删表格；拖拽内部列边界和最右外边框调整宽度；行高、对齐、面板/工具栏上下移动 | 鼠标 + 键盘 | 通过 |
| 分隔线、链接输入框 Enter 应用 | 鼠标 + 键盘 | 通过 |
| Markdown 源码与预览双向同步 | 键盘 | 通过 |
| 源码框原生 Ctrl+Z / Ctrl+Y | 键盘 | 通过 |
| Ctrl+S 保存 | 键盘 | 通过 |
| 导出菜单打开并下载 PNG | 鼠标 | 通过 |
| 打印预览：`打印` / `PDF` 两个并排按钮；PDF 直接下载文件 | 鼠标 | 通过 |
| 画布右键：顶层“打印”与导出子菜单“PDF”独立入口 | 鼠标 | 通过 |
| PDF 文件校验：扩展名 `.pdf` 且文件头为 `%PDF-` | 鼠标 + 文件读取 | 通过 |
| 思维笔记富文本 Ctrl+B / Ctrl+I / Ctrl+U、工具栏切换 | 键盘 + 鼠标 | 通过 |
| 双栏视图、加块、缩进、取消缩进、删除 | 鼠标 | 通过 |
| 文本块拖动 / 缩放 | 鼠标 | 通过 |
| 未编辑文本块直接按住块体拖动 | 鼠标 | 通过 |
| 文本块属性抽屉：短按钮不换行、无横向溢出 | 鼠标 | 通过 |
| 文本块顶栏无“拖动文本块”提示，新建笔记默认空内容 | 鼠标 + 键盘 | 通过 |
| Ctrl+F 搜索、Ctrl+滚轮缩放、Ctrl+S 保存 | 键盘 + 鼠标 | 通过 |
| 页面标签点击 / 键盘 Enter 切换 / 双击重命名 / 删除 | 鼠标 + 键盘 | 通过 |

### 3.6 编辑器外壳与导入导出

| 操作 | 输入方式 | 结果 |
| --- | --- | --- |
| 标题输入框键盘编辑 | 键盘 | 通过 |
| 模式下拉切换 | 键盘/原生 select | 通过 |
| 保存按钮、历史面板、快捷键面板 | 鼠标 | 通过 |
| 属性面板 X/Y/宽/高/旋转/文本/链接/提示/图片 | 键盘 | 通过 |
| 节点自定义宽高后一键恢复该图形默认大小；右键菜单同入口 | 鼠标 + 键盘 | 通过 |
| 节点锁定/解锁、颜色预设、多选对齐/分布/概要 | 鼠标 + 键盘 | 通过 |
| 1280×720 下四模块画布自适应、无整页/横向溢出 | 浏览器视口 | 通过 |
| 窗口从 1280×720 放大到 1920×1080：画布同步扩展、内容等比缩放且完整可见 | 浏览器视口 | 通过 |
| drawio 导出 → 导入 | 鼠标菜单 + 文件输入 | 通过 |
| XMind 导出 → 导入 | 鼠标菜单 + 文件输入 | 通过 |
| Markdown 大纲导出 → 导入 | 鼠标菜单 + 文件输入 | 通过 |

## 4. 发现并修复的缺陷

1. **流程图连接点被缩放手柄遮挡，无法拖线**
   - 位置：`frontend/src/components/Editor.vue`
   - 原因：连接点圆心与同方向的缩放手柄圆心完全重合，缩放手柄 SVG 后渲染且 `pointer-events: all`，命中测试总是先命中手柄。
   - 修复：连接点圆点向节点外侧偏移 11 个用户单位，并增大半径到 6.5；逻辑锚点仍保持在节点边界。
   - 回归：`input-flowchart.spec.js › 连接点拖线、连线选择/标签/路由/折点/删除`。

2. **流程图多选后 Delete/Backspace 只删除当前节点**
   - 位置：`frontend/src/components/Editor.vue`
   - 原因：键盘 Delete 走 `editorState.removeSelection()`，该函数只认识 `activeNodeId`；编辑器本地的多选集 `selectedNodeIds` 未被使用。
   - 修复：非树模式下，Delete/Backspace 优先按 `selectedNodeIds` 调用 `removeNodes()`。
   - 回归：`input-flowchart.spec.js › 键盘：N/Shift+D/删除/撤销重做/全选/...`。

3. **新建弹窗、重命名弹窗不支持 Esc 关闭**
   - 位置：`frontend/src/App.vue`
   - 修复：新增全局 `keydown` 监听，Esc 优先关闭新建弹窗，其次取消重命名；卸载时移除监听。
   - 回归：`input-auth-workspace.spec.js › 文件卡片：菜单重命名键盘提交/Esc、更多操作、删除`。

4. **选中连线后属性抽屉空白，标题显示原始 i18n 键**
   - 位置：`frontend/src/components/Editor.vue`、`frontend/src/i18n/index.js`
   - 原因：连线只有顶部样式工具条，属性抽屉没有对应的 `selectedEdge` 内容；`editor.edgeLabel` 键缺失。
   - 修复：补齐连线属性面板（标签、起终点、预设、路线、线型、箭头、颜色、编辑标签、删除连线），
     将连线样式从顶部工具条移入抽屉，并补齐中英文文案。
   - 回归：`input-flowchart.spec.js › 连线属性：点击连线显示标签、起终点、样式，并可直接修改和删除`。

5. **拖动叶子主题时父主题和连线另一端跟着移动**
   - 位置：`frontend/src/editor/render/mindmapLayout.js`
   - 原因：子主题拖动后的 `offsetY/offsetX` 参与了父主题居中计算，父主题重新定位时看起来像“相连节点被一起拖动”。
   - 修复：父主题按子主题未偏移的自动布局位置居中，手动 offset 只作用于被拖动的主题自身。
   - 回归：`input-mindmap.spec.js › 鼠标：节点拖动、双击/连点折叠、浮动主题、布局主题、全部折叠/展开`。

6. **工作区文件卡片右键没有省略号菜单功能**
   - 位置：`frontend/src/App.vue`
   - 修复：卡片支持右键上下文菜单，提供打开/重命名/删除；菜单按指针位置弹出并自动限制在视口内，
     支持 Esc、点击外部和滚动关闭；省略号菜单同步补上“打开”。
   - 回归：`input-auth-workspace.spec.js › 文件卡片右键：出现与省略号一致的打开/重命名/删除菜单`。

7. **多页文档卡片只显示当前页，无法切换缩略图**
   - 位置：`frontend/src/App.vue`
   - 原因：工作区卡片预览只读取当前活动页，未构建 `content.pages` 的多页缩略图。
   - 修复：为每一页分别生成缩略图预览，卡片底部提供 `‹ 1 2 ›` 页码切换，当前页高亮；
     切换按钮独立于打开卡片的主按钮，不会误打开文档。
   - 回归：`input-auth-workspace.spec.js › 多页文档卡片：缩略图可切换页面且不会误打开文档`。

8. **流程图连接点只能拖拽连线，不能点击后连接**
   - 位置：`frontend/src/components/Editor.vue`
   - 原因：连接点的 `pointerup` 没有目标节点时立即清空 `connectState`，因此单击无法保留待连接状态。
   - 修复：连接点单击后保留待连接状态并显示预览线，再点目标节点完成连线；
     拖拽超过 4px 仍按原拖拽逻辑；Esc、空白处或再次点源节点取消。
   - 回归：`input-flowchart.spec.js › 点击连接点后再点目标节点即可连线，Esc/空白可取消`。

9. **节点缩放后没有恢复默认大小的入口**
   - 位置：`frontend/src/components/Editor.vue`
   - 修复：属性抽屉和节点右键菜单增加“重置大小”，按 `getFlowchartNodeSize(kind)` 恢复该图形类型默认宽高，
     保留位置、旋转和样式。
   - 回归：`input-shell-import-export.spec.js › 流程图属性面板：X/Y/宽/高/旋转/文本/...`。

10. **思维导图搜索栏在右侧，且没有重置入口**
   - 位置：`frontend/src/components/Editor.vue`
   - 修复：搜索组改为左对齐；新增常驻“重置”按钮，清空关键词、筛选并重新显示全部节点；
     补充标签文本和“标签”筛选的回归覆盖。
   - 回归：`input-mindmap.spec.js › 搜索栏靠左：可按标签命中，重置按钮恢复全部节点`。

11. **思维笔记属性抽屉中文按钮逐字换行、横向溢出**
   - 位置：`frontend/src/components/Editor.vue`、`frontend/src/i18n/index.js`
   - 原因：三个等宽列里放入了“缩进（设为上一个块的子块）”这类长文案，按钮被迫逐字换行。
   - 修复：抽屉按钮改用“缩进 / 取消缩进 / 删除”短标签，完整说明移到 `title`；
     统一禁止按钮内换行，设置 `min-width: 0`、文本省略和 `inspector-body` 横向隐藏。
   - 回归：`input-markdown-note.spec.js › 文本块属性抽屉：短标签不换行，抽屉无横向溢出`。

12. **界面存在多处冗余教程/提示文案**
   - 位置：`frontend/src/components/Editor.vue`、`frontend/src/editor/modes/mindNote.js`、`frontend/src/App.vue`
   - 修复：移除文本块顶栏“拖动文本块”；新建思维笔记改为空文本块；
     画布空状态去掉操作教程；关系线提示 toast 移除；图形悬停描述 span 移除；
     新建弹窗标题栏拖动提示移除；笔记/历史/演示空状态改为单行状态词。
   - 回归：`input-markdown-note.spec.js › 文本块属性抽屉：短标签不换行，抽屉无横向溢出`。

13. **工作区不支持批量选择与批量删除**
   - 位置：`frontend/src/App.vue`
   - 修复：支持 `Ctrl/⌘ + 左键拖动`框选多张卡片，也支持 `Ctrl/⌘ + 单击`加选；
     顶部显示已选数量、“删除所选”“取消选择”；框选过程中显示选择框，删除只作用于选中文档。
   - 回归：`input-auth-workspace.spec.js › 工作区批量选择：Ctrl+左键框选卡片并批量删除`。

14. **Markdown 表格固定 3×3、尺寸过大且无法调整行列**
   - 位置：`frontend/src/components/Editor.vue`、`frontend/src/editor/render/useMarkdownPanel.js`
   - 原因：插入命令硬编码 `rows: 3, cols: 3`，表格没有自定义样式，沿用浏览器默认宽度和单元格内边距；
     表格操作按钮只支持加行/加列，不能减行/减列。
   - 修复：改为弹出面板选择行列数（默认 2×2）；提供减行/加行、减列/加列、删除表格；
     表格默认紧凑宽度，并统一边框、单元格 padding 和字号；启用表头列边界拖拽，
     显示蓝色列宽手柄和 `col-resize` 光标；内部列边界调整列宽，最右外边框调整整表宽度；
     表格面板还提供行高、左/中/右对齐和上移/下移。
   - 回归：`input-markdown-note.spec.js › 键盘输入、行内格式、标题/列表/引用/代码块/表格/分隔线`。

15. **工作区批量删除入口难发现、选中状态不明确、缺少列表视图**
   - 位置：`frontend/src/App.vue`
   - 修复：顶部常驻“已选 N 项 / 批量删除”，无选择时按钮禁用；选中卡片左上角显示打勾徽标；
     新增卡片 / 列表视图分段开关，列表行展示标题、模式、摘要和页数。
   - 回归：`input-auth-workspace.spec.js › 工作区批量选择：Ctrl+左键框选卡片并批量删除`、
     `input-auth-workspace.spec.js › 工作区卡片/列表视图可切换`。

16. **首页缺少搜索、查询和重置入口**
   - 位置：`frontend/src/App.vue`
   - 修复：在“新建”右侧加入搜索框、查询、重置按钮；查询按标题/摘要/正文/标签检索，
     重置清空关键词并恢复全部文档，无结果时显示独立空状态。
   - 回归：`input-auth-workspace.spec.js › 工作区搜索：查询、重置、无结果状态`。

17. **“PDF”入口实际调用系统打印，没有直接下载文件**
   - 位置：`frontend/src/editor/state/useEditorState.js`、`frontend/src/components/Editor.vue`
   - 原因：PDF 与打印共用 `window.print()` 预览，没有生成 PDF 文件。
   - 修复：引入 `jsPDF`；PDF 导出先将当前画布/预览栅格化为 JPEG，再写入 PDF 并下载 `.pdf`；
     顶部按钮与右键子菜单按需求统一命名为 `PDF`，打印入口单独保留。
   - 回归：`mindnote-verify.spec.js` 的 PDF 导出用例校验 `.pdf` 扩展名和 `%PDF-` 文件头。

18. **工作区选中后无法单独取消、卡片/列表缺少分页、搜索文案显示原始 key**
   - 位置：`frontend/src/App.vue`、`frontend/src/i18n/index.js`
   - 修复：选中卡片左上角打勾改为可点击按钮，点击即取消单个文档；已选状态下再次点击卡片也会切换该项，
     不必先“取消选择”整批；卡片与列表视图增加底部分页栏，按当前窗口可用高度和真实列数计算每页数量，
     窗口缩放后实时重算并夹紧当前页；补齐中文搜索占位符、查询/重置和分页文案。
   - 回归：`input-auth-workspace.spec.js › 工作区批量选择：Ctrl+左键框选卡片并批量删除`、
     `input-auth-workspace.spec.js › 工作区分页按视口高度自动适配，卡片和列表均可翻页`、
     `input-auth-workspace.spec.js › 工作区搜索：查询、重置、无结果状态`。

19. **导出的 PDF 文字与连线模糊**
   - 位置：`frontend/src/editor/state/useEditorState.js`、`frontend/src/editor/exporters/imageExporter.js`
   - 原因：PDF 内部图片原先按 180 DPI 栅格化并保存为 JPEG，随后又被拉伸到完整页面尺寸，导致边缘和文字发虚。
   - 修复：PDF 页面仍保持原逻辑尺寸，但内部画布按最长边最高 4096 px（约 300–400 DPI）重新栅格化，
     改用 PNG 无损写入；HTML 预览导出时按逻辑尺寸绘制后再整体缩放，避免高分辨率导致字号变小。
   - 回归：PDF 文件仍校验 `.pdf` 扩展名与 `%PDF-` 文件头；另在 PDF 查看器 100% / 125% 下截图确认节点文字、
     连线、旋转图形边缘清晰。

20. **思维导图文本块没有出现在工作区缩略图**
   - 位置：`frontend/src/App.vue`
   - 原因：工作区缩略图构建逻辑只收集 `nodes` / `edges`，没有读取当前页 `textBlocks`，空状态也只判断节点数量。
   - 修复：使用与画布一致的 `getVisibleTextBlocks` 计算文本块位置，纳入缩略图边界与 SVG 渲染；
     缩略图现在绘制文本块边框和最多三行摘要，纯文本块页面不再显示“空白”。
   - 回归：`input-auth-workspace.spec.js › 工作区缩略图显示思维导图文本块`。

21. **工作区缺少类型筛选，列表缺少按列排序**
   - 位置：`frontend/src/App.vue`、`frontend/src/i18n/index.js`
   - 修复：搜索栏增加“全部类型 / 绘图 / 思维导图 / Markdown / 思维笔记”下拉筛选，卡片和列表共用；
     列表增加标题、类型、摘要、页数四列表头，支持点击升序、再次点击降序，ARIA `aria-sort` 与方向箭头同步；
     筛选和排序都纳入分页计算，重置按钮同时清除关键词与类型筛选。
   - 回归：`input-auth-workspace.spec.js › 工作区按文档类型筛选，卡片和列表同步生效`、
     `input-auth-workspace.spec.js › 列表表头支持各列升序 / 降序排序`。

22. **空画布提示带图形图标，容易被误认为画布元素**
   - 位置：`frontend/src/components/Editor.vue`
   - 修复：移除空状态中的节点/连线 SVG 图标，改为居中浅色虚线提示框，只显示“画布为空”；
     全局排查笔记、历史、演示、工作区等空状态，均未再发现同类画布元素图标。
   - 回归：`input-flowchart.spec.js › 拖入图形、节点拖动、Shift 多选、框选、组合/取消组合`
     增加空状态无 `svg/img`、虚线边框和非透明背景断言。

23. **修改密码等表单仍是“标签在上、输入框在下”，与其他表单不一致**
   - 位置：`frontend/src/App.vue`、`frontend/src/components/Editor.vue`
   - 修复：修改密码表单改为两列网格 `112px + minmax(0, 1fr)`；文件名重命名改为 `68px + 1fr`；
     思维导图任务日期改为“标签 + 日期”单行排列，并统一垂直居中、间距和输入框宽度。
     登录 / 忘记密码、表格参数、节点属性原本已是左右并排，保持不变。
   - 回归：`input-auth-workspace.spec.js › 修改密码面板：显隐按钮、校验、折叠`、
     `input-auth-workspace.spec.js › 文件卡片：菜单重命名键盘提交/Esc、更多操作、删除`、
     `input-mindmap.spec.js › 属性面板：形状/字号/颜色/标记/优先级/进度/备注/标签/任务/附件/链接`
     均增加标签与输入框水平相邻、中心线对齐断言。

24. **空白画布与空白文档缩略图提示框和文字冗余**
   - 位置：`frontend/src/App.vue`、`frontend/src/components/Editor.vue`
   - 修复：完全移除画布与工作区卡片中的可见空白框和空白文字；空白画布只保留读屏隐藏状态，
     空白卡片只显示预览背景；列表摘要列统一使用 `—`，不再出现“空白 / 未填写内容 / 绘图”等重复文案。
   - 回归：`input-auth-workspace.spec.js › 空白文档不显示额外提示，列表摘要使用短横线`、
     `input-flowchart.spec.js › 拖入图形、节点拖动、Shift 多选、框选、组合/取消组合`。

25. **分页只能按视口自动计算，用户不能手动控制每页数量**
   - 位置：`frontend/src/App.vue`、`frontend/src/i18n/index.js`
   - 修复：底部分页栏增加“每页”选择，支持自动 / 10 / 20 / 40 / 60 / 100；手动值写入 `localStorage`，
     刷新和切换卡片/列表后仍保留；修改后回到第 1 页。分页栏在有文档时始终显示。
   - 布局：文档架改为内部纵向滚动，顶栏和分页栏固定，手动选择较大数量时不会裁切卡片或产生整页滚动。
   - 回归：`input-auth-workspace.spec.js › 工作区分页支持手动每页数量并持久化`。

26. **Markdown 代码块只有默认样式，缺少语言和外观属性**
   - 位置：`frontend/src/editor/render/useMarkdownPanel.js`、`frontend/src/components/Editor.vue`、
     `frontend/src/editor/render/markdownCodeBlock.js`、`frontend/src/editor/modes/markdown.js`
   - 修复：新增有状态代码块扩展，支持编码语言、背景色、文字色、边框色/宽度、圆角、内边距、自动换行和恢复默认；
     代码块右上角显示语言标识。属性通过 fenced-code info 字符串持久化，源码双向切换、保存和重新打开后保留。
   - 兼容：常见语言别名（js/ts/py/c++ 等）和已有代码块语言均保留，未知语言不会再被强制改成 text。
   - 回归：`input-markdown-note.spec.js › Markdown 代码块属性：语言、背景、文字、边框、圆角、内边距、换行`、
     `tests/unit/markdownCodeBlock.spec.js`。

27. **分页显示“自动”不直观，卡片/列表缺少数据库序号**
   - 位置：`frontend/src/App.vue`、`frontend/src/editor/model/document.js`、`backend/.../Diagram.java`、
     `backend/.../DiagramController.java`、Flyway 迁移、数据库 schema
   - 分页修复：分页选择器直接显示当前视口计算出的具体页数；固定选项为 10 / 20 / 40 / 60 / 100，
     手动选择后持久化到本地，超出可视区在文档架内部滚动。
   - 序号修复：新增 `diagram.sequence_no`，后端创建文档时按用户分配递增序号并在列表/详情 DTO 返回；
     启动迁移为历史文档回填序号并创建 `(user_id, sequence_no)` 索引；卡片、列表和列表表头均显示/支持排序。
   - 回归：`input-auth-workspace.spec.js › 工作区分页支持手动每页数量并持久化`、
     `input-auth-workspace.spec.js › 工作区卡片和列表显示数据库持久化序号`、后端 `DiagramControllerValidationTest`。

28. **代码块显示像双层底色，切换语言后文字仍没有语法高亮**
   - 位置：`frontend/src/editor/render/markdownCodeBlock.js`、`frontend/src/editor/render/useMarkdownPanel.js`、
     `frontend/src/components/Editor.vue`、`frontend/package.json`
   - 修复：接入 `@tiptap/extension-code-block-lowlight` + `lowlight`，代码块根据所选语言生成
     `hljs-keyword/string/number/type/function/comment` 等 token；纯文本语言不套用语法色。
   - 样式：代码块背景只绘制在 `pre`，`code` 子元素使用透明背景，并移除焦点 outline，避免看起来像两层。
   - 回归：`input-markdown-note.spec.js › Markdown 代码块属性：语言、背景、文字、边框、圆角、内边距、换行`
     校验 JavaScript token 存在、纯文本切换后 token 消失，并截图验证。

29. **代码块属性浮层不会随正文焦点关闭，切换代码块时属性可能沿用旧值**
   - 位置：`frontend/src/components/Editor.vue`
   - 修复：正文编辑器 `pointerdown` 捕获阶段统一关闭代码块/表格/链接浮层；点击“属性”前重新记录当前
     ProseMirror selection，浮层通过 `getAttributes('codeBlock')` 读取当前代码块的语言、背景、边框等值。
   - 回归：`input-markdown-note.spec.js › Markdown 代码块属性跟随当前焦点，点击正文后自动关闭`
     使用两个不同语言/背景的代码块交替点击，验证浮层关闭和字段切换。

30. **Markdown 代码块不能整体拖动重排，也不能通过鼠标改变外框尺寸**
   - 位置：`frontend/src/editor/render/markdownCodeBlock.js`、`frontend/src/components/Editor.vue`
   - 修复：代码块改为自定义 NodeView；ProseMirror `handleDOMEvents.pointerdown` 捕获
     `Ctrl + 左键`，拖动整个代码块到目标正文块前后完成重排；拖动时显示蓝色插入线、圆点、
     目标块浅色高亮和 `grabbing` 光标，明确提示最终落点。
   - 尺寸：右侧、底部和右下角增加缩放手柄，普通左键直接拖动即可调整宽度/高度；属性浮层同步提供宽度/高度输入。
   - 持久化：宽度/高度保存到 fenced-code info 的 `w/h` 元数据，源码切换、保存、重新打开后保留。
   - 回归：`input-markdown-note.spec.js › Markdown 代码块支持 Ctrl+左键拖动重排与拖边框调整宽高`。

31. **架构与性能：全量文档列表、深监听持久化、自定义数据库迁移**
   - 位置：`backend/pom.xml`、`backend/src/main/resources/db/migration/**`、`DiagramController.java`、
     `DiagramRepository.java`、`Diagram.java`、`frontend/src/App.vue`、`frontend/src/editor/services/workspaceStorage.js`
   - 数据库：改用 Flyway 版本化迁移；新增 `(user_id, sequence_no)` 唯一约束及冲突重试，
     并在 flush 阶段捕获延迟约束错误；`V3` 增加轻量预览字段，`V4` 增加 `search_text` 全文检索索引，
     `V5` 刷新旧版预览的 `pageCount` 合同。
   - 查询：新增服务端分页/筛选/排序接口 `GET /api/diagrams/page`，使用 JPA 投影，不读取正文 LOB
     或 `search_text`；正文搜索通过 `search_text` 在数据库侧匹配，不把完整文档载入 API 进程。
   - 前端：工作区切换为服务端分页；未保存草稿与已保存文档共享虚拟分页，偏移时按需 over-fetch；
     缩略图按 revision 缓存且只计算当前页；localStorage 只保存轻量元数据，完整 workspace 缓存与
     本地草稿写入 IndexedDB，350ms 防抖并在 `beforeunload / pagehide / visibilitychange` flush；
     IndexedDB 不可用时自动回退到专用 localStorage 草稿键。
   - 构建/维护：lowlight 改为按需注册语法语言；i18n 拆分 zh/en 文件；新增
     `workspaceDocuments`、`workspaceStorage`、`workspacePreview`、`useMarkdownFormatTools`、
     `useDocumentAutoSave` 和 `geometry` 模块，降低 App/Editor/useEditorState 的职责耦合。
   - 回归：全部 E2E、单元测试、`DiagramControllerValidationTest`、`DiagramRepositoryProjectionTest`
     （含 Flyway V1–V5、唯一约束和正文搜索）。

## 5. 界面布局调整（2026-10-18 第二轮）

- 登录 / 重置密码：移除视觉大标题（保留无障碍标题），字段改为左侧标签 + 右侧输入框；
  登录按钮、记住密码、忘记密码放在同一行，重置按钮与返回登录放在同一行，
  错误提示和操作行均与输入框左边缘对齐。
- 记住密码：勾选后登录成功会保存用户名和本地混淆后的密码，重新打开登录页自动回填；
  取消勾选或修改密码成功后清除本地记住的密码。
- 工作区：把“新建”按钮从“文件”标题行移到顶部 Process 品牌右侧；删除无信息量的“文件”标题行，
  文件卡片直接铺满首屏；已保存文档不再重复显示“已保存”徽章，只在本地草稿时提示。
- 编辑器：移除标题输入框，返回改为图标；把“历史/导出/导入/保存”动作组移动到原标题区域，
  模式选择与快捷键按钮紧随其后。
- 属性抽屉：点击节点上的标记徽章不再关闭抽屉，避免选中状态与属性面板丢失。
- 画布空间：内容最大宽度 1560px；编辑器外壳固定为 `100dvh - 92px`，工具栏/页签不伸缩，
  画布与右侧面板吃满剩余高度；单节点样式条移入属性抽屉，多选/连线工具条单行横向滚动。
- 1280×720、1280×800、1600×1000 均完成无整页滚动检查。

## 6. 回归结果

```text
全量 E2E：         61 passed
Vitest：          19 files / 103 tests passed
Backend：         17 tests passed
生产构建：        vite build 成功
```

执行命令：

```powershell
cd D:\documents\personal\Process\frontend

# 新增的真实输入全量回归
npx playwright test tests/e2e/input-auth-workspace.spec.js tests/e2e/input-flowchart.spec.js tests/e2e/input-mindmap.spec.js tests/e2e/input-markdown-note.spec.js tests/e2e/input-shell-import-export.spec.js --config playwright.verify.config.js --workers=1 --reporter=line

# 原有回归
npx playwright test tests/e2e/mindnote-verify.spec.js tests/e2e/smoke.spec.js --config playwright.verify.config.js --workers=1 --reporter=line

# 单元测试与构建
npm test
npm run build
```

## 7. 未覆盖 / 残余风险

- 浏览器矩阵仅覆盖 Chromium；Firefox / Safari 的指针捕获、`contenteditable` 焦点和原生
  `select` 行为未验证。
- 文件导入使用 Playwright 的 `setInputFiles` 注入本地文件，未逐像素操作系统文件选择器。
- 修改密码的成功路径未执行，避免改变本地 `demo` 演示账号口令；只覆盖了校验错误路径。
- 导出格式的内容正确性由原有 E2E 套件覆盖（PNG/JPG/SVG/PDF/XMind/drawio/Markdown/OPML）；
  本次新增重点验证鼠标菜单打开与下载触发。
- CUA 的 OS 级像素输入在后台/非前台窗口上受 Windows 焦点锁与窗口坐标缩放限制；本次完成
  了真实 Chrome 启动、地址栏导航与页面加载验收。可重复的交互断言以 CDP 真实输入层为准。
