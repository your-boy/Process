import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '../stores/user'

const routes = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/auth/LoginView.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/forgot-password',
    name: 'ForgotPassword',
    component: () => import('../views/auth/ForgotPasswordView.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/reset-password',
    name: 'ResetPassword',
    component: () => import('../views/auth/ResetPasswordView.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    component: () => import('../components/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('../views/DashboardView.vue')
      },
      {
        path: 'flowchart',
        name: 'Flowchart',
        component: () => import('../views/flowchart/FlowchartView.vue')
      },
      {
        path: 'flowchart/:id',
        name: 'FlowchartEdit',
        component: () => import('../views/flowchart/FlowchartEditorView.vue')
      },
      {
        path: 'mindmap',
        name: 'Mindmap',
        component: () => import('../views/mindmap/MindmapView.vue')
      },
      {
        path: 'mindmap/:id',
        name: 'MindmapEdit',
        component: () => import('../views/mindmap/MindmapEditorView.vue')
      },
      {
        path: 'markdown',
        name: 'Markdown',
        component: () => import('../views/markdown/MarkdownView.vue')
      },
      {
        path: 'markdown/:id',
        name: 'MarkdownEdit',
        component: () => import('../views/markdown/MarkdownEditorView.vue')
      },
      {
        path: 'notes',
        name: 'Notes',
        component: () => import('../views/notes/NotesView.vue')
      },
      {
        path: 'profile',
        name: 'Profile',
        component: () => import('../views/auth/ProfileView.vue')
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const userStore = useUserStore()
  const requiresAuth = to.meta.requiresAuth !== false

  if (requiresAuth && !userStore.isLoggedIn) {
    next('/login')
  } else if (!requiresAuth && userStore.isLoggedIn && ['/login', '/forgot-password', '/reset-password'].includes(to.path)) {
    next('/dashboard')
  } else {
    next()
  }
})

export default router
