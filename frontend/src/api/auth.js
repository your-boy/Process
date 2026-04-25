import request from '../utils/request'

export const authAPI = {
  login: (data) => request.post('/auth/login', data),
  forgotPassword: (email) => request.post('/auth/forgot-password', { email }),
  resetPassword: (data) => request.post('/auth/reset-password', data),
  updatePassword: (data) => request.put('/auth/password', data),
  getUserInfo: () => request.get('/auth/me')
}
