<template>
  <section class="editor-shell">
    <div class="editor-toolbar">
      <div class="toolbar-group">
        <input
          :value="document.title"
          class="title-input"
          type="text"
          maxlength="100"
          @input="editorState.updateTitle($event.target.value)"
        />
        <select class="mode-select" :value="document.mode" @change="editorState.setMode($event.target.value)">
          <option value="flowchart">流程图</option>
          <option value="mindmap">思维导图</option>
          <option value="markdown">Markdown</option>
          <option value="mind-note">思维笔记</option>
        </select>
      </div>

      <div v-if="editorState.activeTextBlockId.value" class="toolbar-group compact">
        <button v-if="editorState.activeTextBlockId.value" type="button" @click="editorState.formatMindNoteTextBlock('bold')">粗体</button>
        <button v-if="editorState.activeTextBlockId.value" type="button" @click="editorState.formatMindNoteTextBlock('italic')">斜体</button>
        <button v-if="editorState.activeTextBlockId.value" type="button" @click="editorState.formatMindNoteTextBlock('list')">列表</button>
        <button v-if="editorState.activeTextBlockId.value" type="button" @click="editorState.formatMindNoteTextBlock('link')">链接</button>
      </div>

      <div class="toolbar-group compact">
        <button type="button" @click="handleExport('png')">导出 PNG</button>
        <button type="button" @click="handleExport('jpg')">导出 JPG</button>
        <button type="button" :disabled="!canExportXMind" @click="handleExport('xmind')">导出 XMind</button>
        <button type="button" class="save-button" @click="editorState.saveDocument()" :disabled="editorState.isSaving.value">
          {{ editorState.isSaving.value ? '保存中...' : '保存' }}
        </button>
      </div>
    </div>

    <div v-if="selectedNodeStyle || selectedEdgeStyle" class="selection-toolbar-shell">
      <template v-if="selectedNodeStyle">
        <div class="toolbar-group compact node-style-toolbar">
          <button
            v-for="preset in nodeThemePresets"
            :key="preset.id"
            type="button"
            :class="['style-toggle', 'swatch-toggle', { active: selectedNodeStyle.accent === preset.accent && selectedNodeStyle.elevation === preset.elevation }]"
            @click="editorState.updateActiveNodeStyle({ accent: preset.accent, elevation: preset.elevation })"
          >
            <span class="swatch-dot" :style="{ background: resolveAccentPalette(preset.accent).stroke }"></span>
            {{ preset.label }}
          </button>
        </div>
      </template>

      <template v-else-if="selectedEdgeStyle">
        <div class="toolbar-group compact edge-style-toolbar">
          <span class="edge-style-caption">预设</span>
          <button
            v-for="preset in edgePresets"
            :key="preset.id"
            type="button"
            :class="['style-toggle', { active: isEdgePresetActive(preset) }]"
            @click="editorState.updateActiveEdgeStyle(preset.style)"
          >{{ preset.label }}</button>
          <span class="edge-style-caption">路线</span>
          <button
            type="button"
            :class="['style-toggle', { active: selectedEdgeStyle.route === 'orthogonal' }]"
            @click="editorState.updateActiveEdgeStyle({ route: 'orthogonal' })"
          >折线</button>
          <button
            type="button"
            :class="['style-toggle', { active: selectedEdgeStyle.route === 'straight' }]"
            @click="editorState.updateActiveEdgeStyle({ route: 'straight' })"
          >直线</button>
          <button
            type="button"
            :class="['style-toggle', { active: selectedEdgeStyle.route === 'curve' }]"
            @click="editorState.updateActiveEdgeStyle({ route: 'curve' })"
          >曲线</button>
          <span class="edge-style-caption">线型</span>
          <button
            type="button"
            :class="['style-toggle', { active: selectedEdgeStyle.stroke === 'dashed' }]"
            @click="editorState.updateActiveEdgeStyle({ stroke: 'dashed' })"
          >虚线</button>
          <button
            type="button"
            :class="['style-toggle', { active: selectedEdgeStyle.stroke === 'dotted' }]"
            @click="editorState.updateActiveEdgeStyle({ stroke: 'dotted' })"
          >点线</button>
          <button
            type="button"
            :class="['style-toggle', { active: selectedEdgeStyle.stroke === 'solid' }]"
            @click="editorState.updateActiveEdgeStyle({ stroke: 'solid' })"
          >实线</button>
          <span class="edge-style-caption">箭头</span>
          <button
            type="button"
            :class="['style-toggle', { active: selectedEdgeStyle.marker === 'arrow' }]"
            @click="editorState.updateActiveEdgeStyle({ marker: 'arrow' })"
          >箭头</button>
          <button
            type="button"
            :class="['style-toggle', { active: selectedEdgeStyle.marker === 'double-arrow' }]"
            @click="editorState.updateActiveEdgeStyle({ marker: 'double-arrow' })"
          >双箭头</button>
          <button
            type="button"
            :class="['style-toggle', { active: selectedEdgeStyle.marker === 'none' }]"
            @click="editorState.updateActiveEdgeStyle({ marker: 'none' })"
          >无线头</button>
        </div>
      </template>
    </div>

    <div v-if="document.mode === 'markdown'" class="markdown-workspace">
      <transition name="canvas-toast">
        <div v-if="editorToast.visible" :class="['editor-toast', editorToast.tone]" data-testid="save-toast">
          {{ editorToast.message }}
        </div>
      </transition>

      <p v-if="editorState.errorMessage.value" class="error-message inline-error">{{ editorState.errorMessage.value }}</p>

      <div class="markdown-panel editor-pane markdown-editor-pane">
        <div class="markdown-pane-header">
          <label class="markdown-label" for="markdown-editor">富文本编辑</label>
          <span class="markdown-stats">{{ markdownPanel.stats.value.words }} 词 / {{ markdownPanel.stats.value.characters }} 字符</span>
        </div>
        <div class="markdown-toolbar">
          <button
            type="button"
            :class="['style-toggle', { active: markdownPanel.formatting.value.heading1 }]"
            @click="markdownPanel.toggleHeading(1)"
          >标题1</button>
          <button
            type="button"
            :class="['style-toggle', { active: markdownPanel.formatting.value.heading2 }]"
            @click="markdownPanel.toggleHeading(2)"
          >标题2</button>
          <button
            type="button"
            :class="['style-toggle', { active: markdownPanel.formatting.value.heading3 }]"
            @click="markdownPanel.toggleHeading(3)"
          >标题3</button>
          <button
            type="button"
            :class="['style-toggle', { active: markdownPanel.formatting.value.bold }]"
            @click="markdownPanel.toggleBold()"
          >粗体</button>
          <button
            type="button"
            :class="['style-toggle', { active: markdownPanel.formatting.value.italic }]"
            @click="markdownPanel.toggleItalic()"
          >斜体</button>
          <button
            type="button"
            :class="['style-toggle', { active: markdownPanel.formatting.value.underline }]"
            @click="markdownPanel.toggleUnderline()"
          >下划线</button>
          <button
            type="button"
            :class="['style-toggle', { active: markdownPanel.formatting.value.strike }]"
            @click="markdownPanel.toggleStrike()"
          >删除线</button>
          <button
            type="button"
            :class="['style-toggle', { active: markdownPanel.formatting.value.bulletList }]"
            @click="markdownPanel.toggleBulletList()"
          >列表</button>
          <button
            type="button"
            :class="['style-toggle', { active: markdownPanel.formatting.value.orderedList }]"
            @click="markdownPanel.toggleOrderedList()"
          >有序列表</button>
          <button
            type="button"
            :class="['style-toggle', { active: markdownPanel.formatting.value.taskList }]"
            @click="markdownPanel.toggleTaskList()"
          >任务列表</button>
          <button
            type="button"
            :class="['style-toggle', { active: markdownPanel.formatting.value.blockquote }]"
            @click="markdownPanel.toggleBlockquote()"
          >引用</button>
          <button
            type="button"
            :class="['style-toggle', { active: markdownPanel.formatting.value.code }]"
            @click="markdownPanel.toggleInlineCode()"
          >行内代码</button>
          <button
            type="button"
            :class="['style-toggle', { active: markdownPanel.formatting.value.codeBlock }]"
            @click="markdownPanel.toggleCodeBlock()"
          >代码块</button>
          <button
            type="button"
            :class="['style-toggle', { active: markdownPanel.formatting.value.table }]"
            @click="markdownPanel.insertTable()"
          >表格</button>
          <button
            v-if="markdownPanel.formatting.value.table"
            type="button"
            class="style-toggle"
            @click="markdownPanel.addTableRow()"
          >加行</button>
          <button
            v-if="markdownPanel.formatting.value.table"
            type="button"
            class="style-toggle"
            @click="markdownPanel.addTableColumn()"
          >加列</button>
          <button
            v-if="markdownPanel.formatting.value.table"
            type="button"
            class="style-toggle"
            @click="markdownPanel.deleteTable()"
          >删表格</button>
          <button
            type="button"
            class="style-toggle"
            @click="markdownPanel.insertHorizontalRule()"
          >分隔线</button>
        </div>
        <div class="markdown-link-toolbar">
          <input
            :value="markdownPanel.linkHref.value"
            data-testid="markdown-link-input"
            class="markdown-link-input"
            type="url"
            placeholder="输入或修改链接地址"
            @input="markdownPanel.setLinkHref($event.target.value)"
            @keydown.enter.prevent="markdownPanel.applyLinkHref()"
          />
          <button
            type="button"
            :class="['style-toggle', { active: markdownPanel.formatting.value.link }]"
            @click="markdownPanel.applyLinkHref()"
          >应用链接</button>
          <button
            type="button"
            class="style-toggle"
            :disabled="!markdownPanel.formatting.value.link && !markdownPanel.linkHref.value"
            @click="markdownPanel.clearLinkHref()"
          >移除链接</button>
        </div>
        <div id="markdown-editor" data-testid="markdown-editor" class="markdown-editor-shell">
          <EditorContent v-if="markdownPanel.editor.value" :editor="markdownPanel.editor.value" />
        </div>
      </div>

      <div class="markdown-sidecar">
        <div class="markdown-panel preview-pane">
          <div class="markdown-pane-header">
            <label class="markdown-label">实时预览</label>
            <span class="markdown-note">导出将以此面板为准</span>
          </div>
          <div ref="previewRef" class="markdown-preview-surface" data-testid="markdown-preview" v-html="markdownPanel.html.value"></div>
        </div>

        <div class="markdown-panel source-pane">
          <div class="markdown-pane-header">
            <label class="markdown-label" for="markdown-source">Markdown 原文</label>
            <span class="markdown-note">与富文本双向同步</span>
          </div>
          <textarea
            id="markdown-source"
            :value="document.content.sourceText"
            data-testid="markdown-source"
            class="markdown-source"
            @input="editorState.updateMarkdownSource($event.target.value)"
          ></textarea>
        </div>
      </div>
    </div>

    <div v-else class="workspace-grid">
      <div
        ref="canvasCardRef"
        :class="['canvas-card', { panning: Boolean(panState) || spacePressed }]"
      >
        <transition name="canvas-toast">
          <div v-if="editorToast.visible" :class="['editor-toast', editorToast.tone]" data-testid="save-toast">
            {{ editorToast.message }}
          </div>
        </transition>

        <div class="canvas-hud">
          <div class="canvas-hud-chip">
            <span class="canvas-hud-label">缩放</span>
            <span data-testid="zoom-indicator">{{ Math.round(document.content.viewport.zoom * 100) }}%</span>
          </div>
          <div class="canvas-hud-chip metric">
            <span class="canvas-hud-dot"></span>
            <span data-testid="node-count">{{ visibleNodes.length }}</span>
          </div>
          <div class="canvas-hud-chip metric">
            <span class="canvas-hud-line"></span>
            <span data-testid="edge-count">{{ visibleEdges.length }}</span>
          </div>
        </div>

        <p v-if="editorState.errorMessage.value" class="error-message canvas-error">{{ editorState.errorMessage.value }}</p>

        <svg
          ref="svgRef"
          class="diagram-canvas"
          viewBox="0 0 1200 720"
          @wheel.prevent="handleCanvasWheel"
          @pointerup="handleCanvasPointerUpOnSvg"
          @dragenter.prevent="handleCanvasDragEnter"
          @dragover.prevent="handleCanvasDragOver"
          @dragleave="handleCanvasDragLeave"
          @drop.prevent="handleCanvasDrop"
          @pointerleave="endDrag"
        >
          <defs>
            <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(71, 85, 105, 0.16)" stroke-width="1" />
            </pattern>
            <marker id="edge-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="10" markerHeight="10" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" stroke="context-stroke" />
            </marker>
          </defs>

          <rect
            width="1200"
            height="720"
            fill="url(#grid)"
            data-testid="canvas-surface"
            @click="handleCanvasClick"
            @pointerdown="handleCanvasPointerDown"
            @pointerup="handleCanvasPointerUp"
            @dragenter.prevent="handleCanvasDragEnter"
            @dragover.prevent="handleCanvasDragOver"
            @dragleave="handleCanvasDragLeave"
            @drop.prevent="handleCanvasDrop"
          />

          <g :transform="canvasTransform">
            <g v-if="linkPreview" class="link-preview-layer" pointer-events="none">
              <path :d="linkPreview.path" class="link-preview-path" />
              <circle
                v-for="anchor in linkPreview.anchors"
                :key="anchor.key"
                :cx="anchor.x"
                :cy="anchor.y"
                r="7"
                class="link-preview-anchor"
              />
            </g>
            <rect
              v-if="selectionBounds"
              class="selection-marquee"
              :x="selectionBounds.x"
              :y="selectionBounds.y"
              :width="selectionBounds.width"
              :height="selectionBounds.height"
              pointer-events="none"
            />

            <g
              v-for="edge in visibleEdges"
              :key="edge.id"
              @pointerenter="handleEdgeHover(edge.id)"
              @pointerleave="handleEdgeHover(null)"
            >
              <path
                :d="edge.path"
                class="edge-hit-area"
                fill="none"
                @click.stop="handleEdgeClick(edge)"
                @dblclick.stop="openEdgeLabelEditor(edge)"
              />
              <path
                :d="edge.path"
                :data-testid="`edge-path-${edge.id}`"
                :class="['edge-path', {
                  active: edge.id === editorState.activeEdgeId.value,
                  hovered: edge.id === hoveredEdgeId,
                  subtle: !edge.label
                }]"
                fill="none"
                :stroke="resolveEdgeStroke(edge)"
                :stroke-width="resolveEdgeWidth(edge)"
                :stroke-dasharray="resolveEdgeDasharray(edge)"
                :marker-start="resolveEdgeMarkerStart(edge)"
                :marker-end="resolveEdgeMarkerEnd(edge)"
                stroke-linecap="round"
                stroke-linejoin="round"
                @click.stop="handleEdgeClick(edge)"
                @dblclick.stop="openEdgeLabelEditor(edge)"
              />
              <g
                v-if="edge.label && edge.id !== edgeLabelEditor?.edgeId"
                class="edge-label-chip"
                :transform="`translate(${edge.labelPosition.x} ${edge.labelPosition.y})`"
                @click.stop="handleEdgeClick(edge)"
                @dblclick.stop="openEdgeLabelEditor(edge)"
              >
                <rect
                  x="-52"
                  y="-14"
                  width="104"
                  height="28"
                  rx="14"
                  :class="['edge-label-bg', { active: edge.id === editorState.activeEdgeId.value }]"
                  :style="resolveEdgeLabelStyle(edge)"
                />
                <text class="edge-label-text" text-anchor="middle" dy="5">{{ edge.labelText }}</text>
              </g>
            </g>

            <g
              v-for="node in visibleNodes"
              :key="node.id"
              @pointerenter="handleNodeHover(node.id)"
              @pointerleave="handleNodeHover(null)"
            >
              <rect
                v-if="isTreeMode || node.kind === 'process'"
                :data-testid="`node-shape-${node.id}`"
                :x="node.x"
                :y="node.y"
                :width="node.width"
                :height="node.height"
                :rx="isTreeMode ? 28 : 8"
                :class="['node-shape', {
                  active: node.id === editorState.activeNodeId.value,
                  selected: selectedNodeIdSet.has(node.id),
                  hovered: node.id === hoveredNodeId,
                  topic: isTreeMode,
                  'snap-source': linkPreview?.sourceId === node.id,
                  'snap-target': linkPreview?.targetId === node.id
                }]"
                :style="resolveNodeShapeStyle(node)"
                @pointerdown="startDrag(node, $event)"
                @click.stop="handleNodeClick(node, $event)"
                @dblclick.stop="openTextOverlay(node.id)"
              />
              <path
                v-else
                :data-testid="`node-shape-${node.id}`"
                :d="getNodePath(node)"
                :class="['node-shape', {
                  active: node.id === editorState.activeNodeId.value,
                  selected: selectedNodeIdSet.has(node.id),
                  hovered: node.id === hoveredNodeId,
                  'snap-source': linkPreview?.sourceId === node.id,
                  'snap-target': linkPreview?.targetId === node.id
                }]"
                :style="resolveNodeShapeStyle(node)"
                @pointerdown="startDrag(node, $event)"
                @click.stop="handleNodeClick(node, $event)"
                @dblclick.stop="openTextOverlay(node.id)"
              />
              <text
                v-show="node.id !== textOverlay.editingNodeId.value"
                :x="node.x + node.width / 2"
                :y="node.y + node.height / 2 + 5"
                text-anchor="middle"
                class="node-label"
                :data-testid="`node-label-${node.id}`"
                :style="resolveNodeLabelStyle(node)"
                @pointerdown="startDrag(node, $event)"
                @click.stop="handleNodeClick(node, $event)"
                @dblclick.stop="openTextOverlay(node.id)"
              >
                {{ node.text }}
              </text>
              <g v-if="showAnchorHints(node)" class="node-anchor-hints" pointer-events="none">
                <circle
                  v-for="anchor in resolveNodeAnchors(node)"
                  :key="anchor.key"
                  :cx="anchor.x"
                  :cy="anchor.y"
                  r="5.5"
                  class="node-anchor-dot"
                />
              </g>
              <foreignObject
                v-if="node.id === textOverlay.editingNodeId.value"
                :x="node.x + 10"
                :y="node.y + Math.max((node.height - resolveInlineNodeEditorHeight(node)) / 2, 8)"
                :width="Math.max(node.width - 20, 72)"
                :height="resolveInlineNodeEditorHeight(node)"
                class="inline-node-editor"
              >
                <div xmlns="http://www.w3.org/1999/xhtml" class="inline-node-editor-shell">
                  <input
                    v-model="textOverlay.draftText.value"
                    data-testid="text-overlay-input"
                    class="inline-node-input"
                    type="text"
                    maxlength="100"
                    autofocus
                    @keydown.enter.prevent="submitTextOverlay"
                    @keydown.esc.prevent="textOverlay.cancel()"
                  />
                </div>
              </foreignObject>
            </g>

            <foreignObject
              v-if="edgeLabelEditor"
              :x="edgeLabelEditor.x - 82"
              :y="edgeLabelEditor.y - 18"
              width="164"
              height="36"
              class="inline-edge-editor"
            >
              <div xmlns="http://www.w3.org/1999/xhtml" class="inline-edge-editor-shell">
                <input
                  v-model="edgeLabelEditor.text"
                  data-testid="edge-label-input"
                  class="inline-edge-input"
                  type="text"
                  maxlength="60"
                  autofocus
                  @keydown.enter.prevent="submitEdgeLabelEditor"
                  @keydown.esc.prevent="closeEdgeLabelEditor"
                />
              </div>
            </foreignObject>
          </g>
        </svg>

        <div v-if="document.mode === 'mindmap' || document.mode === 'mind-note'" class="mind-note-layer">
          <div
            v-for="block in visibleTextBlocks"
            :key="block.id"
            :data-testid="`mind-note-block-${block.id}`"
            :class="['mind-note-block', { active: block.id === editorState.activeTextBlockId.value }]"
            :style="textBlockStyle(block)"
            @click="editorState.selectTextBlock(block.id)"
          >
            <div
              :data-testid="`mind-note-handle-${block.id}`"
              class="mind-note-block-handle"
              @pointerdown.stop="startTextBlockDrag(block, $event)"
            >拖动文本块</div>
            <textarea
              :value="block.text"
              :data-testid="`mind-note-input-${block.id}`"
              class="mind-note-input"
              @click.stop="editorState.selectTextBlock(block.id)"
              @input="editorState.updateMindNoteTextBlock(block.id, $event.target.value)"
            ></textarea>
            <div
              :data-testid="`mind-note-preview-${block.id}`"
              class="mind-note-preview"
              v-html="block.html"
            ></div>
          </div>
        </div>

      </div>

      <aside class="palette-panel">
        <header class="layer-header">
          <h3>{{ paletteTitle }}</h3>
        </header>

        <div v-if="paletteItems.length" class="palette-list">
          <button
            v-for="item in paletteItems"
            :key="item.id"
            :data-testid="`palette-item-${item.id}`"
            class="palette-item"
            :style="resolvePaletteItemStyle(item)"
            type="button"
            draggable="true"
            @pointerdown="primePaletteDrag(item, $event)"
            @dragstart="startPaletteDrag(item, $event)"
            @dragend="endPaletteDrag"
          >
            <div class="palette-preview" :data-testid="`palette-preview-${item.id}`">
              <svg
                v-if="document.mode === 'flowchart'"
                class="palette-preview-svg"
                viewBox="0 0 120 72"
                aria-hidden="true"
              >
                <path
                  :d="getPaletteFlowchartPath(item.id)"
                  :fill="resolvePaletteAccentPalette(item).fillActive"
                  :stroke="resolvePaletteAccentPalette(item).stroke"
                  stroke-width="2.2"
                  stroke-linejoin="round"
                />
              </svg>
              <svg
                v-else
                class="palette-preview-svg"
                viewBox="0 0 120 72"
                aria-hidden="true"
              >
                <line
                  v-for="connector in getPaletteTreePreview(item.id).connectors"
                  :key="connector.key"
                  class="palette-preview-connector"
                  :x1="connector.x1"
                  :y1="connector.y1"
                  :x2="connector.x2"
                  :y2="connector.y2"
                  :stroke="resolvePaletteAccentPalette(item).stroke"
                />
                <rect
                  v-for="rect in getPaletteTreePreview(item.id).rects"
                  :key="rect.key"
                  :x="rect.x"
                  :y="rect.y"
                  :width="rect.width"
                  :height="rect.height"
                  :rx="rect.rx"
                  :fill="rect.fill || resolvePaletteAccentPalette(item).fillActive"
                  :stroke="rect.stroke || resolvePaletteAccentPalette(item).stroke"
                  stroke-width="2"
                />
                <line
                  v-for="noteLine in getPaletteTreePreview(item.id).noteLines"
                  :key="noteLine.key"
                  :x1="noteLine.x1"
                  :y1="noteLine.y1"
                  :x2="noteLine.x2"
                  :y2="noteLine.y2"
                  :stroke="resolvePaletteAccentPalette(item).text"
                  stroke-width="2.4"
                  stroke-linecap="round"
                />
                <circle
                  v-for="circle in getPaletteTreePreview(item.id).circles"
                  :key="circle.key"
                  :cx="circle.cx"
                  :cy="circle.cy"
                  :r="circle.r"
                  :fill="circle.fill || resolvePaletteAccentPalette(item).fillActive"
                  :stroke="circle.stroke || resolvePaletteAccentPalette(item).stroke"
                  stroke-width="2"
                />
              </svg>
            </div>
            <div class="palette-item-copy">
              <strong>{{ item.label }}</strong>
              <span>{{ item.description }}</span>
            </div>
          </button>
        </div>

        <div v-else class="palette-empty">
          当前模式以键盘输入和预览为主，不需要拖拽图形。
        </div>
      </aside>
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { EditorContent } from '@tiptap/vue-3'
import { buildEdgePath, routeEdge } from '../editor/render/edgeRouter'
import { getVisibleTextBlocks } from '../editor/render/textBlockLayer'
import { useMarkdownPanel } from '../editor/render/useMarkdownPanel'
import { useTextOverlay } from '../editor/render/useTextOverlay'

