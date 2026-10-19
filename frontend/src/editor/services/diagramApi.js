// VITE_API_BASE_URL 留空（默认）表示同源请求：
//   - 本地开发：/api 由 vite.config.js 的 proxy 转发到后端
//   - 生产上线：/api 由 Nginx 等反向代理转发，或前后端同域部署
// 只有前后端真正跨域部署时，才需要显式设置成后端地址（如 https://api.example.com）。
const configuredBaseUrl = import.meta.env?.VITE_API_BASE_URL
const DEFAULT_BASE_URL = String(configuredBaseUrl ?? '').replace(/\/$/, '')
const GENERIC_HTTP_ERROR_LABELS = new Map([
  [401, 'Unauthorized'],
  [403, 'Forbidden'],
  [404, 'Not Found'],
  [405, 'Method Not Allowed'],
  [415, 'Unsupported Media Type'],
  [429, 'Too Many Requests'],
  [500, 'Internal Server Error']
])

export function createDiagramApi(baseUrl = DEFAULT_BASE_URL, requestImpl = fetch) {
  let publicKeyPromise = null
  let importedPublicKey = null
  let importedPublicKeyPem = ''

  function resetPublicKeyCache() {
    publicKeyPromise = null
    importedPublicKey = null
    importedPublicKeyPem = ''
  }

  async function request(path, { method = 'GET', token, body, defaultErrorMessage, timeoutMs = 30000 } = {}) {
    const headers = {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
    const controller = typeof AbortController === 'function' ? new AbortController() : null
    const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null

    let response
    try {
      response = await requestImpl(`${baseUrl}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store',
        ...(controller ? { signal: controller.signal } : {})
      })
    } catch (error) {
      if (error?.name === 'AbortError') {
        const timeoutError = new Error('请求超时，请确认后端服务是否正常')
        timeoutError.code = 'timeout'
        throw timeoutError
      }
      throw createNetworkError(error)
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }

    const payloadText = response.status === 204 ? '' : await response.text()
    const payload = parseResponseBody(payloadText)
    const contentType = String(response.headers?.get?.('content-type') || '').toLowerCase()

    // 静态托管（如 vite preview / Nginx SPA 兜底）会把 /api 请求回退成 index.html，
    // 这里必须拒绝非 JSON 的 200 响应，否则会把「HTML 字符串」当成文档数据写回去。
    if (response.ok && payloadText && !contentType.includes('json')) {
      const error = new Error('接口返回的不是 JSON，通常是 /api 没有被代理到后端（返回了静态页面）')
      error.code = 'not-json'
      throw error
    }

    if (!response.ok) {
      // 反向代理（Vite / Nginx）在后端不可用时通常返回 5xx + 纯文本/HTML 错误页，
      // 这类响应按「连不上后端」处理，避免把代理的错误页原文弹给用户。
      if (response.status >= 500 && !contentType.includes('json')) {
        const proxyError = new Error(
          `无法连接后端服务（代理返回 ${response.status}），请确认服务已启动或反向代理配置正确`
        )
        proxyError.code = 'network'
        proxyError.status = response.status
        throw proxyError
      }

      const error = new Error(resolveErrorMessage(payload, defaultErrorMessage, response.status))
      error.status = response.status
      error.payload = payload
      if (response.status === 401 && token && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('diagram-editor:unauthorized', { detail: { message: error.message } }))
      }
      throw error
    }

    return payload
  }

  async function getPublicKey() {
    if (!publicKeyPromise) {
      publicKeyPromise = request('/api/auth/public-key', {
        method: 'GET',
        defaultErrorMessage: '获取登录公钥失败'
      }).then(result => result?.publicKey)
    }

    try {
      return await publicKeyPromise
    } catch (error) {
      resetPublicKeyCache()
      throw error
    }
  }

  async function withFreshPublicKeyRetry(executor) {
    try {
      return await executor()
    } catch (error) {
      if (!shouldRetryWithFreshPublicKey(error)) {
        throw error
      }

      resetPublicKeyCache()
      return executor()
    }
  }

  async function encryptSecret(secret) {
    if (!globalThis.crypto?.subtle) {
      throw new Error('当前浏览器不支持加密登录')
    }

    const publicKeyPem = await getPublicKey()
    const cryptoKey = await importPublicKey(publicKeyPem)
    const encrypted = await globalThis.crypto.subtle.encrypt(
      { name: 'RSA-OAEP' },
      cryptoKey,
      new TextEncoder().encode(String(secret || ''))
    )
    return arrayBufferToBase64(encrypted)
  }

  async function importPublicKey(publicKeyPem) {
    if (importedPublicKey && importedPublicKeyPem === publicKeyPem) {
      return importedPublicKey
    }

    const keyBuffer = base64ToArrayBuffer(stripPublicKeyPem(publicKeyPem))
    importedPublicKey = await globalThis.crypto.subtle.importKey(
      'spki',
      keyBuffer,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256'
      },
      false,
      ['encrypt']
    )
    importedPublicKeyPem = publicKeyPem
    return importedPublicKey
  }

  return {
    async login(username, password) {
      return withFreshPublicKeyRetry(async () => {
        const encryptedPassword = await encryptSecret(password)
        return request('/api/auth/login', {
          method: 'POST',
          defaultErrorMessage: '用户名或密码错误',
          body: { username, encryptedPassword }
        })
      })
    },
    async logout(token) {
      return request('/api/auth/logout', {
        method: 'POST',
        token,
        defaultErrorMessage: '退出登录失败'
      })
    },
    async forgotPassword(username, recoveryCode, newPassword) {
      return withFreshPublicKeyRetry(async () => {
        const [encryptedRecoveryCode, encryptedNewPassword] = await Promise.all([
          encryptSecret(recoveryCode),
          encryptSecret(newPassword)
        ])

        return request('/api/auth/forgot-password', {
          method: 'POST',
          defaultErrorMessage: '忘记密码处理失败',
          body: {
            username,
            encryptedRecoveryCode,
            encryptedNewPassword
          }
        })
      })
    },
    async changePassword(currentPassword, newPassword, token) {
      return withFreshPublicKeyRetry(async () => {
        const [encryptedCurrentPassword, encryptedNewPassword] = await Promise.all([
          encryptSecret(currentPassword),
          encryptSecret(newPassword)
        ])

        return request('/api/auth/change-password', {
          method: 'POST',
          token,
          defaultErrorMessage: '修改密码失败',
          body: {
            encryptedCurrentPassword,
            encryptedNewPassword
          }
        })
      })
    },
    createDocument(document, token) {
      return request('/api/diagrams', {
        method: 'POST',
        token,
        defaultErrorMessage: '保存文档失败',
        body: document
      })
    },
    listDocuments(token) {
      return request('/api/diagrams?summary=true', {
        method: 'GET',
        token,
        defaultErrorMessage: '获取文档列表失败'
      })
    },
    updateDocument(id, document, token) {
      return request(`/api/diagrams/${id}`, {
        method: 'PUT',
        token,
        defaultErrorMessage: '更新文档失败',
        body: document
      })
    },
    getDocument(id, token) {
      return request(`/api/diagrams/${id}`, {
        method: 'GET',
        token,
        defaultErrorMessage: '加载文档失败'
      })
    },
    deleteDocument(id, token) {
      return request(`/api/diagrams/${id}`, {
        method: 'DELETE',
        token,
        defaultErrorMessage: '删除文档失败'
      })
    },
    ping() {
      return request('/api/diagrams/ping')
    },
    listRevisions(id, token) {
      return request(`/api/diagrams/${id}/revisions`, {
        method: 'GET',
        token,
        defaultErrorMessage: '获取历史版本失败'
      })
    },
    getRevision(id, revisionId, token) {
      return request(`/api/diagrams/${id}/revisions/${revisionId}`, {
        method: 'GET',
        token,
        defaultErrorMessage: '读取历史版本失败'
      })
    },
    restoreRevision(id, revisionId, token) {
      return request(`/api/diagrams/${id}/revisions/${revisionId}/restore`, {
        method: 'POST',
        token,
        defaultErrorMessage: '恢复历史版本失败'
      })
    }
  }
}

// fetch 抛错只能说明「没拿到响应」：后端没启动、代理没配、跨域被拦、DNS/IPv6 打不通
// 都会落到这里，所以文案只给方向，不再甩锅给「网络」。
function createNetworkError(cause) {
  const error = new Error('无法连接后端服务，请确认服务已启动或反向代理配置正确')
  error.code = 'network'
  error.cause = cause
  return error
}

function parseResponseBody(payloadText) {
  if (!payloadText) {
    return null
  }

  try {
    return JSON.parse(payloadText)
  } catch {
    return payloadText
  }
}

function resolveErrorMessage(payload, fallbackMessage, status) {
  if (payload && typeof payload === 'object') {
    if (typeof payload.message === 'string' && payload.message.trim()) {
      return payload.message
    }
    if (typeof payload.error === 'string' && payload.error.trim() && !isGenericHttpErrorLabel(payload.error, status)) {
      return payload.error
    }
  }

  if (typeof payload === 'string' && payload.trim()) {
    return payload.trim()
  }

  return fallbackMessage || `请求失败: ${status}`
}

function isGenericHttpErrorLabel(label, status) {
  const expected = GENERIC_HTTP_ERROR_LABELS.get(status)
  return Boolean(expected) && String(label || '').trim().toLowerCase() === expected.toLowerCase()
}

function shouldRetryWithFreshPublicKey(error) {
  if (!error || error.status !== 400) {
    return false
  }

  const message = String(error.message || '').trim()
  return /bad request|密文解析失败/i.test(message)
}

function stripPublicKeyPem(publicKeyPem) {
  return String(publicKeyPem || '')
    .replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '')
    .replace(/\s+/g, '')
}

function base64ToArrayBuffer(base64Value) {
  const binary = globalThis.atob(base64Value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes.buffer
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte)
  })
  return globalThis.btoa(binary)
}