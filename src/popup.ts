/**
 * @description Popup 入口文件
 * @author wangfengxiang
 * @date 2024-05-11
 */

import { createApp } from 'vue'
import { createErrorHandler } from '@/utils/helpers'
import '@/mixin.less'

const errorHandler = createErrorHandler('Popup')

/**
 * 初始化弹窗应用
 */
async function initPopupApp(): Promise<void> {
  try {
    // 获取当前活动标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

    if (!tab || !tab.url) {
      throw new Error('无法获取当前标签页信息')
    }

    // 验证URL是否有效
    let currentUrl: URL
    try {
      currentUrl = new URL(tab.url)
    } catch (error) {
      throw new Error('当前页面URL无效')
    }

    // 检查是否为支持的协议
    if (!['http:', 'https:'].includes(currentUrl.protocol)) {
      throw new Error('当前页面不支持使用此扩展（仅支持 http/https 协议）')
    }

    // 设置全局变量（类型安全）
    window.$currentTab = tab
    window.$currentUrl = currentUrl

    // 动态导入App组件
    const { default: App } = await import('@/views/App.vue')

    if (!App) {
      throw new Error('无法加载应用组件')
    }

    // 创建Vue应用
    const app = createApp(App)

    // 全局错误处理
    app.config.errorHandler = (err, _instance, info) => {
      errorHandler(new Error(`Vue error: ${err} - ${info}`))
    }

    // 挂载应用
    const mountElement = document.getElementById('app')
    if (!mountElement) {
      throw new Error('无法找到挂载点 #app')
    }

    app.mount(mountElement)

    // eslint-disable-next-line no-console
    console.log('DraftPaper popup 应用已启动')
  } catch (error) {
    errorHandler(error as Error)

    // 显示错误信息给用户
    showErrorMessage((error as Error).message)
  }
}

/**
 * 显示错误信息
 * @param message - 错误信息
 */
function showErrorMessage(message: string): void {
  const appElement = document.getElementById('app')
  if (appElement) {
    appElement.innerHTML = `
      <div style="
        padding: 20px; 
        text-align: center; 
        color: #fff; 
        background: #333;
        font-size: 14px;
        line-height: 1.5;
      ">
        <h3 style="color: #ff6b6b; margin-bottom: 10px;">⚠️ 错误</h3>
        <p style="margin: 0;">${message}</p>
        <p style="margin: 10px 0 0 0; font-size: 12px; color: #999;">
          请刷新页面或联系开发者
        </p>
      </div>
    `
  }
}

// 全局错误处理
window.addEventListener('error', (event) => {
  errorHandler(new Error(`Global error: ${event.error?.message || event.message}`))
})

window.addEventListener('unhandledrejection', (event) => {
  errorHandler(new Error(`Unhandled promise rejection: ${event.reason}`))
})

// 初始化应用
initPopupApp()