const ACCENT_PALETTES = {
  teal: { fill: '#f0fdfa', fillActive: '#d9fbf2', stroke: '#0f766e', strokeActive: '#0f53a7', text: '#134e4a', glow: 'rgba(45, 212, 191, 0.32)', edge: '#0f766e' },
  blue: { fill: '#eff6ff', fillActive: '#dbeafe', stroke: '#1d4ed8', strokeActive: '#1e40af', text: '#1e3a8a', glow: 'rgba(59, 130, 246, 0.3)', edge: '#2563eb' },
  amber: { fill: '#fffbeb', fillActive: '#fef3c7', stroke: '#d97706', strokeActive: '#b45309', text: '#78350f', glow: 'rgba(245, 158, 11, 0.26)', edge: '#b45309' },
  rose: { fill: '#fff1f2', fillActive: '#ffe4e6', stroke: '#e11d48', strokeActive: '#be123c', text: '#881337', glow: 'rgba(244, 63, 94, 0.26)', edge: '#e11d48' },
  violet: { fill: '#f5f3ff', fillActive: '#ede9fe', stroke: '#7c3aed', strokeActive: '#6d28d9', text: '#4c1d95', glow: 'rgba(139, 92, 246, 0.28)', edge: '#7c3aed' },
  emerald: { fill: '#ecfdf5', fillActive: '#d1fae5', stroke: '#059669', strokeActive: '#047857', text: '#065f46', glow: 'rgba(16, 185, 129, 0.28)', edge: '#059669' },
  sky: { fill: '#f0f9ff', fillActive: '#e0f2fe', stroke: '#0284c7', strokeActive: '#0369a1', text: '#0c4a6e', glow: 'rgba(14, 165, 233, 0.28)', edge: '#0284c7' },
  slate: { fill: '#f8fafc', fillActive: '#e2e8f0', stroke: '#334155', strokeActive: '#0f172a', text: '#0f172a', glow: 'rgba(71, 85, 105, 0.26)', edge: '#334155' }
}

