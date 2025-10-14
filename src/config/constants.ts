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
  defaultTemplate:
    '你是一个资深前端开发，修改{selector}元素的css，基于当前css中定位方式，最小程度修改，元素下移{top}px，右移{left}px',
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
