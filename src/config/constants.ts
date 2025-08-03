import type { AppConfig } from '@/types'

/**
 * 应用配置常量
 */
export const APP_CONFIG: AppConfig = {
  defaultDraft: {
    width: 750,
    top: 0,
    left: 0,
    opacity: 1,
  },
  defaultTemplate: 'position: absolute; top: {top}px; left: {left}px;',
  popupWidth: 350,
  maxImageSize: 5 * 1024 * 1024, // 5MB
  supportedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
}

/**
 * 数据库配置
 */
export const DB_CONFIG = {
  name: 'draftPaper',
  version: 1,
  storeName: 'draft_info',
} as const

/**
 * CSS类名常量
 */
export const CSS_CLASSES = {
  dragBorder: 'draft-drag-border',
  dragPosition: 'draft-drag-position',
} as const

/**
 * 事件防抖延迟（毫秒）
 */
export const DEBOUNCE_DELAY = 300

/**
 * Z-index层级
 */
export const Z_INDEX = {
  draftImage: 999999,
  dragBorder: 1000000,
} as const