const props = defineProps({
  editorState: {
    type: Object,
    required: true
  },
  currentUser: {
    type: Object,
    required: true
  }
})

const svgRef = ref(null)
const canvasCardRef = ref(null)
const previewRef = ref(null)
const dragState = ref(null)
const textBlockDragState = ref(null)
const panState = ref(null)
const selectionState = ref(null)
const selectedNodeIds = ref([])
const spacePressed = ref(false)
const suppressCanvasClick = ref(false)
const suppressNodeClick = ref(false)
const treeClickState = ref({ nodeId: null, timestamp: 0 })
const paletteDragItem = ref(null)
const palettePointerState = ref(null)
const paletteDropHandled = ref(false)
const canvasDragInside = ref(false)
const lastCanvasDragPoint = ref(null)
const edgeLabelEditor = ref(null)
const hoveredNodeId = ref(null)
const hoveredEdgeId = ref(null)
const editorToast = ref({ visible: false, message: '', tone: 'success' })
const document = computed(() => props.editorState.document.value)
const isTreeMode = computed(() => ['mindmap', 'mind-note'].includes(document.value.mode))
const orderedLayers = computed(() => [...document.value.content.layers].sort((left, right) => left.order - right.order))
const layerMap = computed(() => new Map(orderedLayers.value.map(layer => [layer.id, layer])))
const hiddenNodeIds = computed(() => new Set(props.editorState.performanceSummary.value.hiddenNodeIds || []))
const canExportXMind = computed(() => ['mindmap', 'mind-note'].includes(document.value.mode))
const selectedNode = computed(() => document.value.content.nodes.find(node => node.id === props.editorState.activeNodeId.value) || null)
const selectedNodeStyle = computed(() => selectedNode.value?.style || null)
const selectedEdge = computed(() => document.value.content.edges.find(edge => edge.id === props.editorState.activeEdgeId.value) || null)
const selectedEdgeStyle = computed(() => selectedEdge.value?.style || null)
const selectedNodeIdSet = computed(() => new Set(selectedNodeIds.value))
const selectionBounds = computed(() => {
  if (!selectionState.value) {
    return null
  }

  return normalizeSelectionBounds(selectionState.value.startPoint, selectionState.value.currentPoint)
})
const nodeThemePresets = [
  { id: 'teal-soft', label: '清透', accent: 'teal', elevation: 'soft' },
  { id: 'blue-glow', label: '聚焦', accent: 'blue', elevation: 'glow' },
  { id: 'amber-soft', label: '强调', accent: 'amber', elevation: 'soft' },
  { id: 'violet-soft', label: '灵感', accent: 'violet', elevation: 'soft' },
  { id: 'rose-glow', label: '提醒', accent: 'rose', elevation: 'glow' }
]
const edgePresets = [
  { id: 'flow', label: '流程', style: { route: 'orthogonal', stroke: 'solid', marker: 'arrow' } },
  { id: 'link', label: '关联', style: { route: 'curve', stroke: 'dashed', marker: 'none' } },
  { id: 'feedback', label: '回路', style: { route: 'curve', stroke: 'solid', marker: 'double-arrow' } }
]
const activeNodes = computed(() => {
  if (!dragState.value?.previewPositions) return document.value.content.nodes
  return document.value.content.nodes.map(node => {
    if (dragState.value.previewPositions[node.id]) {
      return {
        ...node,
        x: dragState.value.previewPositions[node.id].x,
        y: dragState.value.previewPositions[node.id].y
      }
    }
    return node
  })
})
const visibleNodes = computed(() => activeNodes.value.filter(node => {
  if (layerMap.value.get(node.layerId)?.visible === false) {
    return false
  }
  return !hiddenNodeIds.value.has(node.id)
}))
const visibleEdges = computed(() => document.value.content.edges
  .filter(edge => layerMap.value.get(edge.layerId)?.visible !== false)
  .filter(edge => !hiddenNodeIds.value.has(edge.fromNodeId) && !hiddenNodeIds.value.has(edge.toNodeId))
  .map(edge => {
    const points = routeEdge(edge, activeNodes.value)
    return {
      ...edge,
      points,
      path: buildEdgePath(points, edge.style),
      labelPosition: resolveEdgeLabelPosition(points),
      labelText: edge.label || ''
    }
  }))
