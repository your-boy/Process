# 思维笔记页面级验证

## 运行方式

1. 启动后端（默认 H2 / local）：

   ```powershell
   cd D:\documents\personal\Process\backend
   mvn spring-boot:run
   ```

2. 运行页面级验证（`playwright.verify.config.js` 会拉起一个关闭 HMR 的 Vite 服务在 4174）：

   ```powershell
   cd D:\documents\personal\Process\frontend
   npx playwright test tests/e2e/mindnote-verify.spec.js --config playwright.verify.config.js --workers=1 --reporter=list
   ```

3. 单元测试与构建：

   ```powershell
   npm test
   npm run build
   ```

## 验证矩阵

| # | 场景 | 覆盖内容 |
| --- | --- | --- |
| 1 | 富文本工具栏 | 加粗、斜体、下划线、删除线、行内代码、无序/有序/任务列表、引用、代码块、表格、链接、清除格式 |
| 2 | 笔记视图与交互 | 双栏视图、大纲、添加/缩进/取消缩进/删除块、拖拽缩放手柄、正文搜索、Ctrl+滚轮缩放、撤销合并 |
| 3 | 多页与持久化 | 新建页面、切换页面、保存、历史版本面板、恢复版本、任务开始/截止/负责人、附件添加/删除 |
| 4 | 全格式导出 | PNG/JPG/SVG/PDF/XMind/drawio/Markdown/OPML；多页文件名、页面提示、XPdf 弹窗、XMind 多 Sheet、嵌套备注、drawio processHtml |
| 5 | 模板 | 会议纪要模板、项目复盘模板、预置富文本笔记块 |
| 6 | 导入往返 | 思维笔记 drawio 往返、XMind 导入、Markdown 大纲导入 |
| 7 | 画布细节 | 文本块拖拽、图层锁定阻止拖拽、页面重命名/删除 |
| 8 | 节点属性 | 形状、粗斜体、字号、文字颜色、图标、优先级、进度、标签、备注、搜索筛选 |
| 9 | 进阶属性 | 链接、提示、图片、边界、概要、关系线、图层排序 |
| 10 | 其它模块 | 思维导图 XMind/SVG/MD/OPML/drawio、流程图 PNG/JPG/SVG/PDF/drawio 往返、Markdown PNG/JPG/PDF |

## 最近一次结果

```text
Playwright: 10 passed (1.2m)
Vitest:     14 files / 76 tests passed
Build:      成功
U+FFFD:     0
```
