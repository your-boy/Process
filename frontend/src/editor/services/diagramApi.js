const DEFAULT_BASE_URL = 'http://localhost:8080'
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

  async function request(path, { method = 'GET', token, body, defaultErrorMessage } = {}) {
    const headers = {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
    const response = await requestImpl(`${baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    })

    const payloadText = response.status === 204 ? '' : await response.text()
    const payload = parseResponseBody(payloadText)

    if (!response.ok) {
      const error = new Error(resolveErrorMessage(payload, defaultErrorMessage, response.status))
      error.status = response.status
      error.payload = payload
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
      return request('/api/diagrams', {
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
    }
  }
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