const linkPreview = computed(() => {
  if (document.value.mode !== 'flowchart' || edgeLabelEditor.value || textOverlay.editingNode.value) {
    return null
  }

  const sourceId = props.editorState.activeNodeId.value
  const targetId = hoveredNodeId.value
  if (!sourceId || !targetId || sourceId === targetId) {
    return null
  }

  const sourceNode = activeNodes.value.find(node => node.id === sourceId)
  const targetNode = activeNodes.value.find(node => node.id === targetId)
  if (!sourceNode || !targetNode) {
    return null
  }

  const previewConnection = {
    ...resolveConnection(sourceNode, targetNode),
    style: { route: 'curve' }
  }
  const points = routeEdge(previewConnection, activeNodes.value)
  return {
    sourceId,
    targetId,
    path: buildEdgePath(points, { route: 'curve' }),
    anchors: [
      { key: `${sourceId}-start`, x: points[0].x, y: points[0].y },
      { key: `${targetId}-end`, x: points[points.length - 1].x, y: points[points.length - 1].y }
    ]
  }
})
const canvasTransform = computed(() => {
  const viewport = document.value.content.viewport
  return `translate(${viewport.x} ${viewport.y}) scale(${viewport.zoom})`
})
const visibleTextBlocks = computed(() => getVisibleTextBlocks(
  document.value.content.textBlocks,
  document.value.content.nodes,
  props.editorState.performanceSummary.value.hiddenNodeIds || [],
  new Set(orderedLayers.value.filter(layer => layer.visible !== false).map(layer => layer.id))
).map(block => {
  if (textBlockDragState.value?.blockId !== block.id || !textBlockDragState.value.previewPosition) {
    return block
  }

  return {
    ...block,
    x: textBlockDragState.value.previewPosition.x,
    y: textBlockDragState.value.previewPosition.y
  }
}))
const paletteItems = computed(() => {
  if (document.value.mode === 'flowchart') {
    return [
      { id: 'process', label: '矩形', description: '步骤或处理' },
      { id: 'terminator', label: '圆角矩形', description: '开始或结束' },
      { id: 'decision', label: '菱形', description: '判断或条件' },
      { id: 'ellipse', label: '圆形', description: '连接或状态' },
      { id: 'parallelogram', label: '平行四边形', description: '数据(输入/输出)' },
      { id: 'document', label: '文档', description: '输出文件' },
      { id: 'cylinder', label: '圆柱体', description: '数据库' },
      { id: 'hexagon', label: '六边形', description: '准备或准备条件' },
      { id: 'card', label: '卡片', description: '业务卡片或表单' },
      { id: 'delay', label: '延迟', description: '等待或延时' },
      { id: 'note', label: '便签', description: '说明或备注' },
      { id: 'cloud', label: '云朵', description: '外部系统或服务' }
    ]
  }
  if (document.value.mode === 'mindmap') {
    return [
      { id: 'mind-sibling', label: '同级主题', description: '拖入后新增同级节点' },
      { id: 'mind-child', label: '子主题', description: '拖入后新增子节点' },
      { id: 'note-block', label: '文本块', description: '拖入后挂到当前主题' }
    ]
  }
  if (document.value.mode === 'mind-note') {
    return [
      { id: 'mind-sibling', label: '同级主题', description: '拖入后新增同级节点' },
      { id: 'mind-child', label: '子主题', description: '拖入后新增子节点' },
      { id: 'note-block', label: '文本块', description: '拖入后挂到当前主题' }
    ]
  }
  return []
})
const paletteTitle = computed(() => document.value.mode === 'flowchart' ? '图形' : '节点')
const markdownPanel = useMarkdownPanel(document, nextSource => props.editorState.updateMarkdownSource(nextSource))
const textOverlay = useTextOverlay(nodeId => document.value.content.nodes.find(node => node.id === nodeId))

let editorToastTimer = null

watch(() => props.editorState.manualSaveFeedbackToken.value, token => {
  if (!token) {
    return
  }

  showEditorToast('已保存', 'success')
})

watch(() => props.editorState.errorMessage.value, message => {
  if (!message) {
    return
  }

  showEditorToast(message, 'error', 2200)
})

watch(() => document.value.content.nodes.map(node => node.id), nodeIds => {
  const nodeIdSet = new Set(nodeIds)
  selectedNodeIds.value = selectedNodeIds.value.filter(nodeId => nodeIdSet.has(nodeId))
})

function startDrag(node, event) {
  if (layerMap.value.get(node.layerId)?.locked) {
    return
  }

  const draggedNodeIds = selectedNodeIds.value.length > 1 && selectedNodeIdSet.value.has(node.id)
    ? [...selectedNodeIds.value]
    : [node.id]

  if (draggedNodeIds.length === 1) {
    selectedNodeIds.value = []
  }

  const pointer = resolvePoint(event)
  const initialPositions = Object.fromEntries(draggedNodeIds.map(nodeId => {
    const currentNode = activeNodes.value.find(item => item.id === nodeId) || document.value.content.nodes.find(item => item.id === nodeId)
    return [nodeId, { x: currentNode?.x || 0, y: currentNode?.y || 0 }]
  }))

  dragState.value = {
    anchorNodeId: node.id,
    nodeIds: draggedNodeIds,
    initialPositions,
    offsetX: pointer.x - node.x,
    offsetY: pointer.y - node.y,
    deltaX: 0,
    deltaY: 0,
    previewPositions: null
  }
  event.target.setPointerCapture(event.pointerId)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', endDrag)
}

function onPointerMove(event) {
  if (!dragState.value) {
    return
  }

  const pointer = resolvePoint(event)
  const anchorPosition = dragState.value.initialPositions[dragState.value.anchorNodeId]
  const deltaX = (pointer.x - dragState.value.offsetX) - anchorPosition.x
  const deltaY = (pointer.y - dragState.value.offsetY) - anchorPosition.y
  dragState.value.deltaX = deltaX
  dragState.value.deltaY = deltaY
  dragState.value.previewPositions = Object.fromEntries(dragState.value.nodeIds.map(nodeId => {
    const initialPosition = dragState.value.initialPositions[nodeId]
    return [nodeId, {
      x: initialPosition.x + deltaX,
      y: initialPosition.y + deltaY
    }]
  }))
}

function startTextBlockDrag(block, event) {
  if (event.button !== 0) {
    return
  }

  if (layerMap.value.get(block.layerId)?.locked) {
    return
  }

  props.editorState.selectTextBlock(block.id)

  const pointer = resolvePoint(event)
  textBlockDragState.value = {
    blockId: block.id,
    initialPosition: { x: block.x, y: block.y },
    offsetX: pointer.x - block.x,
    offsetY: pointer.y - block.y,
    deltaX: 0,
    deltaY: 0,
    previewPosition: null
  }
  event.currentTarget.setPointerCapture?.(event.pointerId)
  window.addEventListener('pointermove', onTextBlockPointerMove)
  window.addEventListener('pointerup', endTextBlockDrag)
  window.addEventListener('pointercancel', endTextBlockDrag)
}

function onTextBlockPointerMove(event) {
  if (!textBlockDragState.value) {
    return
  }

  const pointer = resolvePoint(event)
  const deltaX = (pointer.x - textBlockDragState.value.offsetX) - textBlockDragState.value.initialPosition.x
  const deltaY = (pointer.y - textBlockDragState.value.offsetY) - textBlockDragState.value.initialPosition.y
  textBlockDragState.value.deltaX = deltaX
  textBlockDragState.value.deltaY = deltaY
  textBlockDragState.value.previewPosition = {
    x: textBlockDragState.value.initialPosition.x + deltaX,
    y: textBlockDragState.value.initialPosition.y + deltaY
  }
}

function handleCanvasPointerDown(event) {
  if (paletteDragItem.value) {
    return
  }

  if (event.button === 0 && event.shiftKey) {
    startSelectionMarquee(event)
    return
  }

  startCanvasPan(event)
}

function startCanvasPan(event) {
  const canPanWithLeftButton = event.button === 0 && !event.shiftKey
  const canPanWithMiddleButton = event.button === 1
  if (!canPanWithLeftButton && !canPanWithMiddleButton) {
    return
  }

  event.preventDefault()
  const viewport = document.value.content.viewport
  panState.value = {
    startX: event.clientX,
    startY: event.clientY,
    viewportX: viewport.x,
    viewportY: viewport.y,
    moved: false
  }
  window.addEventListener('pointermove', onCanvasPanMove)
  window.addEventListener('pointerup', endCanvasPan)
}

function onCanvasPanMove(event) {
  if (!panState.value) {
    return
  }

  panState.value.moved = panState.value.moved || Math.abs(event.clientX - panState.value.startX) > 4 || Math.abs(event.clientY - panState.value.startY) > 4
  props.editorState.setViewport({
    x: panState.value.viewportX + event.clientX - panState.value.startX,
    y: panState.value.viewportY + event.clientY - panState.value.startY
  })
}

function endCanvasPan() {
  const didMove = Boolean(panState.value?.moved)
  panState.value = null
  window.removeEventListener('pointermove', onCanvasPanMove)
  window.removeEventListener('pointerup', endCanvasPan)
  if (didMove) {
    suppressCanvasClick.value = true
  }
}

function startSelectionMarquee(event) {
  event.preventDefault()
  const point = resolvePoint(event)
  closeEdgeLabelEditor()
  selectionState.value = {
    startPoint: point,
    currentPoint: point
  }
  window.addEventListener('pointermove', onSelectionMarqueeMove)
  window.addEventListener('pointerup', endSelectionMarquee)
  window.addEventListener('pointercancel', endSelectionMarquee)
}

function onSelectionMarqueeMove(event) {
  if (!selectionState.value) {
    return
  }

  selectionState.value = {
    ...selectionState.value,
    currentPoint: resolvePoint(event)
  }
}

function endSelectionMarquee() {
  if (!selectionState.value) {
    return
  }

  const bounds = normalizeSelectionBounds(selectionState.value.startPoint, selectionState.value.currentPoint)
  const shouldSelect = bounds.width > 8 || bounds.height > 8
  if (shouldSelect) {
    const nextSelection = visibleNodes.value
      .filter(node => nodeIntersectsBounds(node, bounds))
      .map(node => node.id)
    setSelectedNodes(nextSelection)
    suppressCanvasClick.value = true
  }

  selectionState.value = null
  window.removeEventListener('pointermove', onSelectionMarqueeMove)
  window.removeEventListener('pointerup', endSelectionMarquee)
  window.removeEventListener('pointercancel', endSelectionMarquee)
}

function endDrag() {
  if (dragState.value && (Math.abs(dragState.value.deltaX) > 0.5 || Math.abs(dragState.value.deltaY) > 0.5)) {
    props.editorState.moveNodes(dragState.value.nodeIds, {
      deltaX: dragState.value.deltaX,
      deltaY: dragState.value.deltaY
    })
    treeClickState.value = { nodeId: null, timestamp: 0 }
    suppressNodeClick.value = true
  }
  dragState.value = null
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', endDrag)
}

function endTextBlockDrag() {
  if (textBlockDragState.value && (Math.abs(textBlockDragState.value.deltaX) > 0.5 || Math.abs(textBlockDragState.value.deltaY) > 0.5)) {
    props.editorState.moveMindNoteTextBlock(textBlockDragState.value.blockId, {
      deltaX: textBlockDragState.value.deltaX,
      deltaY: textBlockDragState.value.deltaY
    })
  }

  textBlockDragState.value = null
  window.removeEventListener('pointermove', onTextBlockPointerMove)
  window.removeEventListener('pointerup', endTextBlockDrag)
  window.removeEventListener('pointercancel', endTextBlockDrag)
}

function resolvePoint(event) {
  return resolveClientPoint(event.clientX, event.clientY)
}

