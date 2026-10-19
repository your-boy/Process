import { mergeAttributes } from '@tiptap/core'
import { CodeBlock } from '@tiptap/extension-code-block'

export const CODE_BLOCK_DEFAULTS = Object.freeze({
  language: 'text',
  backgroundColor: '#0f172a',
  textColor: '#e2e8f0',
  borderColor: '#334155',
  borderWidth: 0,
  borderRadius: 18,
  padding: 16,
  wrap: false
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
  wrap: 'wrap'
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
    wrap: normalizeBoolean(attributes.wrap, CODE_BLOCK_DEFAULTS.wrap)
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
    attrs.wrap ? 'overflow-wrap:anywhere' : ''
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
    wrap: element.getAttribute('data-md-wrap')
  })
}

export const StyledCodeBlock = CodeBlock.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: createDataAttribute('data-md-bg', 'backgroundColor'),
      textColor: createDataAttribute('data-md-fg', 'textColor'),
      borderColor: createDataAttribute('data-md-border', 'borderColor'),
      borderWidth: createDataAttribute('data-md-bw', 'borderWidth'),
      borderRadius: createDataAttribute('data-md-radius', 'borderRadius'),
      padding: createDataAttribute('data-md-pad', 'padding'),
      wrap: createDataAttribute('data-md-wrap', 'wrap')
    }
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
        'data-md-wrap': attrs.wrap ? 'true' : 'false'
      }),
      ['code', {
        class: attrs.language ? `${this.options.languageClassPrefix || 'language-'}${attrs.language}` : null
      }, 0]
    ]
  }
})

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
