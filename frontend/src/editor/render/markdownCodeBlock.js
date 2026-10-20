import { mergeAttributes } from '@tiptap/core'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { Plugin } from '@tiptap/pm/state'
import { common, createLowlight } from 'lowlight'

export const markdownLowlight = createLowlight(common)
markdownLowlight.registerAlias({ plaintext: ['text'] })

export const CODE_BLOCK_DEFAULTS = Object.freeze({
  language: 'text',
  backgroundColor: '#0f172a',
  textColor: '#e2e8f0',
  borderColor: '#334155',
  borderWidth: 0,
  borderRadius: 18,
  padding: 16,
  wrap: false,
  blockWidth: 0,
  blockHeight: 0
})

export const CODE_BLOCK_LANGUAGES = [
  'text',
  'javascript',
  'js',
  'typescript',
  'ts',
  'python',
  'py',
  'java',
  'c',
  'cpp',
  'csharp',
  'go',
  'rust',
  'php',
  'ruby',
  'sql',
  'json',
  'yaml',
  'xml',
  'html',
  'css',
  'bash',
  'shell',
  'markdown'
]

const META_KEYS = {
  bg: 'backgroundColor',
  fg: 'textColor',
  border: 'borderColor',
  bw: 'borderWidth',
  radius: 'borderRadius',
  pad: 'padding',
  wrap: 'wrap',
  w: 'blockWidth',
  h: 'blockHeight'
}

export function normalizeCodeBlockAttrs(attributes = {}) {
  return {
    language: normalizeLanguage(attributes.language),
    backgroundColor: normalizeColor(attributes.backgroundColor, CODE_BLOCK_DEFAULTS.backgroundColor),
    textColor: normalizeColor(attributes.textColor, CODE_BLOCK_DEFAULTS.textColor),
    borderColor: normalizeColor(attributes.borderColor, CODE_BLOCK_DEFAULTS.borderColor),
    borderWidth: clampNumber(attributes.borderWidth, 0, 8, CODE_BLOCK_DEFAULTS.borderWidth),
    borderRadius: clampNumber(attributes.borderRadius, 0, 32, CODE_BLOCK_DEFAULTS.borderRadius),
    padding: clampNumber(attributes.padding, 0, 40, CODE_BLOCK_DEFAULTS.padding),
    wrap: normalizeBoolean(attributes.wrap, CODE_BLOCK_DEFAULTS.wrap),
    blockWidth: clampNumber(attributes.blockWidth, 0, 2400, CODE_BLOCK_DEFAULTS.blockWidth),
    blockHeight: clampNumber(attributes.blockHeight, 0, 1200, CODE_BLOCK_DEFAULTS.blockHeight)
  }
}

export function parseCodeFenceInfo(info = '') {
  const parts = String(info || '').trim().split(/\s+/).filter(Boolean)
  const attrs = {
    ...CODE_BLOCK_DEFAULTS,
    language: normalizeLanguage(parts.shift() || '')
  }

  parts.forEach(part => {
    const separator = part.indexOf('=')
    if (separator <= 0) {
      return
    }
    const key = part.slice(0, separator)
    const value = part.slice(separator + 1)
    const attributeName = META_KEYS[key]
    if (!attributeName) {
      return
    }
    attrs[attributeName] = value
  })

  return normalizeCodeBlockAttrs(attrs)
}