function resolveClientPoint(clientX, clientY) {
  const svg = svgRef.value
  const rect = svg.getBoundingClientRect()
  const viewport = document.value.content.viewport
  return {
    x: (clientX - rect.left - viewport.x) / viewport.zoom,
    y: (clientY - rect.top - viewport.y) / viewport.zoom
  }
}

function getNodePath(node) {
  const { x, y, width: w, height: h, kind } = node
  const cx = x + w / 2
  const cy = y + h / 2

  switch (kind) {
    case 'decision':
      return `M ${cx} ${y} L ${x + w} ${cy} L ${cx} ${y + h} L ${x} ${cy} Z`
    case 'parallelogram':
      return `M ${x + w * 0.15} ${y} L ${x + w} ${y} L ${x + w * 0.85} ${y + h} L ${x} ${y + h} Z`
    case 'document':
      return `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h * 0.8} Q ${x + w * 0.75} ${y + h} ${cx} ${y + h * 0.8} T ${x} ${y + h * 0.8} L ${x} ${y} Z`
    case 'cylinder':
      return `M ${x} ${y + h * 0.1} A ${cx - x} ${h * 0.1} 0 0 1 ${x + w} ${y + h * 0.1} L ${x + w} ${y + h * 0.9} A ${cx - x} ${h * 0.1} 0 0 1 ${x} ${y + h * 0.9} Z M ${x} ${y + h * 0.1} A ${cx - x} ${h * 0.1} 0 0 0 ${x + w} ${y + h * 0.1}`
    case 'hexagon':
      return `M ${x + w * 0.15} ${y} L ${x + w * 0.85} ${y} L ${x + w} ${cy} L ${x + w * 0.85} ${y + h} L ${x + w * 0.15} ${y + h} L ${x} ${cy} Z`
    case 'card':
      return `M ${x + w * 0.16} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} L ${x} ${y + h * 0.2} Z`
    case 'delay':
      return `M ${x} ${y} L ${x + w * 0.72} ${y} Q ${x + w} ${cy} ${x + w * 0.72} ${y + h} L ${x} ${y + h} Z`
    case 'note':
      return `M ${x} ${y} L ${x + w * 0.8} ${y} L ${x + w} ${y + h * 0.22} L ${x + w} ${y + h} L ${x} ${y + h} Z M ${x + w * 0.8} ${y} L ${x + w * 0.8} ${y + h * 0.22} L ${x + w} ${y + h * 0.22}`
    case 'cloud':
      return `M ${x + w * 0.18} ${y + h * 0.74} C ${x + w * 0.02} ${y + h * 0.74}, ${x - 6} ${y + h * 0.44}, ${x + w * 0.16} ${y + h * 0.42} C ${x + w * 0.12} ${y + h * 0.12}, ${x + w * 0.48} ${y - 8}, ${x + w * 0.6} ${y + h * 0.2} C ${x + w * 0.84} ${y + h * 0.06}, ${x + w} ${y + h * 0.34}, ${x + w * 0.88} ${y + h * 0.58} C ${x + w} ${y + h * 0.82}, ${x + w * 0.74} ${y + h}, ${x + w * 0.5} ${y + h * 0.88} C ${x + w * 0.34} ${y + h}, ${x + w * 0.08} ${y + h * 0.94}, ${x + w * 0.18} ${y + h * 0.74} Z`
    case 'ellipse':
      return `M ${x} ${cy} A ${w / 2} ${h / 2} 0 0 1 ${x + w} ${cy} A ${w / 2} ${h / 2} 0 0 1 ${x} ${cy} Z`
    case 'terminator':
      return `M ${x + h / 2} ${y} L ${x + w - h / 2} ${y} A ${h / 2} ${h / 2} 0 0 1 ${x + w} ${cy} A ${h / 2} ${h / 2} 0 0 1 ${x + w - h / 2} ${y + h} L ${x + h / 2} ${y + h} A ${h / 2} ${h / 2} 0 0 1 ${x} ${cy} A ${h / 2} ${h / 2} 0 0 1 ${x + h / 2} ${y} Z`
    default:
      return `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`
  }
}

function resolvePaletteItemStyle(item) {
  const palette = resolveAccentPalette(item.accent || inferPaletteAccent(item.id))
  return {
    background: `linear-gradient(145deg, ${palette.fill}, #ffffff)`,
    borderColor: palette.stroke,
    boxShadow: `0 16px 34px ${palette.glow}`
  }
}

function resolveNodeShapeStyle(node) {
  const palette = resolveAccentPalette(node.style?.accent)
  const isActive = node.id === props.editorState.activeNodeId.value
  const isSelected = selectedNodeIdSet.value.has(node.id)
  const isHovered = node.id === hoveredNodeId.value
  const isSnapTarget = linkPreview.value?.targetId === node.id
  const isSnapSource = linkPreview.value?.sourceId === node.id
  const elevation = node.style?.elevation || 'soft'
  const blur = elevation === 'glow' ? 28 : 18
  const spread = elevation === 'glow' ? 14 : 8
  return {
    fill: isActive || isSelected || isSnapTarget ? palette.fillActive : palette.fill,
    stroke: isActive || isSelected || isSnapTarget ? palette.strokeActive : palette.stroke,
    strokeWidth: isActive ? 3.2 : (isSelected || isHovered || isSnapSource || isSnapTarget ? 2.6 : 2),
    filter: `drop-shadow(0 ${spread + (isHovered || isSelected ? 4 : 0)}px ${blur + (isActive ? 6 : 0)}px ${palette.glow})`
  }
}

function resolvePaletteAccentPalette(item) {
  return resolveAccentPalette(item.accent || inferPaletteAccent(item.id))
}

function getPaletteFlowchartPath(kind) {
  return getNodePath({
    x: 18,
    y: 14,
    width: 84,
    height: 44,
    kind
  })
}

function getPaletteTreePreview(itemId) {
  switch (itemId) {
    case 'mind-sibling':
      return {
        connectors: [
          { key: 'root-branch', x1: 28, y1: 36, x2: 58, y2: 36 },
          { key: 'upper-branch', x1: 58, y1: 36, x2: 92, y2: 22 },
          { key: 'lower-branch', x1: 58, y1: 36, x2: 92, y2: 50 }
        ],
        rects: [],
        noteLines: [],
        circles: [
          { key: 'root', cx: 24, cy: 36, r: 7 },
          { key: 'bridge', cx: 58, cy: 36, r: 5 },
          { key: 'upper', cx: 96, cy: 22, r: 5 },
          { key: 'lower', cx: 96, cy: 50, r: 5 }
        ]
      }
    case 'note-block':
      return {
        connectors: [
          { key: 'topic-note', x1: 44, y1: 26, x2: 68, y2: 38 }
        ],
        rects: [
          { key: 'topic', x: 18, y: 16, width: 28, height: 18, rx: 9 },
          { key: 'note', x: 70, y: 28, width: 32, height: 24, rx: 8, fill: '#ffffff' }
        ],
        noteLines: [
          { key: 'note-line-1', x1: 77, y1: 37, x2: 95, y2: 37 },
          { key: 'note-line-2', x1: 77, y1: 44, x2: 90, y2: 44 }
        ],
        circles: []
      }
    case 'mind-child':
    default:
      return {
        connectors: [
          { key: 'horizontal', x1: 28, y1: 24, x2: 60, y2: 24 },
          { key: 'vertical', x1: 60, y1: 24, x2: 60, y2: 50 },
          { key: 'child', x1: 60, y1: 50, x2: 92, y2: 50 }
        ],
        rects: [],
        noteLines: [],
        circles: [
          { key: 'root', cx: 24, cy: 24, r: 7 },
          { key: 'joint', cx: 60, cy: 24, r: 5 },
          { key: 'child', cx: 96, cy: 50, r: 6 }
        ]
      }
  }
}

function resolveNodeLabelStyle(node) {
  return {
    fill: resolveAccentPalette(node.style?.accent).text,
    fontWeight: selectedNodeIdSet.value.has(node.id) || node.id === props.editorState.activeNodeId.value ? 700 : 500
  }
}

function resolveEdgeStroke(edge) {
  const palette = resolveAccentPalette(resolveEdgeAccent(edge))
  if (edge.id === props.editorState.activeEdgeId.value) {
    return palette.strokeActive
  }
  if (edge.id === hoveredEdgeId.value) {
    return palette.stroke
  }
  return palette.edge
}

function resolveEdgeWidth(edge) {
  if (edge.id === props.editorState.activeEdgeId.value) {
    return 4.8
  }
  if (edge.id === hoveredEdgeId.value) {
    return 4.1
  }
  return 3.2
}

function resolveEdgeDasharray(edge) {
  if (edge.style?.stroke === 'dashed') {
    return '12 10'
  }
  if (edge.style?.stroke === 'dotted') {
    return '2 10'
  }
  return null
}

function resolveEdgeMarkerStart(edge) {
  return edge.style?.marker === 'double-arrow' ? 'url(#edge-arrow)' : null
}

function resolveEdgeMarkerEnd(edge) {
  return edge.style?.marker === 'none' ? null : 'url(#edge-arrow)'
}

function resolveEdgeLabelStyle(edge) {
  const palette = resolveAccentPalette(resolveEdgeAccent(edge))
  return {
    fill: 'rgba(255, 255, 255, 0.94)',
    stroke: edge.id === props.editorState.activeEdgeId.value ? palette.strokeActive : palette.stroke
  }
}

function resolveEdgeAccent(edge) {
  if (isTreeMode.value) {
    return 'teal'
  }

  const fromNode = activeNodes.value.find(node => node.id === edge.fromNodeId)
  return fromNode?.style?.accent || 'blue'
}

function inferPaletteAccent(itemId) {
  const accentMap = {
    process: 'teal',
    terminator: 'rose',
    decision: 'amber',
    ellipse: 'sky',
    parallelogram: 'violet',
    document: 'rose',
    cylinder: 'emerald',
    hexagon: 'amber',
    card: 'blue',
    delay: 'slate',
    note: 'violet',
    cloud: 'sky',
    'mind-sibling': 'amber',
    'mind-child': 'teal',
    'note-block': 'violet'
  }
  return accentMap[itemId] || 'teal'
}

function resolveAccentPalette(accent = 'teal') {
  return ACCENT_PALETTES[accent] || ACCENT_PALETTES.teal
}

function showEditorToast(message, tone = 'success', duration = 1600) {
  clearEditorToastTimer()
  editorToast.value = {
    visible: true,
    message,
    tone
  }

  editorToastTimer = window.setTimeout(() => {
    editorToast.value = {
      visible: false,
      message: '',
      tone
    }
    editorToastTimer = null
  }, duration)
}

