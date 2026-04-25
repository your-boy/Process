<template>
  <section class="login-panel">
    <div class="panel-copy">
      <div class="copy-header">
        <p class="eyebrow">Canvas Atelier</p>
        <h1>在线图编辑器</h1>
        <p class="description">
          把流程图、思维导图、Markdown 和思维笔记放进同一套优雅工作台里，登录后直接继续编辑、保存和导出。
        </p>
      </div>

      <div
        :class="['hero-stage', { paused: isHovering || isPointerActive, dragging: isPointerActive }]"
        :style="heroStageStyle"
        @mouseenter="pauseCarousel"
        @mouseleave="resumeCarousel"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerCancel"
      >
        <article
          v-for="(slide, index) in slides"
          :key="slide.title"
          :class="['hero-slide', { active: index === activeSlide }]"
        >
          <img class="hero-image" :src="slide.src" :alt="slide.title" draggable="false">
          <div class="hero-shade"></div>
          <div class="hero-copy">
            <p class="hero-eyebrow">{{ slide.eyebrow }}</p>
            <h2>{{ slide.title }}</h2>
            <p>{{ slide.description }}</p>
          </div>
        </article>

        <div class="hero-dots" role="tablist" aria-label="登录面板轮播图">
          <button
            v-for="(slide, index) in slides"
            :key="`${slide.title}-dot`"
            :class="['hero-dot', { active: index === activeSlide }]"
            type="button"
            :aria-label="`切换到 ${slide.title}`"
            :aria-selected="index === activeSlide"
            @click="setActiveSlide(index)"
          ></button>
        </div>
      </div>

      <div class="feature-strip">
        <span v-for="item in highlights" :key="item" class="feature-pill">{{ item }}</span>
      </div>
    </div>

    <div class="auth-shell">
      <div class="security-note">
        <p class="security-kicker">安全提示</p>
        <p class="security-copy">
          页面不再展示任何密码或恢复口令。请使用已分发的账号凭据登录；如需重置，请切换到忘记密码流程并填写你的恢复口令。
        </p>
      </div>

      <div class="mode-switch">
        <button
          type="button"
          :class="['mode-button', { active: mode === 'login' }]"
          @click="setMode('login')"
        >安全登录</button>
        <button
          type="button"
          :class="['mode-button', { active: mode === 'forgot' }]"
          @click="setMode('forgot')"
        >忘记密码</button>
      </div>

      <form v-if="mode === 'login'" class="login-card" @submit.prevent="submitLogin">
        <p class="card-kicker">仅登录</p>
        <label class="field-label" for="username">用户名</label>
        <input
          id="username"
          v-model="username"
          class="input-field"
          type="text"
          maxlength="32"
          autocomplete="username"
          placeholder="输入用户名"
        />
        <label class="field-label" for="password">密码</label>
        <div class="password-field">
          <input
            id="password"
            v-model="password"
            class="input-field"
            :type="passwordVisibility.login ? 'text' : 'password'"
            maxlength="64"
            autocomplete="current-password"
            placeholder="输入登录密码"
          />
          <button
            type="button"
            class="visibility-button"
            data-testid="toggle-login-password"
            :aria-label="passwordVisibility.login ? '隐藏登录密码' : '显示登录密码'"
            @click="passwordVisibility.login = !passwordVisibility.login"
          >
            <svg class="visibility-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M2.6 12C4.6 8.1 8 5.8 12 5.8S19.4 8.1 21.4 12C19.4 15.9 16 18.2 12 18.2S4.6 15.9 2.6 12Z"></path>
              <circle cx="12" cy="12" r="3.2"></circle>
              <path v-if="!passwordVisibility.login" d="M4 4 20 20"></path>
            </svg>
          </button>
        </div>
        <p class="helper-text">当前不提供注册，登录后即可继续编辑、保存和导出。</p>
        <p v-if="error" class="error-text">{{ error }}</p>
        <div class="action-row">
          <button class="login-button" type="submit" :disabled="loading">
            {{ loading ? '登录中...' : '进入编辑器' }}
          </button>
          <button class="text-button" type="button" :disabled="loading" @click="setMode('forgot')">忘记密码</button>
        </div>
      </form>

      <form v-else class="login-card" @submit.prevent="submitForgotPassword">
        <p class="card-kicker">恢复访问</p>
        <label class="field-label" for="recovery-username">用户名</label>
        <input
          id="recovery-username"
          v-model="recoveryUsername"
          class="input-field"
          type="text"
          maxlength="32"
          autocomplete="username"
          placeholder="输入用户名"
        />
        <label class="field-label" for="recovery-code">恢复口令</label>
        <div class="password-field">
          <input
            id="recovery-code"
            v-model="recoveryCode"
            class="input-field"
            :type="passwordVisibility.recoveryCode ? 'text' : 'password'"
            maxlength="64"
            autocomplete="one-time-code"
            placeholder="输入恢复口令"
          />
          <button
            type="button"
            class="visibility-button"
            data-testid="toggle-recovery-code"
            :aria-label="passwordVisibility.recoveryCode ? '隐藏恢复口令' : '显示恢复口令'"
            @click="passwordVisibility.recoveryCode = !passwordVisibility.recoveryCode"
          >
            <svg class="visibility-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M2.6 12C4.6 8.1 8 5.8 12 5.8S19.4 8.1 21.4 12C19.4 15.9 16 18.2 12 18.2S4.6 15.9 2.6 12Z"></path>
              <circle cx="12" cy="12" r="3.2"></circle>
              <path v-if="!passwordVisibility.recoveryCode" d="M4 4 20 20"></path>
            </svg>
          </button>
        </div>
        <label class="field-label" for="recovery-password">新密码</label>
        <div class="password-field">
          <input
            id="recovery-password"
            v-model="recoveryPassword"
            class="input-field"
            :type="passwordVisibility.recoveryPassword ? 'text' : 'password'"
            maxlength="64"
            autocomplete="new-password"
            placeholder="设置新密码"
          />
          <button
            type="button"
            class="visibility-button"
            data-testid="toggle-recovery-password"
            :aria-label="passwordVisibility.recoveryPassword ? '隐藏找回新密码' : '显示找回新密码'"
            @click="passwordVisibility.recoveryPassword = !passwordVisibility.recoveryPassword"
          >
            <svg class="visibility-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M2.6 12C4.6 8.1 8 5.8 12 5.8S19.4 8.1 21.4 12C19.4 15.9 16 18.2 12 18.2S4.6 15.9 2.6 12Z"></path>
              <circle cx="12" cy="12" r="3.2"></circle>
              <path v-if="!passwordVisibility.recoveryPassword" d="M4 4 20 20"></path>
            </svg>
          </button>
        </div>
        <label class="field-label" for="recovery-confirm">确认新密码</label>
        <div class="password-field">
          <input
            id="recovery-confirm"
            v-model="recoveryConfirmPassword"
            class="input-field"
            :type="passwordVisibility.recoveryConfirm ? 'text' : 'password'"
            maxlength="64"
            autocomplete="new-password"
            placeholder="再次输入新密码"
          />
          <button
            type="button"
            class="visibility-button"
            data-testid="toggle-recovery-confirm"
            :aria-label="passwordVisibility.recoveryConfirm ? '隐藏找回确认密码' : '显示找回确认密码'"
            @click="passwordVisibility.recoveryConfirm = !passwordVisibility.recoveryConfirm"
          >
            <svg class="visibility-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M2.6 12C4.6 8.1 8 5.8 12 5.8S19.4 8.1 21.4 12C19.4 15.9 16 18.2 12 18.2S4.6 15.9 2.6 12Z"></path>
              <circle cx="12" cy="12" r="3.2"></circle>
              <path v-if="!passwordVisibility.recoveryConfirm" d="M4 4 20 20"></path>
            </svg>
          </button>
        </div>
        <p class="helper-text">找回成功后会直接刷新登录态并进入工作台。</p>
        <p v-if="error" class="error-text">{{ error }}</p>
        <div class="action-row">
          <button class="login-button" type="submit" :disabled="loading">
            {{ loading ? '处理中...' : '重置并进入工作台' }}
          </button>
          <button class="text-button" type="button" :disabled="loading" @click="setMode('login')">返回登录</button>
        </div>
      </form>
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import flowPreview from '../img/flow-preview.svg'
import mindPreview from '../img/mind-preview.svg'
import notePreview from '../img/note-preview.svg'

