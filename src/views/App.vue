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
      <h3 class="title"></h3>
      <div class="controls">
        <button
          v-if="!isLoading"
          class="d-handle-btn"
          :class="{ disabled: !draftsInfo.isCanPick }"
          :title="draftsInfo.isCanPick ? '点击关闭拖拽模式' : '点击开启拖拽模式'"
          @click="handleTogglePick()"
        ></button>
        <!-- <button
          v-if="!isLoading && hasDraft"
          class="d-color-picker-btn"
          :class="{ active: isColorPickerActive }"
          :title="isColorPickerActive ? '关闭取色器' : '开启取色器'"
          @click="toggleColorPicker"
        ></button> -->
        <button
          class="d-ai-btn"
          :class="{ active: isAI && !isSetting }"
          :title="isAI ? '退出AI检测' : '打开AI检测'"
          @click="onToggleAI()"
        ></button>

        <button class="d-review-btn" title="线上UI审查" @click="openReviewPage"></button>

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
      <AICheckBox v-else-if="isAI" />
      <template v-else>
        <!-- 草稿列表 -->
        <DraftList />
        <!-- 控制面板 -->
        <ControlBox :is-color-picker-active="isColorPickerActive" />
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted, onMounted } from 'vue'
import type { ChromeMessage, MessageType } from '@/types'
import { openDB, closeDB } from '@/utils/database'
import { useDrafts } from '@/hooks/useDrafts'
import { generateDbKey, debounce, createErrorHandler } from '@/utils/helpers'
import { DEBOUNCE_DELAY } from '@/config/constants'

import DraftList from './DraftList.vue'
import ControlBox from './ControlBox.vue'
import SettingBox from './SettingBox.vue'
import AICheckBox from './AICheckBox.vue'

const errorHandler = createErrorHandler('App')

// 组件状态
const isSetting = ref(false)
const isAI = ref(false)

function onToggleAI(): void {
  // 打开AI面板并关闭拖拽
  isAI.value = true
  isSetting.value = false
}

function openReviewPage(): void {
  try {
    const url = chrome.runtime.getURL('review.html')
    chrome.tabs.create({ url })
    window.close()
  } catch (error) {
    errorHandler(error as Error)
  }
}

function handleTogglePick(): void {
  draftsInfo.value.isCanPick = !draftsInfo.value.isCanPick
  isSetting.value = false
  isAI.value = false
}

const isLoading = ref(true)
const errorMessage = ref('')
const isColorPickerActive = ref(false)

// 草稿数据管理
const { draftsInfo, initDrafts, updateDraftsDB } = useDrafts()

/**
 * 是否有草稿
 */
const hasDraft = computed((): boolean => {
  return !!(draftsInfo.value?.list && draftsInfo.value.list.length > 0)
})

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
        dbKey: generateDbKey(new URL(window.$currentUrl!)),
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
 * 同步取色器状态
 */
const syncColorPickerState = async (): Promise<void> => {
  try {
    if (!window.$currentTab?.id) {
      console.log('[DraftPaper] No current tab, skipping color picker state sync')
      return
    }

    // 先检查内容脚本是否可用
    const isContentScriptReady = await checkContentScriptAvailable()
    if (!isContentScriptReady) {
      console.log('[DraftPaper] Content script not ready, skipping color picker state sync')
      return
    }

    const message = {
      type: 'GET_COLOR_PICKER_STATE' as const,
      payload: {},
    }

    chrome.tabs.sendMessage(window.$currentTab.id, message, (response) => {
      if (chrome.runtime.lastError) {
        const errorMsg = chrome.runtime.lastError.message
        console.log('[DraftPaper] Color picker state sync failed (non-critical):', errorMsg)
        // 不显示错误消息，因为这是非关键操作
      } else if (response && response.success) {
        isColorPickerActive.value = response.isActive || false
        console.log('[DraftPaper] Color picker state synced:', response)
      }
    })
  } catch (error) {
    console.log('[DraftPaper] Color picker state sync error (non-critical):', error)
    // 不显示错误消息，因为这是非关键操作
  }
}

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

    // 同步取色器状态（非关键操作，失败不影响应用启动）
    syncColorPickerState().catch((error) => {
      console.log('[DraftPaper] Color picker state sync failed during init (non-critical):', error)
    })

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

    const currentDbKey = generateDbKey(new URL(window.$currentUrl!))

    if (request.payload.dbKey !== currentDbKey) {
      // eslint-disable-next-line no-console
      console.log('URL已变化，关闭弹窗')
      window.close()
    }
  } catch (error) {
    errorHandler(error as Error)
  }
}

/**
 * 检查内容脚本是否可用
 */
const checkContentScriptAvailable = async (): Promise<boolean> => {
  try {
    if (!window.$currentTab?.id) return false

    // 发送一个简单的ping消息来检查内容脚本是否响应
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(window.$currentTab!.id!, { type: 'PING' }, (_response) => {
        if (chrome.runtime.lastError) {
          resolve(false)
        } else {
          resolve(true)
        }
      })
    })
  } catch {
    return false
  }
}

/**
 * 切换取色器状态
 */
const toggleColorPicker = async (): Promise<void> => {
  try {
    // 检查内容脚本是否可用
    const isContentScriptReady = await checkContentScriptAvailable()
    if (!isContentScriptReady) {
      errorMessage.value = '内容脚本未加载，请刷新页面后重试'
      return
    }

    isColorPickerActive.value = !isColorPickerActive.value

    // 发送消息到内容脚本
    if (window.$currentTab?.id) {
      const currentDraft = draftsInfo.value?.list?.[draftsInfo.value.selectedIdx || 0]
      const message = {
        type: 'TOGGLE_COLOR_PICKER' as const,
        payload: {
          isActive: isColorPickerActive.value,
          opacity: isColorPickerActive.value ? 1 : currentDraft?.opacity || 1,
        },
      }

      chrome.tabs.sendMessage(window.$currentTab.id, message, (response) => {
        if (chrome.runtime.lastError) {
          const errorMsg = chrome.runtime.lastError.message
          console.error('Failed to toggle color picker:', errorMsg)

          // 如果是连接错误，显示用户友好的提示
          if (
            errorMsg &&
            (errorMsg.includes('Could not establish connection') ||
              errorMsg.includes('Receiving end does not exist'))
          ) {
            errorMessage.value = '内容脚本连接失败，请刷新页面后重试'
            // 重置取色器状态
            isColorPickerActive.value = false
          }
        } else if (response && !response.success) {
          errorMessage.value = '取色器操作失败，请重试'
          isColorPickerActive.value = false
        }
      })
    } else {
      errorMessage.value = '无法获取当前标签页信息'
      isColorPickerActive.value = false
    }
  } catch (error) {
    errorHandler(error as Error)
    errorMessage.value = '取色器操作失败，请重试'
    isColorPickerActive.value = false
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
    width: 160px;
    height: 32px;
    background: url('../icons/title.png') no-repeat center / contain;
  }

  .controls {
    display: flex;
    gap: 8px;
  }

  .d-handle-btn,
  .d-color-picker-btn,
  .d-ai-btn,
  .d-review-btn,
  .d-setting-btn {
    .square(22px);
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;

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

  .d-color-picker-btn {
    background: url('../icons/color_disabled.png') no-repeat center / contain;

    &.active {
      background-image: url('../icons/color.png');
    }
  }

  .d-ai-btn {
    background: url('../icons/ai_disabled.png') no-repeat center / contain;

    &.active {
      background-image: url('../icons/ai.png');
    }
  }

  .d-review-btn {
    background: url('../icons/review.png') no-repeat center / contain;
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