function clearEditorToastTimer() {
  if (!editorToastTimer) {
    return
  }

  window.clearTimeout(editorToastTimer)
  editorToastTimer = null
}

function resolveInlineNodeEditorHeight(node) {
  return Math.min(Math.max(node.height - 16, 28), 44)
}

function isEdgePresetActive(preset) {
  if (!selectedEdgeStyle.value) {
    return false
  }

  return Object.entries(preset.style).every(([key, value]) => selectedEdgeStyle.value[key] === value)
}

function handleNodeClick(node, event) {
  if (suppressNodeClick.value) {
    suppressNodeClick.value = false
    return
  }

  closeEdgeLabelEditor()

  if (event?.shiftKey) {
    treeClickState.value = { nodeId: null, timestamp: 0 }
    toggleSelectedNode(node.id)
    return
  }

  const hadMultipleSelection = selectedNodeIds.value.length > 1
  selectedNodeIds.value = []

  if (hadMultipleSelection) {
    treeClickState.value = { nodeId: null, timestamp: 0 }
    props.editorState.selectNode(node.id)
    return
  }

  if (isTreeMode.value) {
    const now = Date.now()
    const repeatedTreeClick = treeClickState.value.nodeId === node.id && (now - treeClickState.value.timestamp) < 900
    treeClickState.value = { nodeId: node.id, timestamp: now }

    if (repeatedTreeClick) {
      props.editorState.toggleCollapse(node.id)
      return
    }
    props.editorState.selectNode(node.id)
    return
  }

  const sourceId = props.editorState.activeNodeId.value
  if (sourceId && sourceId !== node.id) {
    const sourceNode = document.value.content.nodes.find(item => item.id === sourceId)
    if (sourceNode) {
      props.editorState.addEdge(resolveConnection(sourceNode, node))
      props.editorState.selectNode(node.id)
      return
    }
  }

  props.editorState.selectNode(node.id)
}

function handleEdgeClick(edge) {
  treeClickState.value = { nodeId: null, timestamp: 0 }
  closeEdgeLabelEditor()
  props.editorState.selectEdge(edge.id)
}

function handleNodeHover(nodeId) {
  hoveredNodeId.value = nodeId
}

function handleEdgeHover(edgeId) {
  hoveredEdgeId.value = edgeId
}

function openTextOverlay(nodeId) {
  const node = document.value.content.nodes.find(item => item.id === nodeId)
  if (!node || layerMap.value.get(node.layerId)?.locked) {
    return
  }
  treeClickState.value = { nodeId: null, timestamp: 0 }
  closeEdgeLabelEditor()
  textOverlay.start(nodeId)
}

function submitTextOverlay() {
  textOverlay.submit((nodeId, nextText) => {
    props.editorState.updateNodeText(nodeId, nextText)
  })
}

function handleCanvasWheel(event) {
  props.editorState.zoomBy(event.deltaY > 0 ? -0.1 : 0.1)
}

function handleCanvasClick() {
  if (suppressCanvasClick.value) {
    suppressCanvasClick.value = false
    return
  }

  treeClickState.value = { nodeId: null, timestamp: 0 }
  closeEdgeLabelEditor()
  selectedNodeIds.value = []
  props.editorState.clearSelection()
}

function handleCanvasPointerUp(event) {
  if (!paletteDragItem.value || dragState.value || paletteDropHandled.value) {
    return
  }

  commitPaletteDrop(paletteDragItem.value, resolveClientPoint(event.clientX, event.clientY))
  paletteDragItem.value = null
  canvasDragInside.value = false
  lastCanvasDragPoint.value = null
}

function handleCanvasPointerUpOnSvg(event) {
  endDrag()
  handleCanvasPointerUp(event)
}

function primePaletteDrag(item, event) {
  if (event?.button !== 0) {
    return
  }

  paletteDragItem.value = item.id
  paletteDropHandled.value = false
  palettePointerState.value = {
    pointerId: event?.pointerId ?? null
  }
  window.addEventListener('pointermove', onPalettePointerMove)
  window.addEventListener('pointerup', onPalettePointerUp)
  window.addEventListener('pointercancel', onPalettePointerCancel)
}

function startPaletteDrag(item, event) {
  paletteDragItem.value = item.id
  paletteDropHandled.value = false
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData('text/plain', item.id)
}

function endPaletteDrag(event) {
  const dragEndPoint = resolvePaletteDragEndPoint(event)
  if (paletteDragItem.value && dragEndPoint && !paletteDropHandled.value) {
    commitPaletteDrop(paletteDragItem.value, dragEndPoint)
  }

  stopPalettePointerTracking()
  paletteDragItem.value = null
  paletteDropHandled.value = false
  canvasDragInside.value = false
  lastCanvasDragPoint.value = null
  event.currentTarget?.blur?.()
}

function onPalettePointerMove(event) {
  if (!palettePointerState.value || !isMatchingPalettePointer(event)) {
    return
  }

  const point = resolveCanvasPointFromClient(event.clientX, event.clientY)
  canvasDragInside.value = Boolean(point)
  if (point) {
    lastCanvasDragPoint.value = point
  }
}

function onPalettePointerUp(event) {
  if (!palettePointerState.value || !isMatchingPalettePointer(event)) {
    return
  }

  const point = resolveCanvasPointFromClient(event.clientX, event.clientY) || lastCanvasDragPoint.value
  let didCommit = false
  if (paletteDragItem.value && point && !paletteDropHandled.value) {
    closeEdgeLabelEditor()
    commitPaletteDrop(paletteDragItem.value, point)
    didCommit = true
  }

  stopPalettePointerTracking()
  paletteDragItem.value = null
  if (!didCommit) {
    paletteDropHandled.value = false
  }
  canvasDragInside.value = false
  lastCanvasDragPoint.value = null
}

function onPalettePointerCancel(event) {
  if (!palettePointerState.value || !isMatchingPalettePointer(event)) {
    return
  }

  stopPalettePointerTracking()
  paletteDragItem.value = null
  paletteDropHandled.value = false
  canvasDragInside.value = false
  lastCanvasDragPoint.value = null
}

function handleCanvasDragEnter(event) {
  if (!paletteDragItem.value) {
    return
  }

  canvasDragInside.value = true
  lastCanvasDragPoint.value = resolveClientPoint(event.clientX, event.clientY)
}

function handleCanvasDragOver(event) {
  if (!paletteDragItem.value) {
    return
  }

  canvasDragInside.value = true
  lastCanvasDragPoint.value = resolveClientPoint(event.clientX, event.clientY)
}

function handleCanvasDragLeave(event) {
  if (!paletteDragItem.value) {
    return
  }

  if (event.currentTarget?.contains?.(event.relatedTarget)) {
    return
  }

  canvasDragInside.value = false
}

function handleCanvasDrop(event) {
  const itemId = event.dataTransfer?.getData('text/plain') || paletteDragItem.value
  closeEdgeLabelEditor()
  if (!itemId || paletteDropHandled.value) {
    return
  }

  const point = resolveClientPoint(event.clientX, event.clientY)
  commitPaletteDrop(itemId, point)
  paletteDragItem.value = null
  canvasDragInside.value = false
  lastCanvasDragPoint.value = null
}

function commitPaletteDrop(itemId, point) {
  if (paletteDropHandled.value) {
    return
  }

  applyCanvasDrop(itemId, point)
  paletteDropHandled.value = true
}

function stopPalettePointerTracking() {
  palettePointerState.value = null
  window.removeEventListener('pointermove', onPalettePointerMove)
  window.removeEventListener('pointerup', onPalettePointerUp)
  window.removeEventListener('pointercancel', onPalettePointerCancel)
}

function isMatchingPalettePointer(event) {
  return palettePointerState.value?.pointerId == null || event.pointerId === palettePointerState.value.pointerId
}

function resolveFallbackDropPoint() {
  const activeNode = visibleNodes.value.find(node => node.id === props.editorState.activeNodeId.value) || visibleNodes.value[0]
  if (activeNode) {
    return {
      x: activeNode.x + activeNode.width / 2,
      y: activeNode.y + activeNode.height / 2
    }
  }

  const viewport = document.value.content.viewport
  return {
    x: (600 - viewport.x) / viewport.zoom,
    y: (360 - viewport.y) / viewport.zoom
  }
}

function resolveCanvasPointFromClient(clientX, clientY) {
  const canvasRect = canvasCardRef.value?.getBoundingClientRect?.()
  if (!canvasRect || !Number.isFinite(clientX) || !Number.isFinite(clientY)) {
    return null
  }

  const isInsideCanvas = clientX >= canvasRect.left && clientX <= canvasRect.right && clientY >= canvasRect.top && clientY <= canvasRect.bottom
  if (!isInsideCanvas) {
    return null
  }

  return resolveClientPoint(clientX, clientY)
}

function resolvePaletteDragEndPoint(event) {
  if (lastCanvasDragPoint.value) {
    return lastCanvasDragPoint.value
  }

  if (!canvasDragInside.value) {
    return null
  }

  const clientX = Number(event?.clientX)
  const clientY = Number(event?.clientY)
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
    return resolveFallbackDropPoint()
  }

  return resolveCanvasPointFromClient(clientX, clientY) || resolveFallbackDropPoint()
}

function applyCanvasDrop(itemId, point) {
  if (!itemId || !point) {
    return
  }

  if (document.value.mode === 'flowchart') {
    props.editorState.addNode(itemId, {
      x: Math.max(24, point.x - 80),
      y: Math.max(24, point.y - 32)
    })
    return
  }

  const dropTargetNode = resolveDropTargetNode(point)
  const targetNodeId = dropTargetNode?.id || props.editorState.activeNodeId.value || document.value.content.nodes[0]?.id || null

  if (itemId === 'mind-sibling') {
    props.editorState.addMindmapSiblingBranch(targetNodeId)
    return
  }
  if (itemId === 'mind-child') {
    props.editorState.addMindmapChildBranch(targetNodeId)
    return
  }
  if (itemId === 'note-block') {
    if ((document.value.mode === 'mindmap' || document.value.mode === 'mind-note') && targetNodeId) {
      props.editorState.addMindNoteTextBlock(targetNodeId)
    }
  }
}

function setSelectedNodes(nodeIds) {
  const uniqueNodeIds = [...new Set((nodeIds || []).filter(Boolean))]
  selectedNodeIds.value = uniqueNodeIds
  if (uniqueNodeIds.length) {
    props.editorState.selectNode(uniqueNodeIds[0])
    return
  }
  props.editorState.clearSelection()
}

