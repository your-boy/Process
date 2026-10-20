export function rotateVector(x, y, degrees) {
  const radians = (Number(degrees) || 0) * Math.PI / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos
  }
}

export function rotatePointAround(point, center, degrees) {
  const rotated = rotateVector(point.x - center.x, point.y - center.y, degrees)
  return {
    x: center.x + rotated.x,
    y: center.y + rotated.y
  }
}

export function resolveResizeCursor(direction, rotation) {
  const baseAngles = { e: 0, se: 45, s: 90, sw: 135, w: 180, nw: 225, n: 270, ne: 315 }
  const cursorAngles = [0, 45, 90, 135]
  const cursorNames = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize']
  const normalized = ((baseAngles[direction] || 0) + (Number(rotation) || 0)) % 180
  let closest = 0
  let distance = Number.POSITIVE_INFINITY
  cursorAngles.forEach((angle, index) => {
    const raw = Math.abs(normalized - angle)
    const delta = Math.min(raw, 180 - raw)
    if (delta < distance) {
      distance = delta
      closest = index
    }
  })
  return cursorNames[closest]
}
