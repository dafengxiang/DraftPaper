/**
 * @description Background Script - Service Worker
 * @author wangfengxiang
 * @date 2024-05-11
 */

import type { ChromeMessage, ChromeResponse, MessageType } from '@/types'
import { openDB, getDataByKey } from '@/utils/database'
import { createErrorHandler } from '@/utils/helpers'

const errorHandler = createErrorHandler('Background')

// eslint-disable-next-line no-console
console.log('DraftPaper background script is running')

/**
 * 处理获取草稿信息请求
 * @param request - 请求消息
 * @param sendResponse - 响应函数
 */
async function handleGetDrafts(
  request: ChromeMessage,
  sendResponse: (response: ChromeResponse) => void
): Promise<void> {
  try {
    await openDB(true)
    const data = await getDataByKey(request.payload.dbKey)
    const draftsInfo = data?.val || ''

    sendResponse({
      draftsInfo,
      success: true,
    })
  } catch (error) {
    errorHandler(error as Error)
    sendResponse({
      success: false,
      error: (error as Error).message,
    })
  }
}

/**
 * 处理URL变化通知
 * @param request - 请求消息
 * @param sendResponse - 响应函数
 */
function handleUrlChange(
  request: ChromeMessage,
  sendResponse: (response: ChromeResponse) => void
): void {
  try {
    // eslint-disable-next-line no-console
    console.log('URL changed:', request.payload.dbKey)
    sendResponse({
      success: true,
    })
  } catch (error) {
    errorHandler(error as Error)
    sendResponse({
      success: false,
      error: (error as Error).message,
    })
  }
}

// 监听消息
chrome.runtime.onMessage.addListener((request: ChromeMessage, _sender, sendResponse) => {
  try {
    const { type } = request

    switch (type) {
      case 'GET_DRAFTS' as MessageType:
        handleGetDrafts(request, sendResponse)
        break

      case 'URL_CHANGE' as MessageType:
        handleUrlChange(request, sendResponse)
        break

      default:
        // eslint-disable-next-line no-console
        console.warn('Unknown message type:', type)
        sendResponse({
          success: false,
          error: 'Unknown message type',
        })
    }
  } catch (error) {
    errorHandler(error as Error)
    sendResponse({
      success: false,
      error: (error as Error).message,
    })
  }

  // 返回true表示异步响应
  return true
})

// 扩展安装或启动时的初始化
chrome.runtime.onInstalled.addListener((details) => {
  // eslint-disable-next-line no-console
  console.log('DraftPaper installed/updated:', details.reason)

  if (details.reason === 'install') {
    // eslint-disable-next-line no-console
    console.log('First time installation')
  } else if (details.reason === 'update') {
    // eslint-disable-next-line no-console
    console.log('Extension updated')
  }
})

// 扩展启动时
chrome.runtime.onStartup.addListener(() => {
  // eslint-disable-next-line no-console
  console.log('DraftPaper extension started')
})

// 处理未捕获的错误
self.addEventListener('error', (event) => {
  errorHandler(new Error(`Global error: ${event.error?.message || event.message}`))
})

// 处理未处理的Promise拒绝
self.addEventListener('unhandledrejection', (event) => {
  errorHandler(new Error(`Unhandled promise rejection: ${event.reason}`))
  event.preventDefault()
})
