/**
 * @description 草稿数据管理 Hook
 * @author wangfengxiang
 * @date 2024-05-10
 */

import { ref, type Ref } from 'vue'
import type { DraftsInfo, DatabaseItem } from '@/types'
import { getDataByKey, addData, updateDB } from '@/utils/database'
import { generateDbKey, createErrorHandler } from '@/utils/helpers'
import { APP_CONFIG } from '@/config/constants'

const errorHandler = createErrorHandler('useDrafts')

// 全局状态
const draftsInfo: Ref<DraftsInfo> = ref({
  selectedIdx: 0,
  isCanPick: false,
  templateCode: APP_CONFIG.defaultTemplate,
  list: [],
})

let hasDBInfo = false
let dbKey = ''

/**
 * 草稿管理 Hook
 * @returns 草稿管理相关方法和状态
 */
export function useDrafts() {
  /**
   * 初始化草稿数据
   */
  const initDrafts = async (): Promise<void> => {
    try {
      // 确保有当前URL信息
      if (!window.$currentUrl) {
        throw new Error('当前URL信息不可用')
      }

      // 生成数据库键
      dbKey = generateDbKey(window.$currentUrl)

      // 从数据库获取数据
      const res = await getDataByKey(dbKey)
      hasDBInfo = !!res

      if (res) {
        // 解析已存在的数据
        try {
          const parsedData: DraftsInfo = JSON.parse(res.val)

          // 验证数据结构
          if (!validateDraftsInfo(parsedData)) {
            throw new Error('数据格式无效')
          }

          draftsInfo.value = parsedData
        } catch (parseError) {
          errorHandler(new Error(`数据解析失败: ${parseError}`))
          draftsInfo.value = createDefaultDraftsInfo()
        }
      } else {
        // 创建默认数据
        draftsInfo.value = createDefaultDraftsInfo()
      }
    } catch (error) {
      errorHandler(error as Error)
      // 使用默认数据作为降级方案
      draftsInfo.value = createDefaultDraftsInfo()
    }
  }

  /**
   * 更新数据库中的草稿信息
   */
  const updateDraftsDB = async (): Promise<void> => {
    try {
      if (!dbKey) {
        throw new Error('数据库键未初始化')
      }

      // 验证数据
      if (!validateDraftsInfo(draftsInfo.value)) {
        throw new Error('草稿数据格式无效')
      }

      const data: DatabaseItem = {
        url_path: dbKey,
        val: JSON.stringify(draftsInfo.value),
      }

      // 根据是否有现有数据选择添加或更新
      if (hasDBInfo) {
        await updateDB(data)
      } else {
        await addData(data)
        hasDBInfo = true
      }
    } catch (error) {
      errorHandler(error as Error)
      throw error // 重新抛出错误让调用者知道操作失败
    }
  }

  /**
   * 添加新草稿
   * @param imageData - 图片数据
   */
  const addDraft = (imageData: string): void => {
    try {
      if (!imageData || !imageData.startsWith('data:image/')) {
        throw new Error('无效的图片数据')
      }

      const newDraft = {
        pic: imageData,
        ...APP_CONFIG.defaultDraft,
      }

      draftsInfo.value.list.push(newDraft)
      draftsInfo.value.selectedIdx = draftsInfo.value.list.length - 1
    } catch (error) {
      errorHandler(error as Error)
      throw error
    }
  }

  /**
   * 删除草稿
   * @param index - 要删除的草稿索引
   */
  const deleteDraft = (index: number): void => {
    try {
      if (index < 0 || index >= draftsInfo.value.list.length) {
        throw new Error('无效的草稿索引')
      }

      draftsInfo.value.list.splice(index, 1)

      // 调整选中索引
      if (draftsInfo.value.selectedIdx >= index) {
        draftsInfo.value.selectedIdx = Math.max(0, draftsInfo.value.selectedIdx - 1)
      }

      // 如果删除了所有草稿，重置选中索引
      if (draftsInfo.value.list.length === 0) {
        draftsInfo.value.selectedIdx = 0
      }
    } catch (error) {
      errorHandler(error as Error)
      throw error
    }
  }

  return {
    draftsInfo,
    initDrafts,
    updateDraftsDB,
    addDraft,
    deleteDraft,
  }
}

/**
 * 创建默认草稿信息
 * @returns 默认草稿信息
 */
function createDefaultDraftsInfo(): DraftsInfo {
  return {
    selectedIdx: 0,
    isCanPick: false,
    templateCode: APP_CONFIG.defaultTemplate,
    list: [],
  }
}

/**
 * 验证草稿信息格式
 * @param data - 要验证的数据
 * @returns 是否有效
 */
function validateDraftsInfo(data: unknown): data is DraftsInfo {
  if (!data || typeof data !== 'object') {
    return false
  }

  const { selectedIdx, isCanPick, templateCode, list } = data as {
    selectedIdx: number
    isCanPick: boolean
    templateCode: string
    list: unknown[]
  }

  // 检查必要字段
  if (
    typeof selectedIdx !== 'number' ||
    typeof isCanPick !== 'boolean' ||
    typeof templateCode !== 'string' ||
    !Array.isArray(list)
  ) {
    return false
  }

  // 检查列表中的每个项目
  for (const item of list) {
    if (!item || typeof item !== 'object') {
      return false
    }

    const draftItem = item as {
      pic?: unknown
      width?: unknown
      top?: unknown
      left?: unknown
      opacity?: unknown
    }

    if (
      typeof draftItem.pic !== 'string' ||
      typeof draftItem.width !== 'number' ||
      typeof draftItem.top !== 'number' ||
      typeof draftItem.left !== 'number' ||
      typeof draftItem.opacity !== 'number'
    ) {
      return false
    }
  }

  return true
}
