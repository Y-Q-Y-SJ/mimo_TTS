import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Config from '../views/Config.vue'
import Task from '../views/Task.vue'

const routes = [
  { path: '/', name: 'Home', component: Home },
  { path: '/config/:bookId', name: 'Config', component: Config, props: true },
  { path: '/task/:taskId', name: 'Task', component: Task, props: true },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
