declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}

declare module '*.png' {
  const src: string
  export default src
}

declare module '*.less' {
  const classes: { [key: string]: string }
  export default classes
}

// 全局类型扩展
declare global {
  interface Window {
    $currentTab?: chrome.tabs.Tab
    $currentUrl?: URL
  }
}

export {}
