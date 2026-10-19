// 思维导图节点的附加信息（图标标记 / 优先级 / 进度 / 备注 / 标签）与画布外观（布局 / 主题）
// 这里只放纯数据与归一化函数，展示文案放在 i18n 里。

export const MARKER_LIBRARY = [
  { id: 'star', emoji: '⭐', labelKey: 'mindmap.markerStar' },
  { id: 'flag', emoji: '🚩', labelKey: 'mindmap.markerFlag' },
  { id: 'alert', emoji: '❗', labelKey: 'mindmap.markerAlert' },
  { id: 'check', emoji: '✅', labelKey: 'mindmap.markerCheck' },
  { id: 'cross', emoji: '❌', labelKey: 'mindmap.markerCross' },
  { id: 'question', emoji: '❓', labelKey: 'mindmap.markerQuestion' },
  { id: 'idea', emoji: '💡', labelKey: 'mindmap.markerIdea' },
  { id: 'heart', emoji: '❤️', labelKey: 'mindmap.markerHeart' },
  { id: 'pin', emoji: '📌', labelKey: 'mindmap.markerPin' },
  { id: 'fire', emoji: '🔥', labelKey: 'mindmap.markerFire' },
  { id: 'target', emoji: '🎯', labelKey: 'mindmap.markerTarget' },
  { id: 'clock', emoji: '⏰', labelKey: 'mindmap.markerClock' },
  { id: 'warning', emoji: '⚠️', labelKey: 'mindmap.markerWarning' },
  { id: 'trophy', emoji: '🏆', labelKey: 'mindmap.markerTrophy' },
  { id: 'thumb', emoji: '👍', labelKey: 'mindmap.markerThumb' },
  { id: 'money', emoji: '💰', labelKey: 'mindmap.markerMoney' }
]

export const MARKER_IDS = MARKER_LIBRARY.map(marker => marker.id)

const MARKER_MAP = new Map(MARKER_LIBRARY.map(marker => [marker.id, marker]))

export const MAX_MARKERS_PER_NODE = 6
export const MAX_LABELS_PER_NODE = 8
export const MAX_LABEL_LENGTH = 24
export const MAX_NOTE_LENGTH = 2000

export const PRIORITY_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9]

// 优先级 1 最高（红），9 最低（灰）
export const PRIORITY_COLORS = {
  1: '#dc2626',
  2: '#ea580c',
  3: '#d97706',
  4: '#ca8a04',
  5: '#65a30d',
  6: '#16a34a',
  7: '#0d9488',
  8: '#0284c7',
  9: '#6b7280'
}

export const MINDMAP_LAYOUTS = [
  { id: 'right', labelKey: 'mindmap.layoutRight' },
  { id: 'left', labelKey: 'mindmap.layoutLeft' },
  { id: 'down', labelKey: 'mindmap.layoutDown' },
  { id: 'balanced', labelKey: 'mindmap.layoutBalanced' },
  { id: 'tree', labelKey: 'mindmap.layoutTree' },
  { id: 'timeline', labelKey: 'mindmap.layoutTimeline' },
  { id: 'fishbone', labelKey: 'mindmap.layoutFishbone' }
]

