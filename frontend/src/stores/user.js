import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authAPI } from '../api/auth'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('token') || '')
  const userInfo = ref(JSON.parse(localStorage.getItem('userInfo') || 'null'))

  const isLoggedIn = computed(() => !!token.value)

  function setToken(newToken) {
    token.value = newToken
    localStorage.setItem('token', newToken)
  }

  function setUserInfo(info) {
    userInfo.value = info
    localStorage.setItem('userInfo', JSON.stringify(info))
  }

  async function login(credentials) {
    const res = await authAPI.login(credentials)
    setToken(res.data.token)
    setUserInfo(res.data.user)
    return res
  }

  async function logout() {
    token.value = ''
    userInfo.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('userInfo')
  }

  async function updatePassword(data) {
    return await authAPI.updatePassword(data)
  }

  return { token, userInfo, isLoggedIn, login, logout, setToken, setUserInfo, updatePassword }
})
