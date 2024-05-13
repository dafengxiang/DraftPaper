/*
 * @Description:
 * @Author: wangfengxiang
 * @Date: 2024-05-11 11:34:20
 * @LastEditTime: 2024-05-13 17:02:19
 * @LastEditors: wangfengxiang
 */
'use strict'
import { createApp } from 'vue'
;(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

    window.$currentTab = tab
    window.$currentUrl = new URL(tab?.url ?? '')

    const { default: App } = await import('./views/App.vue')
    console.log('App: ', App)

    createApp(App).mount('#app')
})()