// 样式预设：按层级套用一组形状 / 字号 / 字重 / 强调方式
export const MINDMAP_STYLE_PRESETS = [
  {
    id: 'classic',
    labelKey: 'mindmap.styleClassic',
    root: { shape: 'capsule', fontSize: null, bold: false, textColor: '', elevation: 'glow' },
    branch: { shape: 'capsule', fontSize: null, bold: false, textColor: '', elevation: 'soft' },
    deep: { shape: 'capsule', fontSize: 14, bold: false, textColor: '', elevation: 'soft' }
  },
  {
    id: 'minimal',
    labelKey: 'mindmap.styleMinimal',
    root: { shape: 'rect', fontSize: 18, bold: true, textColor: '', elevation: 'soft' },
    branch: { shape: 'rect', fontSize: 14, bold: false, textColor: '', elevation: 'soft' },
    deep: { shape: 'underline', fontSize: 13, bold: false, textColor: '', elevation: 'soft' }
  },
  {
    id: 'bold',
    labelKey: 'mindmap.styleBold',
    root: { shape: 'rounded', fontSize: 20, bold: true, textColor: '#18181b', elevation: 'glow' },
    branch: { shape: 'rounded', fontSize: 16, bold: true, textColor: '#18181b', elevation: 'soft' },
    deep: { shape: 'rounded', fontSize: 14, bold: false, textColor: '', elevation: 'soft' }
  },
  {
    id: 'compact',
    labelKey: 'mindmap.styleCompact',
    root: { shape: 'capsule', fontSize: 15, bold: true, textColor: '', elevation: 'soft' },
    branch: { shape: 'capsule', fontSize: 12, bold: false, textColor: '', elevation: 'soft' },
    deep: { shape: 'capsule', fontSize: 12, bold: false, textColor: '', elevation: 'soft' }
  },
  {
    id: 'outline',
    labelKey: 'mindmap.styleOutline',
    root: { shape: 'rect', fontSize: 18, bold: true, textColor: '', elevation: 'soft' },
    branch: { shape: 'underline', fontSize: 15, bold: false, textColor: '', elevation: 'soft' },
    deep: { shape: 'underline', fontSize: 13, bold: false, textColor: '', elevation: 'soft' }
  },
  {
    id: 'card',
    labelKey: 'mindmap.styleCard',
    root: { shape: 'rounded', fontSize: 19, bold: true, textColor: '', elevation: 'glow' },
    branch: { shape: 'rounded', fontSize: 15, bold: true, textColor: '', elevation: 'soft' },
    deep: { shape: 'rounded', fontSize: 13, bold: false, textColor: '', elevation: 'soft' }
  }
]

export const MINDMAP_STYLE_PRESET_IDS = MINDMAP_STYLE_PRESETS.map(preset => preset.id)

export const TOPIC_SHAPES = [
  { id: 'capsule', labelKey: 'mindmap.shapeCapsule' },
  { id: 'rounded', labelKey: 'mindmap.shapeRounded' },
  { id: 'rect', labelKey: 'mindmap.shapeRect' },
  { id: 'ellipse', labelKey: 'mindmap.shapeEllipse' },
  { id: 'underline', labelKey: 'mindmap.shapeUnderline' }
]

export const TOPIC_SHAPE_IDS = TOPIC_SHAPES.map(shape => shape.id)

export const BRANCH_STYLES = [
  { id: 'curve', labelKey: 'mindmap.branchCurve' },
  { id: 'straight', labelKey: 'mindmap.branchStraight' },
  { id: 'elbow', labelKey: 'mindmap.branchElbow' }
]

export const BRANCH_STYLE_IDS = BRANCH_STYLES.map(style => style.id)

export const FONT_SIZES = [12, 13, 14, 15, 16, 18, 20, 24]

export const MAX_ATTACHMENTS_PER_NODE = 6
export const MAX_ASSIGNEE_LENGTH = 40

export function normalizeIsoDate(value) {
  const text = String(value || '').trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : ''
}

export function normalizeAssignee(value) {
  return String(value || '').trim().slice(0, MAX_ASSIGNEE_LENGTH)
}

export function normalizeAttachments(value) {
  if (!Array.isArray(value)) {
    return []
  }

  const attachments = []
  value.forEach(item => {
    if (!item || typeof item !== 'object') {
      return
    }
    const url = String(item.url || '').trim()
    // 允许 http(s) 链接与本地上传的 data: URL
    if (!/^(https?:\/\/|data:)/i.test(url)) {
      return
    }
    attachments.push({
      id: String(item.id || `att-${attachments.length + 1}`),
      name: String(item.name || '附件').trim().slice(0, 60) || '附件',
      url: url.slice(0, 2_500_000)
    })
  })

  return attachments.slice(0, MAX_ATTACHMENTS_PER_NODE)
}

export const TEXT_COLORS = [
  { id: 'auto', value: '', labelKey: 'mindmap.colorAuto' },
  { id: 'ink', value: '#18181b', labelKey: 'mindmap.colorInk' },
  { id: 'blue', value: '#1d4ed8', labelKey: 'mindmap.colorBlue' },
  { id: 'teal', value: '#0f766e', labelKey: 'mindmap.colorTeal' },
  { id: 'rose', value: '#be123c', labelKey: 'mindmap.colorRose' },
  { id: 'amber', value: '#b45309', labelKey: 'mindmap.colorAmber' }
]