export function buildCodeFenceInfo(attributes = {}) {
  const attrs = normalizeCodeBlockAttrs(attributes)
  const parts = []
  if (attrs.language !== CODE_BLOCK_DEFAULTS.language) {
    parts.push(attrs.language)
  }

  const metadata = []
  if (attrs.backgroundColor !== CODE_BLOCK_DEFAULTS.backgroundColor) {
    metadata.push(`bg=${attrs.backgroundColor}`)
  }
  if (attrs.textColor !== CODE_BLOCK_DEFAULTS.textColor) {
    metadata.push(`fg=${attrs.textColor}`)
  }
  if (attrs.borderColor !== CODE_BLOCK_DEFAULTS.borderColor) {
    metadata.push(`border=${attrs.borderColor}`)
  }
  if (attrs.borderWidth !== CODE_BLOCK_DEFAULTS.borderWidth) {
    metadata.push(`bw=${attrs.borderWidth}`)
  }
  if (attrs.borderRadius !== CODE_BLOCK_DEFAULTS.borderRadius) {
    metadata.push(`radius=${attrs.borderRadius}`)
  }
  if (attrs.padding !== CODE_BLOCK_DEFAULTS.padding) {
    metadata.push(`pad=${attrs.padding}`)
  }
  if (attrs.wrap !== CODE_BLOCK_DEFAULTS.wrap) {
    metadata.push(`wrap=${attrs.wrap ? 1 : 0}`)
  }
  if (attrs.blockWidth !== CODE_BLOCK_DEFAULTS.blockWidth) {
    metadata.push(`w=${attrs.blockWidth}`)
  }
  if (attrs.blockHeight !== CODE_BLOCK_DEFAULTS.blockHeight) {
    metadata.push(`h=${attrs.blockHeight}`)
  }

  if (metadata.length && !parts.length) {
    parts.push(CODE_BLOCK_DEFAULTS.language)
  }
  return [...parts, ...metadata].join(' ')
}

export function codeBlockInlineStyle(attributes = {}) {
  const attrs = normalizeCodeBlockAttrs(attributes)
  return [
    `background:${attrs.backgroundColor}`,
    `color:${attrs.textColor}`,
    `border:${attrs.borderWidth}px solid ${attrs.borderColor}`,
    `border-radius:${attrs.borderRadius}px`,
    `padding:${attrs.padding + 14}px 18px ${attrs.padding}px`,
    `white-space:${attrs.wrap ? 'pre-wrap' : 'pre'}`,
    attrs.wrap ? 'overflow-wrap:anywhere' : '',
    attrs.blockWidth > 0 ? `width:${attrs.blockWidth}px` : '',
    attrs.blockWidth > 0 ? 'max-width:100%' : '',
    attrs.blockHeight > 0 ? `height:${attrs.blockHeight}px` : '',
    attrs.blockHeight > 0 ? 'overflow:auto' : ''
  ].filter(Boolean).join(';')
}

export function readCodeBlockAttributes(element) {
  if (!element?.getAttribute) {
    return { ...CODE_BLOCK_DEFAULTS }
  }
  const code = element.querySelector?.('code')
  const languageClass = [...(code?.classList || [])].find(className => className.startsWith('language-'))
  return normalizeCodeBlockAttrs({
    language: languageClass ? languageClass.replace('language-', '') : element.getAttribute('data-language'),
    backgroundColor: element.getAttribute('data-md-bg'),
    textColor: element.getAttribute('data-md-fg'),
    borderColor: element.getAttribute('data-md-border'),
    borderWidth: element.getAttribute('data-md-bw'),
    borderRadius: element.getAttribute('data-md-radius'),
    padding: element.getAttribute('data-md-pad'),
    wrap: element.getAttribute('data-md-wrap'),
    blockWidth: element.getAttribute('data-md-width'),
    blockHeight: element.getAttribute('data-md-height')
  })
}

