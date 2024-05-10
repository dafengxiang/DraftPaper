/*
 * @Description: 浏览器信息
 * @Author: wangfengxiang
 * @Date: 2024-05-10 17:28:06
 * @LastEditTime: 2024-05-10 19:23:34
 * @LastEditors: wangfengxiang
 */

import { ref, computed } from 'vue'

const tabInfo = ref({}),
    currentHost = computed(() => {
        if (!tabInfo.value?.url) return ''
        const { host } = new URL(tabInfo.value.url)
        return host
    })

export function useWindowInfo() {
    const initWindowInfo = () => 1
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => (tabInfo.value = tabs[0]))
    return {
        tabInfo,
        currentHost,
        initWindowInfo,
    }
}