function toggleSelectedNode(nodeId) {
  if (!nodeId) {
    return
  }

  if (selectedNodeIdSet.value.has(nodeId)) {
    setSelectedNodes(selectedNodeIds.value.filter(currentId => currentId !== nodeId))
    return
  }

  setSelectedNodes([...selectedNodeIds.value, nodeId])
}

function normalizeSelectionBounds(startPoint, endPoint) {
  return {
    x: Math.min(startPoint.x, endPoint.x),
    y: Math.min(startPoint.y, endPoint.y),
    width: Math.abs(endPoint.x - startPoint.x),
    height: Math.abs(endPoint.y - startPoint.y)
  }
}

function nodeIntersectsBounds(node, bounds) {
  return !(node.x + node.width < bounds.x || node.x > bounds.x + bounds.width || node.y + node.height < bounds.y || node.y > bounds.y + bounds.height)
}

function openEdgeLabelEditor(edge) {
  props.editorState.selectEdge(edge.id)
  edgeLabelEditor.value = {
    edgeId: edge.id,
    x: edge.labelPosition.x,
    y: edge.labelPosition.y,
    text: edge.label || ''
  }
}

function submitEdgeLabelEditor() {
  if (!edgeLabelEditor.value) {
    return
  }
  props.editorState.updateEdgeLabel(edgeLabelEditor.value.edgeId, edgeLabelEditor.value.text)
  closeEdgeLabelEditor()
}

function closeEdgeLabelEditor() {
  edgeLabelEditor.value = null
}

function showAnchorHints(node) {
  return document.value.mode === 'flowchart' && (
    node.id === props.editorState.activeNodeId.value ||
    node.id === hoveredNodeId.value ||
    linkPreview.value?.targetId === node.id
  )
}

function resolveNodeAnchors(node) {
  return [
    { key: `${node.id}-top`, x: node.x + node.width / 2, y: node.y },
    { key: `${node.id}-right`, x: node.x + node.width, y: node.y + node.height / 2 },
    { key: `${node.id}-bottom`, x: node.x + node.width / 2, y: node.y + node.height },
    { key: `${node.id}-left`, x: node.x, y: node.y + node.height / 2 }
  ]
}

function handleExport(format) {
  const normalizedFormat = format === 'jpg' ? 'jpeg' : format
  const exportTarget = document.value.mode === 'markdown'
    ? previewRef.value
    : document.value.content.textBlocks?.length
      ? canvasCardRef.value
      : svgRef.value
  props.editorState.exportDocument(normalizedFormat, exportTarget)
}

function textBlockStyle(block) {
  const viewport = document.value.content.viewport
  return {
    left: `${block.x * viewport.zoom + viewport.x}px`,
    top: `${block.y * viewport.zoom + viewport.y}px`
  }
}

function handleKeydown(event) {
  if (props.editorState.handleShortcut(event)) {
    return
  }

  if (isEditableTarget(event.target)) {
    return
  }

  if (event.code === 'Space') {
    event.preventDefault()
    spacePressed.value = true
    return
  }

  if (event.key === 'F2' && props.editorState.activeEdgeId.value) {
    event.preventDefault()
    const edge = visibleEdges.value.find(item => item.id === props.editorState.activeEdgeId.value)
    if (edge) {
      openEdgeLabelEditor(edge)
    }
    return
  }

  if (event.key === 'F2' && props.editorState.activeNodeId.value) {
    event.preventDefault()
    openTextOverlay(props.editorState.activeNodeId.value)
    return
  }

  if (!isTreeMode.value && event.key === 'Enter' && props.editorState.activeNodeId.value) {
    event.preventDefault()
    openTextOverlay(props.editorState.activeNodeId.value)
  }
}

function handleKeyup(event) {
  if (event.code === 'Space') {
    spacePressed.value = false
  }
}

function isEditableTarget(target) {
  return Boolean(
    target &&
    typeof target.closest === 'function' &&
    target.closest('input, textarea, select, [contenteditable="true"]')
  )
}

function resolveConnection(fromNode, toNode) {
  const deltaX = (toNode.x + toNode.width / 2) - (fromNode.x + fromNode.width / 2)
  const deltaY = (toNode.y + toNode.height / 2) - (fromNode.y + fromNode.height / 2)

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return {
      fromNodeId: fromNode.id,
      toNodeId: toNode.id,
      fromAnchor: deltaX >= 0 ? 'right' : 'left',
      toAnchor: deltaX >= 0 ? 'left' : 'right'
    }
  }

  return {
    fromNodeId: fromNode.id,
    toNodeId: toNode.id,
    fromAnchor: deltaY >= 0 ? 'bottom' : 'top',
    toAnchor: deltaY >= 0 ? 'top' : 'bottom'
  }
}

function resolveDropTargetNode(point) {
  if (!point || !visibleNodes.value.length) {
    return null
  }

  return visibleNodes.value.reduce((closest, node) => {
    if (!closest) {
      return node
    }

    const nodeDistance = squaredDistance(point, node)
    const closestDistance = squaredDistance(point, closest)
    return nodeDistance < closestDistance ? node : closest
  }, null)
}

function squaredDistance(point, node) {
  const centerX = node.x + node.width / 2
  const centerY = node.y + node.height / 2
  return ((point.x - centerX) ** 2) + ((point.y - centerY) ** 2)
}

function resolveEdgeLabelPosition(points) {
  if (!points.length) {
    return { x: 0, y: 0 }
  }
  const middleIndex = Math.floor(points.length / 2)
  const previousPoint = points[Math.max(middleIndex - 1, 0)]
  const middlePoint = points[middleIndex]
  return {
    x: (previousPoint.x + middlePoint.x) / 2,
    y: (previousPoint.y + middlePoint.y) / 2
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('keyup', handleKeyup)
})

onBeforeUnmount(() => {
  clearEditorToastTimer()
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('keyup', handleKeyup)
  stopPalettePointerTracking()
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', endDrag)
  window.removeEventListener('pointermove', onTextBlockPointerMove)
  window.removeEventListener('pointerup', endTextBlockDrag)
  window.removeEventListener('pointercancel', endTextBlockDrag)
  window.removeEventListener('pointermove', onCanvasPanMove)
  window.removeEventListener('pointerup', endCanvasPan)
  window.removeEventListener('pointermove', onSelectionMarqueeMove)
  window.removeEventListener('pointerup', endSelectionMarquee)
  window.removeEventListener('pointercancel', endSelectionMarquee)
})
</script>

<style scoped>
.editor-shell {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 24px 80px rgba(30, 41, 59, 0.12);
}

.editor-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.editor-toolbar {
  justify-content: space-between;
  align-items: flex-start;
}

.toolbar-group {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.toolbar-group.compact button,
.loader-bar button,
.mode-select,
.title-input,
.load-input {
  border-radius: 14px;
}

.title-input,
.load-input,
.mode-select {
  border: 1px solid rgba(148, 163, 184, 0.4);
  background: #fff;
  padding: 10px 14px;
  font-size: 0.95rem;
}

.title-input {
  min-width: min(360px, 70vw);
}

button {
  border: 0;
  padding: 10px 14px;
  border-radius: 14px;
  background: linear-gradient(135deg, #0f172a, #1d4ed8);
  color: #fff;
  cursor: pointer;
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.2);
  transition: transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease;
}

button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 16px 30px rgba(37, 99, 235, 0.24);
}

button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.save-button {
  min-width: 108px;
}

.selection-toolbar-shell {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 8px 0 2px;
  border-radius: 22px;
  border: 0;
  background: transparent;
}

.edge-style-toolbar {
  padding: 0;
  border-radius: 0;
  background: transparent;
  border: 0;
}

.node-style-toolbar {
  padding: 0;
  border-radius: 0;
  background: transparent;
  border: 0;
}

.edge-style-caption {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #475569;
}

.style-toggle {
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.94);
  color: #0f172a;
  box-shadow: none;
}

.style-toggle.active {
  background: linear-gradient(135deg, #0f766e, #1d4ed8);
  color: #fff;
}

.swatch-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.swatch-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.66);
}

.error-message {
  margin: 0;
}

.error-message {
  color: #b91c1c;
}

.canvas-card {
  position: relative;
  overflow: hidden;
  border-radius: 30px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  min-height: clamp(700px, 74vh, 960px);
  background:
    radial-gradient(circle at top left, rgba(59, 130, 246, 0.14), transparent 24%),
    radial-gradient(circle at bottom right, rgba(20, 184, 166, 0.12), transparent 28%),
    linear-gradient(180deg, #f8fafc, #eff6ff 52%, #eefbf7);
}

.canvas-hud {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 3;
  display: inline-flex;
  flex-wrap: wrap;
  gap: 8px;
}

.canvas-hud-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.84);
  border: 1px solid rgba(148, 163, 184, 0.16);
  color: #334155;
  font-size: 13px;
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08);
}

.canvas-hud-chip.metric {
  min-width: 44px;
  justify-content: center;
}

.canvas-hud-label {
  color: #64748b;
}

.canvas-hud-dot,
.canvas-hud-line {
  display: inline-block;
  flex: 0 0 auto;
}

.canvas-hud-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #1d4ed8;
}

.canvas-hud-line {
  width: 12px;
  height: 2px;
  border-radius: 999px;
  background: #0f766e;
}

.editor-toast {
  position: absolute;
  left: 50%;
  top: 20px;
  z-index: 4;
  min-width: 112px;
  padding: 12px 18px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.88);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  text-align: center;
  transform: translateX(-50%);
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.16);
  backdrop-filter: blur(10px);
}

.editor-toast.error {
  background: rgba(185, 28, 28, 0.92);
}

.canvas-error,
.inline-error {
  position: absolute;
  right: 16px;
  top: 16px;
  z-index: 3;
  max-width: min(360px, calc(100% - 32px));
  padding: 10px 14px;
  border-radius: 16px;
  background: rgba(254, 242, 242, 0.96);
  border: 1px solid rgba(248, 113, 113, 0.3);
  box-shadow: 0 12px 24px rgba(185, 28, 28, 0.08);
}

.inline-error {
  position: relative;
  top: auto;
  right: auto;
  margin: 0 0 6px;
}

.canvas-card.panning {
  cursor: grab;
}

.markdown-workspace {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr);
  gap: 18px;
}

.markdown-panel {
  min-height: 280px;
  padding: 20px;
  border-radius: 24px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.92));
  box-shadow: 0 18px 44px rgba(15, 23, 42, 0.08);
}

.markdown-label {
  display: block;
  font-weight: 700;
  color: #0f172a;
}

.markdown-pane-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}

.markdown-stats,
.markdown-note {
  color: #64748b;
  font-size: 12px;
}

