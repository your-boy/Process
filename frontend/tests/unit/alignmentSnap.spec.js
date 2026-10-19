import { describe, expect, it } from 'vitest'
import { findContainerSnap, findEqualSpacing, snapResizeRect, toBoxes } from '../../src/editor/render/alignmentSnap'

const node = (id, x, y, width = 160, height = 60) => ({ id, x, y, width, height })

describe('alignmentSnap · 等间距', () => {
  it('夹在两个节点中间且间距接近时，对齐成等距', () => {
    const others = [node('a', 0, 200), node('b', 600, 200)]
    const moving = { left: 300, right: 460, top: 200, bottom: 260, centerX: 380, centerY: 230, width: 160, height: 60 }

    const result = findEqualSpacing({ box: moving, others, threshold: 8 })
    expect(result).not.toBeNull()
    expect(result.axis).toBe('x')
    // a 右边 = 160，b 左边 = 600，可用跨度 440，块宽 160 → 两侧各 140
    expect(Math.round(result.gap)).toBe(140)
    expect(Math.round(result.delta)).toBe(0)
    expect(result.guides).toHaveLength(2)
    expect(result.guides[1].label).toBe('140')
  })

  it('间距差超过阈值时不吸附', () => {
    const others = [node('a', 0, 200), node('b', 700, 200)]
    const moving = { left: 300, right: 460, top: 200, bottom: 260, centerX: 380, centerY: 230, width: 160, height: 60 }
    expect(findEqualSpacing({ box: moving, others, threshold: 8 })).toBeNull()
  })

  it('不在同一水平带上时不吸附', () => {
    const others = [node('a', 0, 600), node('b', 600, 600)]
    const moving = { left: 300, right: 460, top: 200, bottom: 260, centerX: 380, centerY: 230, width: 160, height: 60 }
    expect(findEqualSpacing({ box: moving, others, threshold: 8 })).toBeNull()
  })

  it('纵向等间距同样生效', () => {
    const others = [node('a', 300, 0), node('b', 300, 600)]
    const moving = { left: 300, right: 460, top: 300, bottom: 360, centerX: 380, centerY: 330, width: 160, height: 60 }
    const result = findEqualSpacing({ box: moving, others, threshold: 8 })
    expect(result).not.toBeNull()
    expect(result.axis).toBe('y')
  })

  it('toBoxes 会换算中心点', () => {
    const [box] = toBoxes([node('a', 100, 50, 200, 80)])
    expect(box.centerX).toBe(200)
    expect(box.centerY).toBe(90)
    expect(box.right).toBe(300)
    expect(box.bottom).toBe(130)
  })
})

describe('alignmentSnap · 缩放吸附', () => {
  const others = [node('a', 0, 0), node('b', 400, 0)]

  it('右边拉近另一个节点左边缘时吸附', () => {
    const rect = { x: 0, y: 0, width: 396, height: 60 }
    const result = snapResizeRect({ rect, direction: 'e', others, threshold: 8, minSize: 24 })
    expect(Math.round(result.rect.width)).toBe(400)
    expect(result.guides).toHaveLength(1)
    expect(Math.round(result.guides[0].x1)).toBe(400)
  })

  it('左边拉近时同步调整 x 与宽度', () => {
    const rect = { x: 6, y: 0, width: 100, height: 60 }
    const result = snapResizeRect({ rect, direction: 'w', others, threshold: 8, minSize: 24 })
    expect(Math.round(result.rect.x)).toBe(0)
    expect(Math.round(result.rect.width)).toBe(106)
  })

  it('底边拉近时吸附到节点底边', () => {
    const rect = { x: 0, y: 0, width: 100, height: 56 }
    const result = snapResizeRect({ rect, direction: 's', others, threshold: 8, minSize: 24 })
    expect(Math.round(result.rect.height)).toBe(60)
  })

  it('超出阈值不吸附', () => {
    const rect = { x: 0, y: 0, width: 380, height: 60 }
    const result = snapResizeRect({ rect, direction: 'e', others, threshold: 8, minSize: 24 })
    expect(result.rect.width).toBe(380)
    expect(result.guides).toHaveLength(0)
  })
})

describe('alignmentSnap · 容器内边距吸附', () => {
  const container = { id: 'c1', x: 100, y: 100, width: 400, height: 300 }

  it('靠近容器左内边距时吸附并给出紫色引导线', () => {
    const box = { left: 128, right: 268, top: 160, bottom: 220, centerX: 198, centerY: 190, width: 140, height: 60 }
    const result = findContainerSnap({ box, containers: [container], padding: 24, threshold: 8 })

    expect(result).not.toBeNull()
    expect(Math.round(result.dx)).toBe(-4)   // 124 - 128
    expect(result.guides[0].container).toBe(true)
  })

  it('拖到容器中心线附近时吸附到中线', () => {
    const centerX = 100 + 400 / 2
    const box = { left: centerX - 70 + 3, right: centerX + 70 + 3, top: 160, bottom: 220, centerX: centerX + 3, centerY: 190, width: 140, height: 60 }
    const result = findContainerSnap({ box, containers: [container], padding: 24, threshold: 8 })

    expect(result).not.toBeNull()
    expect(Math.round(result.dx)).toBe(-3)
  })

  it('不在容器内时不吸附', () => {
    const box = { left: 600, right: 740, top: 600, bottom: 660, centerX: 670, centerY: 630, width: 140, height: 60 }
    expect(findContainerSnap({ box, containers: [container], padding: 24, threshold: 8 })).toBeNull()
  })

  it('没有容器时返回 null', () => {
    const box = { left: 128, right: 268, top: 160, bottom: 220, centerX: 198, centerY: 190, width: 140, height: 60 }
    expect(findContainerSnap({ box, containers: [], padding: 24, threshold: 8 })).toBeNull()
  })
})

describe('alignmentSnap · 追加等间距', () => {
  it('排在已有两块右侧且间距接近时对齐成等距', () => {
    const others = [node('a', 0, 200), node('b', 200, 200)]
    // a 右边 160，b 左边 200 → 间距 40；新块左边应该在 400+40 = 440 附近
    const box = { left: 404, right: 564, top: 200, bottom: 260, centerX: 484, centerY: 230, width: 160, height: 60 }
    const result = findEqualSpacing({ box, others, threshold: 8 })

    expect(result).not.toBeNull()
    expect(result.axis).toBe('x')
    expect(Math.round(result.delta)).toBe(-4)
  })
})
