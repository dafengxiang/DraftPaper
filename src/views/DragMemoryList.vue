<template>
  <div class="drag-memory-list">
    <div class="header">
      <h3>拖拽记忆</h3>
      <div class="actions">
        <button
          class="btn btn-primary"
          :class="{
            'btn-success': summaryStatus === 'success',
            'btn-error': summaryStatus === 'error',
          }"
          @click="generateSummary"
          :disabled="memoryItems.length === 0"
        >
          {{
            summaryStatus === 'success'
              ? '✓ 已复制'
              : summaryStatus === 'error'
                ? '✗ 失败'
                : '生成汇总'
          }}
        </button>
        <button class="btn btn-danger" @click="clearAll" :disabled="memoryItems.length === 0">
          清空全部
        </button>
      </div>
    </div>

    <div class="memory-content">
      <div v-if="memoryItems.length === 0" class="empty-state">
        <p>暂无拖拽记忆</p>
        <p class="hint">拖拽页面元素后，记忆会自动保存</p>
      </div>

      <div v-else class="memory-items">
        <div v-for="item in memoryItems" :key="item.id" class="memory-item">
          <div class="item-info">
            <div class="selector">{{ item.selector }}</div>
            <div class="description">{{ item.description || '无描述' }}</div>
            <div class="position">
              <span class="position-item">top: {{ item.top }}px</span>
              <span class="position-item">left: {{ item.left }}px</span>
            </div>
            <div class="timestamp">{{ formatTime(item.timestamp) }}</div>
          </div>
          <div class="item-actions">
            <button class="btn btn-small btn-danger" @click="removeItem(item.id)" title="删除">
              ×
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import type { DragMemoryItem } from '@/types'
import { generateDragMemoryDbKey } from '@/utils/helpers'
import { APP_CONFIG } from '@/config/constants'

// 响应式数据
const memoryItems = ref<DragMemoryItem[]>([])
const isLoading = ref(false)
const summaryStatus = ref<'idle' | 'success' | 'error'>('idle')

// 计算属性
const hasItems = computed(() => memoryItems.value.length > 0)

/**
 * 加载拖拽记忆
 */
const loadDragMemory = async (): Promise<void> => {
  try {
    isLoading.value = true

    if (!window.$currentTab?.id) {
      console.warn('[DraftPaper] 无法获取当前标签页信息')
      return
    }

    const message = {
      type: 'GET_DRAG_MEMORY' as const,
      payload: {
        dbKey: generateDragMemoryDbKey(new URL(window.$currentUrl!)),
      },
    }

    chrome.tabs.sendMessage(window.$currentTab.id, message, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('[DraftPaper] 加载拖拽记忆失败:', chrome.runtime.lastError.message)
      } else if (response?.success && response.dragMemory) {
        try {
          const dragMemory = JSON.parse(response.dragMemory)
          memoryItems.value = dragMemory.items || []
        } catch (parseError) {
          console.warn('[DraftPaper] 解析拖拽记忆失败:', parseError)
        }
      }
      isLoading.value = false
    })
  } catch (error) {
    console.error('[DraftPaper] 加载拖拽记忆失败:', error)
    isLoading.value = false
  }
}

/**
 * 删除记忆项
 */
const removeItem = async (memoryId: string): Promise<void> => {
  try {
    if (!window.$currentTab?.id) return

    const message = {
      type: 'REMOVE_DRAG_MEMORY' as const,
      payload: { memoryId },
    }

    chrome.tabs.sendMessage(window.$currentTab.id, message, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('[DraftPaper] 删除拖拽记忆失败:', chrome.runtime.lastError.message)
      } else if (response?.success) {
        // 从本地列表中移除
        memoryItems.value = memoryItems.value.filter((item) => item.id !== memoryId)
      }
    })
  } catch (error) {
    console.error('[DraftPaper] 删除拖拽记忆失败:', error)
  }
}

/**
 * 清空所有记忆
 */