const DEMO_USERNAME = ''
const CAROUSEL_INTERVAL = 5200
const SWIPE_THRESHOLD = 56

const slides = [
  {
    src: flowPreview,
    eyebrow: 'Flow Systems',
    title: '流程编排更清晰',
    description: '在同一张画布里组织判断、步骤和连接关系，保持结构清楚、导出稳定。'
  },
  {
    src: mindPreview,
    eyebrow: 'Mind Mapping',
    title: '思路展开更自然',
    description: '用分支、折叠和层级布局整理复杂主题，保留从总览到细节的节奏感。'
  },
  {
    src: notePreview,
    eyebrow: 'Hybrid Notes',
    title: '笔记与图解同屏协作',
    description: '一边维护结构，一边沉淀文本，让视觉表达和内容产出自然衔接。'
  }
]

const highlights = ['高清 PNG / JPG', 'XMind 导出', '单用户工作区', '本地草稿兜底']

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
const username = ref(DEMO_USERNAME)
const password = ref('')
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
const activeSlide = ref(0)
const isHovering = ref(false)
const isPointerActive = ref(false)
const pointerStartX = ref(0)
const pointerDeltaX = ref(0)

const heroStageStyle = computed(() => ({
  '--carousel-duration': `${CAROUSEL_INTERVAL}ms`,
  '--drag-offset': `${pointerDeltaX.value}px`
}))