export const MINDMAP_THEMES = [
  {
    id: 'aurora',
    labelKey: 'mindmap.themeAurora',
    // 按层级取色：中心主题 / 一级分支 / 二级分支 / 更深层级
    depths: ['blue', 'teal', 'violet', 'amber'],
    rootElevation: 'glow'
  },
  {
    id: 'ocean',
    labelKey: 'mindmap.themeOcean',
    depths: ['sky', 'blue', 'emerald', 'slate'],
    rootElevation: 'glow'
  },
  {
    id: 'sunset',
    labelKey: 'mindmap.themeSunset',
    depths: ['rose', 'amber', 'violet', 'teal'],
    rootElevation: 'soft'
  },
  {
    id: 'mono',
    labelKey: 'mindmap.themeMono',
    depths: ['slate', 'slate', 'slate', 'slate'],
    rootElevation: 'soft'
  }
]

export const DEFAULT_MINDMAP_LAYOUT = Object.freeze({
  direction: 'right',
  theme: 'aurora',
  branchStyle: 'curve',
  rainbow: false,
  numbering: false
})
export const MINDMAP_DIRECTIONS = MINDMAP_LAYOUTS.map(layout => layout.id)
export const MINDMAP_THEME_IDS = MINDMAP_THEMES.map(theme => theme.id)

export function normalizeTopicShape(value) {
  return TOPIC_SHAPE_IDS.includes(value) ? value : 'capsule'
}

export function normalizeBranchStyle(value) {
  return BRANCH_STYLE_IDS.includes(value) ? value : 'curve'
}

export function normalizeFontSize(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const size = Number(value)
  if (!Number.isFinite(size)) {
    return null
  }
  return Math.max(11, Math.min(28, Math.round(size)))
}

export function normalizeTextColor(value) {
  const color = String(value || '').trim()
  return /^#[0-9a-f]{6}$/i.test(color) ? color : ''
}

export function getMarkerEmoji(markerId) {
  return MARKER_MAP.get(markerId)?.emoji || ''
}

export function normalizeMarkers(value) {
  if (!Array.isArray(value)) {
    return []
  }
  const seen = new Set()
  const markers = []
  value.forEach(markerId => {
    const id = String(markerId || '')
    if (!MARKER_MAP.has(id) || seen.has(id)) {
      return
    }
    seen.add(id)
    markers.push(id)
  })
  return markers.slice(0, MAX_MARKERS_PER_NODE)
}

export function normalizeLabels(value) {
  if (!Array.isArray(value)) {
    return []
  }
  const labels = []
  const seen = new Set()
  value.forEach(item => {
    const label = String(item || '').trim().slice(0, MAX_LABEL_LENGTH)
    if (!label || seen.has(label)) {
      return
    }
    seen.add(label)
    labels.push(label)
  })
  return labels.slice(0, MAX_LABELS_PER_NODE)
}

export function normalizeNote(value) {
  return typeof value === 'string' ? value.slice(0, MAX_NOTE_LENGTH) : ''
}

export function normalizePriority(value) {
  const priority = Number(value)
  if (!Number.isFinite(priority) || priority < 1 || priority > 9) {
    return null
  }
  return Math.round(priority)
}

export function normalizeProgress(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const progress = Number(value)
  if (!Number.isFinite(progress)) {
    return null
  }
  return Math.max(0, Math.min(100, Math.round(progress)))
}

export function normalizeMindmapLayout(value) {
  const layout = value && typeof value === 'object' ? value : {}
  const direction = MINDMAP_DIRECTIONS.includes(layout.direction) ? layout.direction : DEFAULT_MINDMAP_LAYOUT.direction
  const theme = MINDMAP_THEME_IDS.includes(layout.theme) ? layout.theme : DEFAULT_MINDMAP_LAYOUT.theme
  return {
    direction,
    theme,
    branchStyle: normalizeBranchStyle(layout.branchStyle),
    rainbow: layout.rainbow === true,
    numbering: layout.numbering === true
  }
}

export function resolveThemeAccent(themeId, depth = 0) {
  const theme = MINDMAP_THEMES.find(item => item.id === themeId) || MINDMAP_THEMES[0]
  const index = Math.min(Math.max(depth, 0), theme.depths.length - 1)
  return theme.depths[index]
}

export function resolveThemeElevation(themeId, depth = 0) {
  const theme = MINDMAP_THEMES.find(item => item.id === themeId) || MINDMAP_THEMES[0]
  return depth === 0 ? theme.rootElevation : 'soft'
}