export const StyledCodeBlock = CodeBlockLowlight.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: createDataAttribute('data-md-bg', 'backgroundColor'),
      textColor: createDataAttribute('data-md-fg', 'textColor'),
      borderColor: createDataAttribute('data-md-border', 'borderColor'),
      borderWidth: createDataAttribute('data-md-bw', 'borderWidth'),
      borderRadius: createDataAttribute('data-md-radius', 'borderRadius'),
      padding: createDataAttribute('data-md-pad', 'padding'),
      wrap: createDataAttribute('data-md-wrap', 'wrap'),
      blockWidth: createDataAttribute('data-md-width', 'blockWidth'),
      blockHeight: createDataAttribute('data-md-height', 'blockHeight')
    }
  },

  addProseMirrorPlugins() {
    return [
      ...(this.parent?.() || []),
      new Plugin({
      props: {
        handleDOMEvents: {
          pointerdown: (view, event) => {
            if (event.button !== 0) {
              return false
            }
            const target = event.target instanceof Element ? event.target : null
            const wrapper = target?.closest?.('.md-code-block-node')
            if (!wrapper) {
              return false
            }
            const resizeHandle = target.closest('.md-code-block-resize')
            if (!resizeHandle && !event.ctrlKey) {
              return false
            }
            const storedPosition = Number(wrapper.dataset.codeBlockPos)
            const position = Number.isInteger(storedPosition) &&
              view.state.doc.nodeAt(storedPosition)?.type.name === 'codeBlock'
              ? storedPosition
              : findCodeBlockPosition(view, event.clientX, event.clientY)
            if (position === null) {
              return false
            }
            event.preventDefault()
            if (resizeHandle) {
              const axis = resizeHandle.classList.contains('md-code-block-resize-width')
                ? 'width'
                : (resizeHandle.classList.contains('md-code-block-resize-height') ? 'height' : 'both')
              startCodeBlockResize(view, event, position, axis)
            } else {
              startCodeBlockDrag(view, event, position)
            }
            return true
          }
        }
      }
      })
    ]
  },

  addNodeView() {
    return ({ node, getPos }) => createCodeBlockNodeView(
      node,
      this.options.languageClassPrefix || 'language-',
      getPos
    )
  },

  renderHTML({ node, HTMLAttributes }) {
    const attrs = normalizeCodeBlockAttrs(node.attrs)
    const existingStyle = String(HTMLAttributes.style || '').replace(/;?$/, ';')
    return [
      'pre',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: ['md-code-block', HTMLAttributes.class].filter(Boolean).join(' '),
        style: `${existingStyle}${codeBlockInlineStyle(attrs)}`,
        'data-language': attrs.language,
        'data-md-bg': attrs.backgroundColor,
        'data-md-fg': attrs.textColor,
        'data-md-border': attrs.borderColor,
        'data-md-bw': String(attrs.borderWidth),
        'data-md-radius': String(attrs.borderRadius),
        'data-md-pad': String(attrs.padding),
        'data-md-wrap': attrs.wrap ? 'true' : 'false',
        'data-md-width': String(attrs.blockWidth),
        'data-md-height': String(attrs.blockHeight)
      }),
      ['code', {
        class: attrs.language ? `${this.options.languageClassPrefix || 'language-'}${attrs.language}` : null
      }, 0]
    ]
  }
})

function createCodeBlockNodeView(initialNode, languageClassPrefix, getPos) {
  const wrapper = document.createElement('div')
  wrapper.className = 'md-code-block-node'
  const pre = document.createElement('pre')
  pre.className = 'md-code-block'
  pre.spellcheck = false
  const code = document.createElement('code')
  pre.appendChild(code)
  wrapper.appendChild(pre)

  const widthHandle = createResizeHandle('md-code-block-resize-width', 'col-resize')
  const heightHandle = createResizeHandle('md-code-block-resize-height', 'row-resize')
  const cornerHandle = createResizeHandle('md-code-block-resize-corner', 'nwse-resize')
  wrapper.append(widthHandle, heightHandle, cornerHandle)

  let currentNode = initialNode

  function refresh(nextNode) {
    currentNode = nextNode
    const position = typeof getPos === 'function' ? getPos() : null
    if (Number.isInteger(position)) {
      wrapper.dataset.codeBlockPos = String(position)
    }
    const attrs = normalizeCodeBlockAttrs(nextNode.attrs)
    pre.className = 'md-code-block'
    pre.setAttribute('data-language', attrs.language)
    pre.setAttribute('data-md-bg', attrs.backgroundColor)
    pre.setAttribute('data-md-fg', attrs.textColor)
    pre.setAttribute('data-md-border', attrs.borderColor)
    pre.setAttribute('data-md-bw', String(attrs.borderWidth))
    pre.setAttribute('data-md-radius', String(attrs.borderRadius))
    pre.setAttribute('data-md-pad', String(attrs.padding))
    pre.setAttribute('data-md-wrap', attrs.wrap ? 'true' : 'false')
    pre.setAttribute('data-md-width', String(attrs.blockWidth))
    pre.setAttribute('data-md-height', String(attrs.blockHeight))
    pre.setAttribute('style', codeBlockInlineStyle(attrs))
    wrapper.style.width = attrs.blockWidth > 0 ? `${attrs.blockWidth}px` : '100%'
    wrapper.style.maxWidth = '100%'
    code.className = attrs.language ? `${languageClassPrefix}${attrs.language}` : ''
  }

  refresh(initialNode)

  return {
    dom: wrapper,
    contentDOM: code,
    update(nextNode) {
      refresh(nextNode)
      return true
    },
    stopEvent(event) {
      return Boolean(event.target.closest?.('.md-code-block-resize'))
    }
  }
}