let carouselTimer = null

onMounted(() => {
  startCarousel()
})

onBeforeUnmount(() => {
  stopCarousel()
})

function setMode(nextMode) {
  mode.value = nextMode
  if (nextMode === 'forgot') {
    recoveryUsername.value = username.value || recoveryUsername.value
    return
  }
  username.value = recoveryUsername.value || username.value
}

function startCarousel() {
  stopCarousel()

  if (typeof window === 'undefined' || isHovering.value || isPointerActive.value) {
    return
  }

  carouselTimer = window.setInterval(() => {
    activeSlide.value = (activeSlide.value + 1) % slides.length
  }, CAROUSEL_INTERVAL)
}

function stopCarousel() {
  if (!carouselTimer || typeof window === 'undefined') {
    return
  }

  window.clearInterval(carouselTimer)
  carouselTimer = null
}

function setActiveSlide(index) {
  activeSlide.value = index
  startCarousel()
}

function pauseCarousel() {
  isHovering.value = true
  stopCarousel()
}

function resumeCarousel() {
  isHovering.value = false
  startCarousel()
}

function onPointerDown(event) {
  if (event.pointerType === 'mouse' && event.button !== 0) {
    return
  }

  isPointerActive.value = true
  pointerStartX.value = event.clientX
  pointerDeltaX.value = 0
  stopCarousel()

  if (typeof event.currentTarget?.setPointerCapture === 'function') {
    event.currentTarget.setPointerCapture(event.pointerId)
  }
}

function onPointerMove(event) {
  if (!isPointerActive.value) {
    return
  }

  pointerDeltaX.value = event.clientX - pointerStartX.value
}

function onPointerUp(event) {
  finishPointerGesture(event, true)
}

function onPointerCancel(event) {
  finishPointerGesture(event, false)
}