.markdown-editor-pane {
  display: flex;
  flex-direction: column;
}

.markdown-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 14px;
}

.markdown-link-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 14px;
}

.markdown-link-input {
  flex: 1 1 260px;
  min-width: 220px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 14px;
  padding: 10px 14px;
  font-size: 0.92rem;
  color: #0f172a;
  background: rgba(255, 255, 255, 0.94);
}

.markdown-link-input:focus {
  outline: none;
  border-color: rgba(37, 99, 235, 0.34);
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
}

.markdown-editor-shell {
  flex: 1;
  min-height: 420px;
  border-radius: 22px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.9));
  overflow: hidden;
}

.markdown-editor-shell :deep(.markdown-wysiwyg-surface) {
  min-height: 420px;
  padding: 22px 24px;
  outline: none;
  color: #0f172a;
  font: 500 16px/1.8 'Georgia', 'Times New Roman', serif;
}

.markdown-editor-shell :deep(.markdown-wysiwyg-surface p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  color: #94a3b8;
  float: left;
  height: 0;
  pointer-events: none;
}

.markdown-editor-shell :deep(h1),
.markdown-editor-shell :deep(h2),
.markdown-editor-shell :deep(h3),
.markdown-preview-surface :deep(h1),
.markdown-preview-surface :deep(h2),
.markdown-preview-surface :deep(h3) {
  margin: 0 0 0.7em;
  font-family: 'Georgia', 'Times New Roman', serif;
  line-height: 1.2;
}

.markdown-editor-shell :deep(h1),
.markdown-preview-surface :deep(h1) {
  font-size: 2rem;
}

.markdown-editor-shell :deep(blockquote),
.markdown-preview-surface :deep(blockquote) {
  margin: 1em 0;
  padding: 0.8em 1em;
  border-left: 4px solid #2563eb;
  border-radius: 0 18px 18px 0;
  background: rgba(239, 246, 255, 0.88);
  color: #1e3a8a;
}

.markdown-editor-shell :deep(pre),
.markdown-preview-surface :deep(pre) {
  padding: 16px 18px;
  border-radius: 18px;
  background: #0f172a;
  color: #e2e8f0;
  overflow: auto;
}

.markdown-editor-shell :deep(ul),
.markdown-preview-surface :deep(ul) {
  padding-left: 1.2rem;
}

.markdown-editor-shell :deep(ol),
.markdown-preview-surface :deep(ol) {
  padding-left: 1.35rem;
}

.markdown-editor-shell :deep(ul[data-type="taskList"]),
.markdown-preview-surface :deep(ul) {
  margin: 1em 0;
}

.markdown-editor-shell :deep(li[data-type="taskItem"]),
.markdown-preview-surface :deep(li) {
  margin: 0.35em 0;
}

.markdown-editor-shell :deep(input[type="checkbox"]),
.markdown-preview-surface :deep(input[type="checkbox"]) {
  margin-right: 0.5rem;
  accent-color: #2563eb;
}

.markdown-editor-shell :deep(table),
.markdown-preview-surface :deep(table) {
  width: 100%;
  margin: 1.2em 0;
  border-collapse: collapse;
  border-radius: 18px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.16);
}

.markdown-editor-shell :deep(th),
.markdown-editor-shell :deep(td),
.markdown-preview-surface :deep(th),
.markdown-preview-surface :deep(td) {
  padding: 10px 12px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  text-align: left;
}

.markdown-editor-shell :deep(th),
.markdown-preview-surface :deep(th) {
  background: rgba(239, 246, 255, 0.88);
  color: #1e3a8a;
}

.markdown-sidecar {
  display: grid;
  grid-template-rows: minmax(0, 1fr) minmax(220px, auto);
  gap: 18px;
}

.markdown-source {
  width: 100%;
  min-height: 220px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 18px;
  padding: 16px 18px;
  resize: vertical;
  font: 15px/1.7 Consolas, Monaco, monospace;
  color: #0f172a;
  background: rgba(255, 255, 255, 0.86);
}

.preview-pane {
  overflow: auto;
}

.markdown-preview-surface {
  min-height: 360px;
  color: #0f172a;
  font: 500 16px/1.8 'Georgia', 'Times New Roman', serif;
}

.preview-pane :deep(h1),
.preview-pane :deep(h2),
.preview-pane :deep(h3),
.preview-pane :deep(p),
.preview-pane :deep(ul),
.preview-pane :deep(pre) {
  margin-top: 0;
}

.workspace-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 244px;
  gap: 16px;
}

.diagram-canvas {
  display: block;
  width: 100%;
  height: clamp(700px, 74vh, 960px);
}

.edge-path {
  transition: stroke 0.18s ease, filter 0.18s ease, stroke-dasharray 0.18s ease;
  filter: drop-shadow(0 8px 14px rgba(15, 118, 110, 0.12));
}

.edge-path.active {
  filter: drop-shadow(0 10px 18px rgba(37, 99, 235, 0.24));
}

.edge-path.hovered {
  filter: drop-shadow(0 10px 18px rgba(15, 118, 110, 0.2));
}

.edge-path.subtle {
  opacity: 0.92;
}

.link-preview-path {
  fill: none;
  stroke: rgba(37, 99, 235, 0.72);
  stroke-width: 2.6;
  stroke-dasharray: 10 8;
  stroke-linecap: round;
  stroke-linejoin: round;
  filter: drop-shadow(0 8px 18px rgba(37, 99, 235, 0.18));
}

.link-preview-anchor {
  fill: rgba(255, 255, 255, 0.95);
  stroke: #2563eb;
  stroke-width: 2;
}

.selection-marquee {
  fill: rgba(37, 99, 235, 0.12);
  stroke: rgba(37, 99, 235, 0.72);
  stroke-width: 1.6;
  stroke-dasharray: 10 6;
}

.edge-hit-area {
  stroke: transparent;
  stroke-width: 18;
  cursor: pointer;
}

.edge-label-bg {
  fill: rgba(255, 255, 255, 0.96);
  stroke: rgba(148, 163, 184, 0.35);
}

.edge-label-bg.active {
  stroke: rgba(37, 99, 235, 0.5);
}

.edge-label-text {
  font-size: 12px;
  fill: #0f172a;
  pointer-events: none;
}

.node-shape {
  stroke-width: 2;
  transition: fill 0.18s ease, stroke 0.18s ease, filter 0.18s ease, transform 0.18s ease;
}

.node-shape.hovered {
  transform: translateY(-1px);
}

.node-shape.active {
  transform: translateY(-1px);
}

.node-shape.selected {
  transform: translateY(-1px);
}

.node-shape.snap-target {
  stroke-dasharray: 6 6;
}

.node-shape.snap-source {
  stroke-linecap: round;
}

.node-shape.topic {
}

.node-label {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.01em;
  user-select: none;
  cursor: text;
}

.node-anchor-dot {
  fill: rgba(255, 255, 255, 0.96);
  stroke: #2563eb;
  stroke-width: 2;
  filter: drop-shadow(0 6px 10px rgba(37, 99, 235, 0.18));
}

.inline-node-editor,
.inline-edge-editor {
  overflow: visible;
  pointer-events: auto;
}

.inline-node-editor-shell,
.inline-edge-editor-shell {
  width: 100%;
  height: 100%;
}

.inline-node-input,
.inline-edge-input {
  width: 100%;
  height: 100%;
  border: 1px solid rgba(37, 99, 235, 0.42);
  border-radius: 14px;
  padding: 0 12px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 10px 28px rgba(37, 99, 235, 0.16);
  color: #0f172a;
  font: 600 14px/1.2 'Segoe UI', 'PingFang SC', sans-serif;
  text-align: center;
  outline: none;
}

.inline-node-input:focus,
.inline-edge-input:focus {
  border-color: #2563eb;
  box-shadow: 0 14px 30px rgba(37, 99, 235, 0.22);
}

.palette-panel {
  padding: 12px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(148, 163, 184, 0.2);
}

.layer-header h3 {
  margin: 0;
}

.palette-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 10px;
}

.palette-item {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 82px;
  padding: 8px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 18px;
  color: #0f172a;
  cursor: grab;
  text-align: center;
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.07);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.palette-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 34px rgba(15, 23, 42, 0.12);
}

.palette-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 48px;
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.9), rgba(248, 250, 252, 0.74));
  border: 1px solid rgba(255, 255, 255, 0.72);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.palette-preview-svg {
  width: 100%;
  height: 48px;
}

.palette-preview-connector {
  fill: none;
  stroke-width: 3;
  stroke-linecap: round;
}

.palette-item-copy {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 8px);
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 112px;
  max-width: 170px;
  padding: 8px 10px;
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.92);
  color: #fff;
  box-shadow: 0 16px 28px rgba(15, 23, 42, 0.18);
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, 6px);
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.palette-item:hover .palette-item-copy,
.palette-item:focus-visible .palette-item-copy {
  opacity: 1;
  transform: translate(-50%, 0);
}

.palette-item-copy strong,
.palette-item-copy span,
.palette-empty {
  color: inherit;
  font-size: 13px;
}

.palette-item-copy strong {
  font-size: 12px;
}

.palette-item-copy span {
  font-size: 11px;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.8);
}

.palette-empty {
  margin-top: 14px;
}

.mind-note-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.mind-note-block {
  position: absolute;
  width: 220px;
  padding: 12px;
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.12);
  pointer-events: auto;
}

.mind-note-block-handle {
  margin: -2px -2px 10px;
  padding: 6px 10px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.14), rgba(59, 130, 246, 0.08));
  color: #0369a1;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  cursor: grab;
  user-select: none;
  touch-action: none;
}

.mind-note-block-handle:active {
  cursor: grabbing;
}

.mind-note-block.active {
  border-color: rgba(14, 165, 233, 0.6);
}

.mind-note-input {
  width: 100%;
  min-height: 72px;
  border: 0;
  resize: vertical;
  background: transparent;
  font: 14px/1.6 Consolas, Monaco, monospace;
  color: #0f172a;
}

.mind-note-preview {
  margin-top: 10px;
  color: #334155;
}

.mind-note-preview :deep(a) {
  color: #0284c7;
}

@media (max-width: 900px) {
  .editor-shell {
    padding: 16px;
  }

  .editor-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .palette-list {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .title-input {
    min-width: 100%;
  }

  .workspace-grid,
  .markdown-workspace {
    grid-template-columns: 1fr;
  }

  .palette-panel {
    order: -1;
  }
}

.canvas-toast-enter-active,
.canvas-toast-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.canvas-toast-enter-from,
.canvas-toast-leave-to {
  opacity: 0;
  transform: translate(-50%, -10px);
}
</style>
