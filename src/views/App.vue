<!--
 * @Description: popup弹窗主文件
 * @Author: wangfengxiang
 * @Date: 2024-05-10 14:26:24
 * @LastEditTime: 2024-07-03 16:45:40
 * @LastEditors: wangfengxiang
-->
<template>
  <div class="m-extension-popup">
    <!-- 标题栏 -->
    <header class="header">
      <h3 class="title">DraftPaper</h3>
      <div class="controls">
        <button
          v-if="!isLoading"
          class="d-handle-btn"
          :class="{ disabled: !draftsInfo.isCanPick }"
          :title="draftsInfo.isCanPick ? '点击关闭拖拽模式' : '点击开启拖拽模式'"
          @click="draftsInfo.isCanPick = !draftsInfo.isCanPick"
        ></button>
        <button
          class="d-setting-btn"
          :class="{ disabled: !isSetting }"
          :title="isSetting ? '退出设置' : '打开设置'"
          @click="isSetting = !isSetting"
        ></button>
      </div>
    </header>

    <!-- 错误信息 -->
    <div v-if="errorMessage" class="error-message">
      <span>{{ errorMessage }}</span>
      <button @click="errorMessage = ''" class="close-btn">×</button>
    </div>

    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading">
      <div class="loading-spinner"></div>
      <p>加载中...</p>
    </div>

    <!-- 主要内容 -->
    <main v-else class="main-content">
      <!-- 设置面板 -->
      <SettingBox v-if="isSetting" />
      <template v-else>
        <!-- 草稿列表 -->
        <DraftList />
        <!-- 控制面板 -->
        <ControlBox />
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted, onMounted } from 'vue'
import type { ChromeMessage, MessageType } from '@/types'
import { openDB, closeDB } from '@/utils/database'
import { useDrafts } from '@/hooks/useDrafts'
import { generateDbKey, debounce, createErrorHandler } from '@/utils/helpers'
import { DEBOUNCE_DELAY } from '@/config/constants'

import DraftList from './DraftList.vue'
import ControlBox from './ControlBox.vue'
import SettingBox from './SettingBox.vue'

const errorHandler = createErrorHandler('App')

// 组件状态
const isSetting = ref(false)
const isLoading = ref(true)
const errorMessage = ref('')

// 草稿数据管理
const { draftsInfo, initDrafts, updateDraftsDB } = useDrafts()

/**
 * 发送草稿更新消息到内容脚本（带重试机制）
 */
const sendDraftsUpdate = debounce(async () => {
  try {
    if (!window.$currentTab?.id || !window.$currentUrl) {
      throw new Error('当前标签页信息不可用')
    }

    // 检查标签页状态
    const tab = await chrome.tabs.get(window.$currentTab.id)
    if (!tab || tab.status !== 'complete') {
      // eslint-disable-next-line no-console
      console.log('标签页尚未完全加载，跳过消息发送')
      return
    }

    const message: ChromeMessage = {
      type: 'UPDATE_DRAFTS' as MessageType,
      payload: {
        dbKey: generateDbKey(window.$currentUrl),
        draftsInfo: JSON.stringify(draftsInfo.value),
      },
    }

    // 带重试的消息发送
    await sendMessageWithRetry(window.$currentTab.id, message)
  } catch (error) {
    // 静默处理连接错误，避免干扰用户
    if ((error as Error).message.includes('Could not establish connection')) {
      // eslint-disable-next-line no-console
      console.log('Content script 暂未准备就绪，将在下次更新时重试')
    } else {
      errorHandler(error as Error)
    }
  }
}, DEBOUNCE_DELAY)

/**
 * 带重试机制的消息发送
 * @param tabId - 标签页ID
 * @param message - 消息内容
 * @param maxRetries - 最大重试次数
 */