function finishPointerGesture(event, shouldSwitch) {
  if (!isPointerActive.value) {
    return
  }

  const offset = pointerDeltaX.value
  isPointerActive.value = false
  pointerDeltaX.value = 0

  if (
    typeof event.currentTarget?.hasPointerCapture === 'function' &&
    event.currentTarget.hasPointerCapture(event.pointerId) &&
    typeof event.currentTarget.releasePointerCapture === 'function'
  ) {
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  if (shouldSwitch && Math.abs(offset) >= SWIPE_THRESHOLD) {
    activeSlide.value = resolveSlideIndex(offset < 0 ? 1 : -1)
  }

  startCarousel()
}

function resolveSlideIndex(direction) {
  return (activeSlide.value + direction + slides.length) % slides.length
}

function submitLogin() {
  emit('login', {
    username: username.value,
    password: password.value
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
.login-panel {
  --panel-ink: #11213a;
  --panel-muted: #4b5d78;
  --panel-line: rgba(18, 36, 61, 0.1);
  --panel-soft: rgba(255, 255, 255, 0.82);
  display: grid;
  grid-template-columns: minmax(0, 1.12fr) minmax(340px, 430px);
  gap: 28px;
  align-items: stretch;
}

.panel-copy,
.auth-shell {
  position: relative;
  overflow: hidden;
  border-radius: 30px;
  padding: 32px;
  background: var(--panel-soft);
  border: 1px solid var(--panel-line);
  backdrop-filter: blur(18px);
  box-shadow: 0 24px 80px rgba(29, 42, 74, 0.14);
}

.panel-copy::after,
.auth-shell::after {
  content: '';
  position: absolute;
  inset: auto -60px -70px auto;
  width: 220px;
  height: 220px;
  border-radius: 999px;
  background: radial-gradient(circle, rgba(37, 99, 235, 0.16), rgba(37, 99, 235, 0));
  pointer-events: none;
}

.copy-header {
  position: relative;
  z-index: 1;
}

.eyebrow {
  margin: 0 0 12px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: #64748b;
}

h1 {
  margin: 0;
  font-family: 'Palatino Linotype', 'Book Antiqua', 'Noto Serif SC', serif;
  font-size: clamp(2.1rem, 4vw, 3.4rem);
  line-height: 1.05;
  color: var(--panel-ink);
}

.description {
  margin: 18px 0 24px;
  font-size: 1rem;
  line-height: 1.7;
  color: var(--panel-muted);
  max-width: 34ch;
}

.hero-stage {
  position: relative;
  min-height: 380px;
  border-radius: 28px;
  overflow: hidden;
  background: #091423;
  box-shadow: 0 26px 54px rgba(8, 15, 32, 0.28);
  cursor: grab;
  touch-action: pan-y;
  user-select: none;
}

.hero-stage.dragging {
  cursor: grabbing;
}

.hero-slide {
  position: absolute;
  inset: 0;
  opacity: 0;
  transform: scale(1.04);
  transition: opacity 0.5s ease, transform 4.2s ease;
}

.hero-slide.active {
  opacity: 1;
  transform: scale(1);
}

.hero-stage.dragging .hero-slide.active {
  transform: translateX(calc(var(--drag-offset) * 0.16)) scale(1.01);
  transition: none;
}

.hero-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  -webkit-user-drag: none;
}

.hero-shade {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(9, 20, 35, 0.1) 0%, rgba(9, 20, 35, 0.72) 100%),
    radial-gradient(circle at top left, rgba(15, 118, 110, 0.3), rgba(15, 118, 110, 0));
}

.hero-copy {
  position: absolute;
  left: 26px;
  right: 26px;
  bottom: 30px;
  z-index: 1;
  color: #f8fbff;
}

.hero-copy > * {
  opacity: 0;
  transform: translateY(18px);
}

.hero-slide.active .hero-copy > * {
  animation: hero-copy-rise 0.72s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
}

.hero-slide.active .hero-copy h2 {
  animation-delay: 120ms;
}

.hero-slide.active .hero-copy p:last-child {
  animation-delay: 220ms;
}

.hero-eyebrow {
  margin: 0 0 10px;
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.76);
}

.hero-copy h2 {
  margin: 0;
  font-family: 'Palatino Linotype', 'Book Antiqua', 'Noto Serif SC', serif;
  font-size: clamp(1.6rem, 2.6vw, 2.3rem);
  line-height: 1.08;
}

.hero-copy p:last-child {
  margin: 12px 0 0;
  max-width: 32ch;
  font-size: 0.98rem;
  line-height: 1.7;
  color: rgba(248, 251, 255, 0.82);
}

.hero-dots {
  position: absolute;
  left: 24px;
  top: 24px;
  z-index: 2;
  display: inline-flex;
  gap: 8px;
}

.hero-dot {
  position: relative;
  overflow: hidden;
  width: 34px;
  height: 6px;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.28);
  cursor: pointer;
  transition: background-color 0.2s ease, transform 0.2s ease;
}