const clearAll = async (): Promise<void> => {
  try {
    if (!window.$currentTab?.id) return

    // 直接清空，不需要二次确认
    const message = {
      type: 'CLEAR_DRAG_MEMORY' as const,
      payload: {},
    }

    chrome.tabs.sendMessage(window.$currentTab.id, message, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('[DraftPaper] 清空拖拽记忆失败:', chrome.runtime.lastError.message)
      } else if (response?.success) {
        memoryItems.value = []
      }
    })
  } catch (error) {
    console.error('[DraftPaper] 清空拖拽记忆失败:', error)
  }
}

/**
 * 生成汇总代码
 */
const generateSummary = async (): Promise<void> => {
  try {
    if (memoryItems.value.length === 0) {
      console.warn('[DraftPaper] 没有拖拽记忆可生成汇总')
      summaryStatus.value = 'error'
      setTimeout(() => {
        summaryStatus.value = 'idle'
      }, 2000)
      return
    }

    summaryStatus.value = 'idle'
    const memoryList = memoryItems.value
      .map((item) => {
        // item.top and item.left are already scaled (divided by widthRatio)
        return `- ${item.selector}: 下移${item.top}px，右移${item.left}px`
      })
      .join('\n')

    const summaryCode = APP_CONFIG.defaultMemoryTemplate.replace('{memoryList}', memoryList)

    try {
      await navigator.clipboard.writeText(summaryCode)
      console.log('✅ 拖拽记忆汇总已复制到剪贴板')
      summaryStatus.value = 'success'
      setTimeout(() => {
        summaryStatus.value = 'idle'
      }, 2000)
    } catch (clipboardError) {
      console.error('[DraftPaper] 复制到剪贴板失败:', clipboardError)
      summaryStatus.value = 'error'
      setTimeout(() => {
        summaryStatus.value = 'idle'
      }, 2000)
    }
  } catch (error) {
    console.error('[DraftPaper] 生成汇总失败:', error)
    summaryStatus.value = 'error'
    setTimeout(() => {
      summaryStatus.value = 'idle'
    }, 2000)
  }
}

/**
 * 格式化时间
 */
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// 组件挂载时加载数据
onMounted(() => {
  loadDragMemory()
})
</script>

<style scoped lang="less">
.drag-memory-list {
  padding: 16px;
  background: #1a1a1a;
  border-radius: 8px;
  margin: 8px 0;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;

  h3 {
    margin: 0;
    font-size: 16px;
    color: #fff;
  }

  .actions {
    display: flex;
    gap: 8px;
  }
}

.memory-content {
  max-height: 300px;
  overflow-y: auto;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #888;

  .hint {
    font-size: 12px;
    margin-top: 8px;
  }
}

.memory-items {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.memory-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 12px;
  background: #2a2a2a;
  border-radius: 6px;
  border: 1px solid #333;

  .item-info {
    flex: 1;

    .selector {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      color: #4caf50;
      margin-bottom: 4px;
      word-break: break-all;
    }

    .description {
      font-size: 12px;
      color: #ccc;
      margin-bottom: 4px;
    }

    .position {
      display: flex;
      gap: 12px;
      margin-bottom: 4px;

      .position-item {
        font-size: 11px;
        color: #888;
        background: #333;
        padding: 2px 6px;
        border-radius: 3px;
      }
    }

    .timestamp {
      font-size: 10px;
      color: #666;
    }
  }

  .item-actions {
    margin-left: 12px;
  }
}

.btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s ease;

  &.btn-primary {
    background: #2563eb;
    color: #fff;

    &:hover:not(:disabled) {
      background: #1d4ed8;
    }
  }

  &.btn-danger {
    background: #dc2626;
    color: #fff;

    &:hover:not(:disabled) {
      background: #b91c1c;
    }
  }

  &.btn-success {
    background: #16a34a;
    color: #fff;
  }

  &.btn-error {
    background: #dc2626;
    color: #fff;
  }

  &.btn-small {
    padding: 4px 8px;
    font-size: 10px;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

/* 滚动条样式 */
.memory-content::-webkit-scrollbar {
  width: 4px;
}

.memory-content::-webkit-scrollbar-track {
  background: #333;
  border-radius: 2px;
}

.memory-content::-webkit-scrollbar-thumb {
  background: #666;
  border-radius: 2px;
}

.memory-content::-webkit-scrollbar-thumb:hover {
  background: #888;
}
</style>
