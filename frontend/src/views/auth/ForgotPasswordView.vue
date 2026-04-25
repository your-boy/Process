<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-header">
        <el-icon size="48" color="#409EFF"><Connection /></el-icon>
        <h1>找回密码</h1>
        <p>输入注册邮箱，我们将发送重置链接</p>
      </div>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        v-if="!sent"
      >
        <el-form-item label="邮箱" prop="email">
          <el-input
            v-model="form.email"
            placeholder="请输入注册邮箱"
            size="large"
            prefix-icon="Message"
            clearable
          />
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            size="large"
            :loading="loading"
            class="submit-btn"
            @click="handleSubmit"
          >
            发送重置邮件
          </el-button>
        </el-form-item>
      </el-form>

      <div v-else class="success-msg">
        <el-result
          icon="success"
          title="邮件已发送"
          sub-title="请查收您的邮箱，点击邮件中的链接重置密码"
        />
      </div>

      <div class="auth-links">
        <router-link to="/login">返回登录</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { authAPI } from '../../api/auth'
import { ElMessage } from 'element-plus'

const formRef = ref(null)
const loading = ref(false)
const sent = ref(false)

const form = reactive({ email: '' })

const rules = {
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入有效的邮箱地址', trigger: 'blur' }
  ]
}

async function handleSubmit() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  loading.value = true
  try {
    await authAPI.forgotPassword(form.email)
    sent.value = true
  } catch {
    // handled by interceptor
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.auth-card {
  width: 400px;
  background: #fff;
  border-radius: 16px;
  padding: 40px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.auth-header {
  text-align: center;
  margin-bottom: 32px;
}

.auth-header h1 {
  font-size: 24px;
  color: #303133;
  margin-top: 12px;
  margin-bottom: 4px;
}

.auth-header p {
  color: #909399;
  font-size: 14px;
}

.submit-btn {
  width: 100%;
  height: 44px;
  font-size: 16px;
}

.auth-links {
  text-align: center;
  margin-top: 16px;
}

.auth-links a {
  color: #409EFF;
  text-decoration: none;
  font-size: 14px;
}
</style>