function findCodeBlockPosition(view, clientX, clientY) {
  const coords = view.posAtCoords({ left: clientX, top: clientY })
  if (!coords) {
    return null
  }
  const $position = view.state.doc.resolve(coords.pos)
  for (let depth = $position.depth; depth > 0; depth -= 1) {
    if ($position.node(depth).type.name === 'codeBlock') {
      return $position.before(depth)
    }
  }
  return null
}

function startCodeBlockDrag(view, event, from) {
  const startX = event.clientX
  const startY = event.clientY
  let moved = false
  let dropTarget = null
  const wrapper = event.target.closest('.md-code-block-node')
  wrapper?.classList.add('is-dragging')
  view.dom.classList.add('md-code-reorder-active')
  const positionRoot = view.dom.closest('.markdown-editor-shell') || view.dom.parentElement
  const placeholder = document.createElement('div')
  placeholder.className = 'md-code-drop-placeholder'
  placeholder.dataset.testid = 'markdown-code-drop-placeholder'
  placeholder.setAttribute('aria-hidden', 'true')
  positionRoot?.appendChild(placeholder)

  const clearTarget = () => {
    view.dom.querySelectorAll('.drop-before, .drop-after, .md-code-drop-before, .md-code-drop-after, .md-code-drop-target').forEach(node => {
      node.classList.remove('drop-before', 'drop-after', 'md-code-drop-before', 'md-code-drop-after', 'md-code-drop-target')
    })
    placeholder.classList.remove('visible')
  }

  const move = moveEvent => {
    if (!moved && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 4) {
      return
    }
    moved = true
    clearTarget()
    const element = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)
    const source = element?.closest?.('.md-code-block-node')
    const blockTarget = source || element?.closest?.('p, h1, h2, h3, h4, h5, h6, blockquote, ul, ol, pre, table')
    if (!blockTarget || blockTarget === wrapper) {
      dropTarget = null
      return
    }
    const rect = blockTarget.getBoundingClientRect()
    const after = moveEvent.clientY > rect.top + rect.height / 2
    blockTarget.classList.add('md-code-drop-target')
    blockTarget.classList.add(after ? 'md-code-drop-after' : 'md-code-drop-before')
    const rootRect = positionRoot?.getBoundingClientRect() || view.dom.getBoundingClientRect()
    placeholder.style.left = `${Math.max(0, rect.left - rootRect.left)}px`
    placeholder.style.top = `${Math.round((after ? rect.bottom : rect.top) - rootRect.top)}px`
    placeholder.style.width = `${Math.max(24, Math.min(rect.width, view.dom.clientWidth))}px`
    placeholder.classList.add('visible')
    dropTarget = {
      after,
      x: moveEvent.clientX,
      y: moveEvent.clientY
    }
  }

  const finish = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', finish)
    window.removeEventListener('pointercancel', finish)
    wrapper?.classList.remove('is-dragging')
    view.dom.classList.remove('md-code-reorder-active')
    clearTarget()
    placeholder.remove()
    if (!moved || !dropTarget) {
      return
    }

    const { state } = view
    const movingNode = state.doc.nodeAt(from)
    if (!movingNode) {
      return
    }
    const targetCoords = view.posAtCoords({ left: dropTarget.x, top: dropTarget.y })
    if (!targetCoords || targetCoords.pos === from) {
      return
    }
    const $target = state.doc.resolve(targetCoords.pos)
    let targetDepth = $target.depth
    while (targetDepth > 1) {
      targetDepth -= 1
    }
    const targetNode = $target.node(targetDepth)
    if (!targetNode?.isBlock) {
      return
    }
    const targetBefore = $target.before(targetDepth)
    let insertPos = dropTarget.after ? targetBefore + targetNode.nodeSize : targetBefore
    if (from < insertPos) {
      insertPos -= movingNode.nodeSize
    }
    if (insertPos === from) {
      return
    }
    const transaction = state.tr.delete(from, from + movingNode.nodeSize)
    transaction.insert(insertPos, movingNode)
    view.dispatch(transaction.scrollIntoView())
    view.focus()
  }

  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', finish)
  window.addEventListener('pointercancel', finish)
}