async function sendMessageWithRetry(
  tabId: number,
  message: ChromeMessage,
  maxRetries: number = 3
): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await new Promise<void>((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, message, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            // eslint-disable-next-line no-console
            console.log('草稿信息已更新')
            resolve()
          }
        })
      })
      return // 成功发送，退出重试循环
    } catch (error) {
      const errorMessage = (error as Error).message

      if (attempt === maxRetries) {
        throw error // 最后一次重试失败，抛出错误
      }

      // 只对连接问题进行重试
      if (errorMessage.includes('Could not establish connection')) {
        // eslint-disable-next-line no-console
        console.log(`第${attempt}次发送失败，${500 * attempt}ms后重试...`)
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt))
      } else {
        throw error // 其他类型错误不重试
      }
    }
  }
}

/**
 * 处理数据库更新
 */
const handleDatabaseUpdate = debounce(async () => {
  try {
    await updateDraftsDB()
    await sendDraftsUpdate()
  } catch (error) {
    errorHandler(error as Error)
    errorMessage.value = '保存草稿失败，请重试'
  }
}, DEBOUNCE_DELAY)

/**
 * 初始化应用
 */
const initializeApp = async (): Promise<void> => {
  try {
    isLoading.value = true
    errorMessage.value = ''

    // 打开数据库
    await openDB()

    // 初始化草稿数据
    await initDrafts()

    isLoading.value = false
  } catch (error) {
    errorHandler(error as Error)
    errorMessage.value = '应用初始化失败'
    isLoading.value = false
  }
}

/**
 * 处理URL变化
 */
const handleUrlChange = (request: ChromeMessage): void => {
  try {
    if (!window.$currentUrl) {
      return
    }

    const currentDbKey = generateDbKey(window.$currentUrl)

    if (request.payload.dbKey !== currentDbKey) {
      // eslint-disable-next-line no-console
      console.log('URL已变化，关闭弹窗')
      window.close()
    }
  } catch (error) {
    errorHandler(error as Error)
  }
}

// 监听草稿信息变化
watch(draftsInfo, handleDatabaseUpdate, { deep: true })

// 监听来自background的消息
chrome.runtime.onMessage.addListener((request: ChromeMessage) => {
  try {
    if (request.type === 'URL_CHANGE') {
      handleUrlChange(request)
    }
  } catch (error) {
    errorHandler(error as Error)
  }
  return true
})

// 组件生命周期
onMounted(initializeApp)
onUnmounted(() => {
  try {
    closeDB()
  } catch (error) {
    errorHandler(error as Error)
  }
})
</script>

<style lang="less" scoped>
@import '../mixin.less';

.m-extension-popup {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  background: #333;
  color: #fff;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  border-bottom: 1px solid #555;
  flex-shrink: 0;

  .title {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
    color: #fff;
  }

  .controls {
    display: flex;
    gap: 8px;
  }

  .d-handle-btn,
  .d-setting-btn {
    .square(25px);
    border: none;
    cursor: pointer;
    transition: opacity 0.2s ease;

    &:hover {
      opacity: 0.8;
    }

    &:active {
      transform: scale(0.9);
    }
  }

  .d-handle-btn {
    background: url('../icons/pick.png') no-repeat center / contain;

    &.disabled {
      background-image: url('../icons/pick_disabled.png');
    }
  }

  .d-setting-btn {
    background: url('../icons/setting.png') no-repeat center / contain;

    &.disabled {
      background-image: url('../icons/setting_disabled.png');
    }
  }
}

.error-message {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  background: #ff4757;
  color: #fff;
  font-size: 12px;
  flex-shrink: 0;

  .close-btn {
    background: none;
    border: none;
    color: #fff;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    padding: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
      opacity: 0.8;
    }
  }
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  flex: 1;

  .loading-spinner {
    width: 24px;
    height: 24px;
    border: 2px solid #555;
    border-top: 2px solid #fff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 10px;
  }

  p {
    margin: 0;
    font-size: 14px;
    color: #ccc;
  }
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.main-content {
  flex: 1;
  padding: 10px;
  overflow-y: auto;
}
</style>
