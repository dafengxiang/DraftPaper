/*
 * @Description:
 * @Author: wangfengxiang
 * @Date: 2024-05-11 11:34:20
 * @LastEditTime: 2024-05-13 16:39:53
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

    // chrome.runtime.sendMessage(
    //     {
    //         type: 'UPDATE_DRAFTS',
    //         payload: {
    //             message: '90909090',
    //         },
    //     },
    //     (response) => {
    //         console.log(1, response)
    //     }
    // )
})()