function startCodeBlockResize(view, event, position, axis) {
  const pre = event.target.closest('.md-code-block-node')?.querySelector('pre')
  if (!pre) {
    return
  }
  const startX = event.clientX
  const startY = event.clientY
  const startRect = pre.getBoundingClientRect()
  const startWidth = startRect.width
  const startHeight = startRect.height
  const maxWidth = Math.max(260, view.dom.clientWidth)

  const move = moveEvent => {
    const state = view.state
    const nodeAt = state.doc.nodeAt(position)
    if (!nodeAt) {
      return
    }
    const current = normalizeCodeBlockAttrs(nodeAt.attrs)
    const nextWidth = axis === 'height'
      ? current.blockWidth
      : Math.max(260, Math.min(maxWidth, Math.round(startWidth + moveEvent.clientX - startX)))
    const nextHeight = axis === 'width'
      ? current.blockHeight
      : Math.max(80, Math.min(1200, Math.round(startHeight + moveEvent.clientY - startY)))
    view.dispatch(state.tr.setNodeMarkup(position, undefined, {
      ...nodeAt.attrs,
      blockWidth: nextWidth,
      blockHeight: nextHeight
    }))
  }

  const finish = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', finish)
    window.removeEventListener('pointercancel', finish)
    view.focus()
  }

  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', finish)
  window.addEventListener('pointercancel', finish)
}

function createResizeHandle(className, cursor) {
  const handle = document.createElement('span')
  handle.className = `md-code-block-resize ${className}`
  handle.style.cursor = cursor
  handle.title = document.documentElement.lang === 'en' ? 'Drag to resize' : '拖动调整大小'
  handle.setAttribute('aria-hidden', 'true')
  return handle
}

function createDataAttribute(dataName, attributeName) {
  return {
    default: CODE_BLOCK_DEFAULTS[attributeName],
    parseHTML: element => {
      const raw = element.getAttribute(dataName)
      return raw === null ? CODE_BLOCK_DEFAULTS[attributeName] : raw
    },
    renderHTML: () => ({})
  }
}

function normalizeLanguage(value) {
  const language = String(value || '').trim().toLowerCase()
  if (!language) {
    return CODE_BLOCK_DEFAULTS.language
  }
  return /^[a-z0-9_+#.-]{1,32}$/.test(language) ? language : CODE_BLOCK_DEFAULTS.language
}

function normalizeColor(value, fallback) {
  const color = String(value || '').trim()
  if (color === 'transparent') {
    return color
  }
  return /^#[0-9a-f]{3,8}$/i.test(color) ? color : fallback
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.round(number))) : fallback
}

function normalizeBoolean(value, fallback) {
  if (typeof value === 'boolean') {
    return value
  }
  const normalized = String(value ?? '').trim().toLowerCase()
  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true
  }
  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false
  }
  return fallback
}
