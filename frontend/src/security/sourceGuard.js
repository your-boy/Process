const DEVTOOLS_THRESHOLD = 160
const DEVTOOLS_CHECK_INTERVAL = 1000

export function installSourceGuard() {
  if (typeof window === 'undefined' || window.__diagramSourceGuardInstalled) {
    return
  }

  window.__diagramSourceGuardInstalled = true

  blockContextMenu()
  blockShortcuts()
  blockAssetDragging()
  preventEmbedding()
  installDevtoolsShield()
}

function blockContextMenu() {
  document.addEventListener('contextmenu', event => {
    event.preventDefault()
    event.stopPropagation()
  }, { capture: true })
}

function blockShortcuts() {
  document.addEventListener('keydown', event => {
    if (!isBlockedShortcut(event)) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
  }, { capture: true })
}

function blockAssetDragging() {
  document.addEventListener('dragstart', event => {
    const target = event.target
    if (!(target instanceof HTMLElement)) {
      return
    }

    if (!target.closest('img, a[download]')) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
  }, { capture: true })
}

function preventEmbedding() {
  if (window.top === window.self) {
    return
  }

  try {
    window.top.location = window.self.location.href
  } catch {
    window.self.location = window.self.location.href
  }
}

function installDevtoolsShield() {
  const shield = document.createElement('div')
  shield.id = 'devtools-shield'
  shield.setAttribute('aria-hidden', 'true')
  shield.innerHTML = '<div class="devtools-shield__content"><strong>调试工具已禁用</strong><span>请关闭开发者工具后继续访问页面。</span></div>'
  document.body.appendChild(shield)

  const style = document.createElement('style')
  style.textContent = `
    #devtools-shield {
      position: fixed;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: rgba(7, 12, 24, 0.78);
      backdrop-filter: blur(14px);
      z-index: 2147483647;
    }

    #devtools-shield.is-visible {
      display: flex;
    }

    .devtools-shield__content {
      display: grid;
      gap: 10px;
      max-width: 360px;
      padding: 24px 28px;
      border-radius: 22px;
      background: rgba(255, 255, 255, 0.96);
      box-shadow: 0 24px 80px rgba(8, 15, 32, 0.32);
      text-align: center;
      color: #11213a;
      font-family: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
    }

    .devtools-shield__content strong {
      font-size: 1.1rem;
    }

    .devtools-shield__content span {
      color: #4b5d78;
      line-height: 1.7;
    }
  `
  document.head.appendChild(style)

  const toggleShield = () => {
    const devtoolsOpen = isDevtoolsOpen()
    shield.classList.toggle('is-visible', devtoolsOpen)
    shield.setAttribute('aria-hidden', String(!devtoolsOpen))
  }

  toggleShield()
  window.setInterval(toggleShield, DEVTOOLS_CHECK_INTERVAL)
}

function isBlockedShortcut(event) {
  const key = String(event.key || '').toUpperCase()
  if (key === 'F12') {
    return true
  }

  if ((event.ctrlKey || event.metaKey) && key === 'U') {
    return true
  }

  if ((event.ctrlKey || event.metaKey) && event.shiftKey && ['I', 'J', 'C', 'K'].includes(key)) {
    return true
  }

  if (event.metaKey && event.altKey && ['I', 'J', 'C'].includes(key)) {
    return true
  }

  return false
}

function isDevtoolsOpen() {
  return (
    window.outerWidth - window.innerWidth > DEVTOOLS_THRESHOLD ||
    window.outerHeight - window.innerHeight > DEVTOOLS_THRESHOLD
  )
}