.hero-dot::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.82), #ffffff);
  transform: scaleX(0);
  transform-origin: left center;
}

.hero-dot.active {
  transform: scaleX(1.08);
}

.hero-dot.active::after {
  animation: hero-dot-progress var(--carousel-duration) linear forwards;
}

.hero-stage.paused .hero-dot.active::after {
  animation-play-state: paused;
}

.feature-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 18px;
}

.feature-pill {
  display: inline-flex;
  align-items: center;
  min-height: 38px;
  padding: 0 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(18, 36, 61, 0.08);
  color: var(--panel-ink);
  font-size: 0.9rem;
  font-weight: 700;
}

.auth-shell {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.security-note {
  position: relative;
  z-index: 1;
  padding: 18px;
  border-radius: 24px;
  background: linear-gradient(145deg, rgba(15, 118, 110, 0.08), rgba(37, 99, 235, 0.1));
  border: 1px solid rgba(37, 99, 235, 0.1);
}

.security-kicker {
  margin: 0 0 8px;
  color: #0f766e;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.security-copy {
  margin: 0;
  color: var(--panel-muted);
  line-height: 1.7;
}

.mode-switch {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding: 8px;
  border-radius: 20px;
  background: rgba(226, 232, 240, 0.52);
}

.mode-button {
  border: 0;
  border-radius: 16px;
  padding: 12px 14px;
  background: transparent;
  color: #475569;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
}

.mode-button.active {
  background: linear-gradient(135deg, rgba(15, 118, 110, 0.96), rgba(37, 99, 235, 0.92));
  color: #fff;
  box-shadow: 0 18px 42px rgba(37, 99, 235, 0.18);
}

.login-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.card-kicker {
  margin: 0 0 6px;
  color: #2563eb;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.field-label {
  font-size: 0.95rem;
  color: #334155;
}

.password-field {
  position: relative;
}

.input-field {
  width: 100%;
  border: 1px solid rgba(30, 41, 59, 0.12);
  border-radius: 16px;
  padding: 14px 50px 14px 16px;
  font-size: 1rem;
  background: #f8fafc;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
}

.input-field:focus {
  outline: none;
  border-color: rgba(37, 99, 235, 0.34);
  background: #fff;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
}

.visibility-button {
  position: absolute;
  top: 50%;
  right: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.08);
  color: #526277;
  cursor: pointer;
  transform: translateY(-50%);
  box-shadow: none;
}

.visibility-button:hover {
  transform: translateY(-50%);
  box-shadow: none;
  background: rgba(37, 99, 235, 0.14);
}

.visibility-icon {
  width: 18px;
  height: 18px;
}

.visibility-icon path,
.visibility-icon circle {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.helper-text {
  margin: 0;
  color: #64748b;
  font-size: 0.88rem;
  line-height: 1.7;
}

.action-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}

.login-button {
  border: 0;
  border-radius: 16px;
  padding: 14px 18px;
  min-width: 190px;
  font-size: 1rem;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #0f766e, #2563eb);
  cursor: pointer;
  box-shadow: 0 16px 30px rgba(37, 99, 235, 0.18);
}

.login-button:disabled,
.text-button:disabled {
  cursor: wait;
  opacity: 0.72;
}

.text-button {
  border: 0;
  padding: 0;
  background: transparent;
  color: #2563eb;
  font-size: 0.92rem;
  font-weight: 700;
  cursor: pointer;
}

.error-text {
  margin: 0;
  color: #b91c1c;
}

@keyframes hero-copy-rise {
  from {
    opacity: 0;
    transform: translateY(18px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes hero-dot-progress {
  from {
    transform: scaleX(0);
  }

  to {
    transform: scaleX(1);
  }
}

@media (max-width: 900px) {
  .login-panel {
    grid-template-columns: 1fr;
  }

  .hero-stage {
    min-height: 330px;
  }
}

@media (max-width: 640px) {
  .panel-copy,
  .auth-shell {
    padding: 24px;
  }

  .hero-stage {
    min-height: 280px;
  }

  .hero-copy {
    left: 20px;
    right: 20px;
    bottom: 22px;
  }

  .hero-dots {
    top: 18px;
    left: 18px;
  }
}
</style>