<template>
  <section class="login-page">
    <div class="login-card">
      <h1 class="visually-hidden">{{ mode === 'login' ? t('auth.login') : t('auth.resetPassword') }}</h1>

      <form v-if="mode === 'login'" class="login-form" @submit.prevent="submitLogin">
        <div class="field">
          <label for="username">{{ t('auth.username') }}</label>
          <input
            id="username"
            v-model="username"
            type="text"
            maxlength="32"
            autocomplete="username"
            :placeholder="t('auth.usernamePlaceholder')"
          />
        </div>

        <div class="field">
          <label for="password">{{ t('auth.password') }}</label>
          <div class="input-wrap">
            <input
              id="password"
              v-model="password"
              :type="passwordVisibility.login ? 'text' : 'password'"
              maxlength="64"
              autocomplete="current-password"
              :placeholder="t('auth.passwordPlaceholder')"
            />
            <button
              type="button"
              class="reveal"
              data-testid="toggle-login-password"
              :aria-label="passwordVisibility.login ? t('auth.hidePassword') : t('auth.showPassword')"
              @click="passwordVisibility.login = !passwordVisibility.login"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M2.6 12C4.6 8.1 8 5.8 12 5.8S19.4 8.1 21.4 12C19.4 15.9 16 18.2 12 18.2S4.6 15.9 2.6 12Z"></path>
                <circle cx="12" cy="12" r="3.2"></circle>
                <path v-if="!passwordVisibility.login" d="M4 4 20 20"></path>
              </svg>
            </button>
          </div>
        </div>

        <p v-if="error" class="error" role="alert">{{ error }}</p>

        <div class="login-actions-row">
          <button class="submit" type="submit" :disabled="loading">
            {{ loading ? t('auth.loginLoading') : t('auth.login') }}
          </button>
          <label class="remember-toggle" for="remember-password">
            <input
              id="remember-password"
              v-model="remember"
              type="checkbox"
              data-testid="remember-password"
            />
            <span>{{ t('auth.rememberPassword') }}</span>
          </label>
          <button class="link" type="button" :disabled="loading" @click="setMode('forgot')">
            {{ t('auth.forgotPassword') }}
          </button>
        </div>
      </form>

      <form v-else class="login-form" @submit.prevent="submitForgotPassword">
        <div class="field">
          <label for="recovery-username">{{ t('auth.username') }}</label>
          <input
            id="recovery-username"
            v-model="recoveryUsername"
            type="text"
            maxlength="32"
            autocomplete="username"
            :placeholder="t('auth.usernamePlaceholder')"
          />
        </div>

        <div class="field">
          <label for="recovery-code">{{ t('auth.recoveryCode') }}</label>
          <div class="input-wrap">
            <input
              id="recovery-code"
              v-model="recoveryCode"
              :type="passwordVisibility.recoveryCode ? 'text' : 'password'"
              maxlength="64"
              autocomplete="one-time-code"
              :placeholder="t('auth.recoveryCodePlaceholder')"
            />
            <button
              type="button"
              class="reveal"
              data-testid="toggle-recovery-code"
              :aria-label="passwordVisibility.recoveryCode ? t('auth.hideRecoveryCode') : t('auth.showRecoveryCode')"
              @click="passwordVisibility.recoveryCode = !passwordVisibility.recoveryCode"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M2.6 12C4.6 8.1 8 5.8 12 5.8S19.4 8.1 21.4 12C19.4 15.9 16 18.2 12 18.2S4.6 15.9 2.6 12Z"></path>
                <circle cx="12" cy="12" r="3.2"></circle>
                <path v-if="!passwordVisibility.recoveryCode" d="M4 4 20 20"></path>
              </svg>
            </button>
          </div>
        </div>

        <div class="field">
          <label for="recovery-password">{{ t('auth.newPassword') }}</label>
          <div class="input-wrap">
            <input
              id="recovery-password"
              v-model="recoveryPassword"
              :type="passwordVisibility.recoveryPassword ? 'text' : 'password'"
              maxlength="64"
              autocomplete="new-password"
              :placeholder="t('auth.recoveryPasswordPlaceholder')"
            />
            <button
              type="button"
              class="reveal"
              data-testid="toggle-recovery-password"
              :aria-label="passwordVisibility.recoveryPassword ? t('auth.hideNewPassword') : t('auth.showNewPassword')"
              @click="passwordVisibility.recoveryPassword = !passwordVisibility.recoveryPassword"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M2.6 12C4.6 8.1 8 5.8 12 5.8S19.4 8.1 21.4 12C19.4 15.9 16 18.2 12 18.2S4.6 15.9 2.6 12Z"></path>
                <circle cx="12" cy="12" r="3.2"></circle>
                <path v-if="!passwordVisibility.recoveryPassword" d="M4 4 20 20"></path>
              </svg>
            </button>
          </div>
        </div>

        <div class="field">
          <label for="recovery-confirm">{{ t('auth.confirmPassword') }}</label>
          <div class="input-wrap">
            <input
              id="recovery-confirm"
              v-model="recoveryConfirmPassword"
              :type="passwordVisibility.recoveryConfirm ? 'text' : 'password'"
              maxlength="64"
              autocomplete="new-password"
              :placeholder="t('auth.recoveryConfirmPlaceholder')"
            />
            <button
              type="button"
              class="reveal"
              data-testid="toggle-recovery-confirm"
              :aria-label="passwordVisibility.recoveryConfirm ? t('auth.hideConfirmPassword') : t('auth.showConfirmPassword')"
              @click="passwordVisibility.recoveryConfirm = !passwordVisibility.recoveryConfirm"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M2.6 12C4.6 8.1 8 5.8 12 5.8S19.4 8.1 21.4 12C19.4 15.9 16 18.2 12 18.2S4.6 15.9 2.6 12Z"></path>
                <circle cx="12" cy="12" r="3.2"></circle>
                <path v-if="!passwordVisibility.recoveryConfirm" d="M4 4 20 20"></path>
              </svg>
            </button>
          </div>
        </div>

        <p v-if="error" class="error" role="alert">{{ error }}</p>

        <div class="login-actions-row">
          <button class="submit" type="submit" :disabled="loading">
            {{ loading ? t('auth.processing') : t('auth.resetPassword') }}
          </button>
          <button class="link" type="button" :disabled="loading" @click="setMode('login')">
            {{ t('auth.backToLogin') }}
          </button>
        </div>
      </form>
    </div>
  </section>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { t } from '../i18n'

