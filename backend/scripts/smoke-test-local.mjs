import { createPublicKey, publicEncrypt, constants } from 'node:crypto'

const baseUrl = (process.env.API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '')
const username = process.env.APP_DEFAULT_USER_USERNAME || 'demo'
const password = process.env.APP_DEFAULT_USER_PASSWORD || 'demo123'

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options)
  const text = response.status === 204 ? '' : await response.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${path} -> ${response.status}: ${text}`)
  }
  return body
}

function encrypt(value, publicKeyPem) {
  return publicEncrypt(
    {
      key: createPublicKey(publicKeyPem),
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
    },
    Buffer.from(value, 'utf8')
  ).toString('base64')
}

async function main() {
  const keyResponse = await request('/api/auth/public-key')
  const login = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      encryptedPassword: encrypt(password, keyResponse.publicKey)
    })
  })
  const auth = { Authorization: `Bearer ${login.token}` }

  const created = await request('/api/diagrams', {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Local smoke test',
      mode: 'flowchart',
      content: { nodes: [{ id: 'start', label: 'H2 works' }], edges: [] }
    })
  })

  const list = await request('/api/diagrams', { headers: auth })
  const loaded = await request(`/api/diagrams/${created.id}`, { headers: auth })
  const updated = await request(`/api/diagrams/${created.id}`, {
    method: 'PUT',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Local smoke test (updated)',
      mode: 'flowchart',
      content: { nodes: [{ id: 'start', label: 'H2 persistence works' }], edges: [] }
    })
  })

  if (!list.some(item => item.id === created.id)) {
    throw new Error('Created document is missing from the list')
  }
  if (loaded.id !== created.id || updated.title !== 'Local smoke test (updated)') {
    throw new Error('Document read/update check failed')
  }

  if (process.env.KEEP_TEST_DOCUMENT === '1') {
    console.log(`KEPT document id=${created.id}`)
  } else {
    await request(`/api/diagrams/${created.id}`, { method: 'DELETE', headers: auth })
  }
  console.log(`OK: login, create, list, get and update all passed (${baseUrl})`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