const DEMO_USERNAME = ''
const REMEMBERED_LOGIN_KEY = 'process:remembered-login'

function readRememberedLogin() {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const raw = window.localStorage.getItem(REMEMBERED_LOGIN_KEY)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw)
    const username = String(parsed?.username || '')
    if (!username) {
      return null
    }
    let password = ''
    try {
      password = decodeURIComponent(escape(window.atob(String(parsed?.password || ''))))
    } catch {
      password = ''
    }
    return { username, password }
  } catch {
    return null
  }
}

const rememberedLogin = readRememberedLogin()

defineProps({
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['login', 'forgot-password'])
const mode = ref('login')
const username = ref(rememberedLogin?.username || DEMO_USERNAME)
const password = ref(rememberedLogin?.password || '')
const remember = ref(Boolean(rememberedLogin?.username))
const recoveryUsername = ref(DEMO_USERNAME)
const recoveryCode = ref('')
const recoveryPassword = ref('')
const recoveryConfirmPassword = ref('')
const passwordVisibility = reactive({
  login: false,
  recoveryCode: false,
  recoveryPassword: false,
  recoveryConfirm: false
})

function setMode(nextMode) {
  mode.value = nextMode
  if (nextMode === 'forgot') {
    recoveryUsername.value = username.value || recoveryUsername.value
    return
  }
  username.value = recoveryUsername.value || username.value
}

function submitLogin() {
  emit('login', {
    username: username.value,
    password: password.value,
    remember: remember.value
  })
}

function submitForgotPassword() {
  emit('forgot-password', {
    username: recoveryUsername.value,
    recoveryCode: recoveryCode.value,
    newPassword: recoveryPassword.value,
    confirmPassword: recoveryConfirmPassword.value
  })
}
</script>

<style scoped>
.login-page {
  display: grid;
  place-items: center;
  min-height: calc(100vh - 150px);
  padding: 24px 0;
}

.login-card {
  position: relative;
  width: min(460px, 100%);
  padding: 28px 28px 24px;
  border: 1px solid var(--border-strong);
  border-top: 3px solid var(--foreground);
  border-radius: var(--radius);
  background: var(--card);
  box-shadow: 7px 7px 0 var(--muted);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.login-card h1 {
  margin: 0 0 20px;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--card-foreground);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.field {
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
}

.field label {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--muted-foreground);
  text-align: left;
}

.field input {
  width: 100%;
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface-sunken);
  color: var(--foreground);
  font-size: 13.5px;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
}

.field input::placeholder {
  color: var(--muted-foreground);
}

.field input:hover {
  background: var(--card);
}

.field input:focus {
  border-color: var(--accent);
  background: var(--card);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.input-wrap {
  position: relative;
}

.input-wrap input {
  padding-right: 40px;
}

.reveal {
  position: absolute;
  top: 50%;
  right: 4px;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--muted-foreground);
  cursor: pointer;
  transform: translateY(-50%);
}

.reveal:hover {
  background: var(--muted);
  color: var(--foreground);
}

.reveal svg {
  width: 16px;
  height: 16px;
}

.reveal svg path,
.reveal svg circle {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.error {
  margin: 0 0 0 94px;
  padding-left: 8px;
  border-left: 2px solid var(--destructive);
  font-size: 12px;
  color: var(--destructive);
}

.login-actions-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  width: calc(100% - 94px);
  margin-left: 94px;
}

.login-actions-row .submit {
  width: auto;
  min-width: 96px;
  margin: 0;
  padding: 0 18px;
}

.remember-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--muted-foreground);
  font-size: 12.5px;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}

.remember-toggle input {
  width: 14px;
  height: 14px;
  margin: 0;
  accent-color: var(--accent);
  cursor: pointer;
}

.login-actions-row .link {
  align-self: center;
  margin-left: auto;
}

.submit {
  width: calc(100% - 94px);
  height: 36px;
  margin: 4px 0 0 94px;
  box-sizing: border-box;
  border: 1px solid var(--primary);
  border-radius: var(--radius-sm);
  background: var(--primary);
  color: var(--primary-foreground);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.01em;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.15s;
}

.submit:hover {
  opacity: 0.9;
}

.submit:active {
  transform: translateY(1px);
}

.submit:disabled {
  opacity: 0.6;
  cursor: wait;
}

.link {
  align-self: flex-start;
  margin-left: 94px;
  padding: 2px 0;
  border: 0;
  background: transparent;
  color: var(--muted-foreground);
  font-size: 12.5px;
  cursor: pointer;
}

.link:hover {
  color: var(--foreground);
  text-decoration: underline;
  text-underline-offset: 3px;
}
</style>
