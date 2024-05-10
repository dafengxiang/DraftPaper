/*
 * @Description:草稿列表
 * @Author: wangfengxiang
 * @Date: 2024-05-10 16:33:15
 * @LastEditTime: 2024-05-10 19:28:58
 * @LastEditors: wangfengxiang
 */

import { ref, computed } from 'vue'
import { draftsStorage } from '../utils/draftsStorage'
import { useWindowInfo } from './useWindowInfo'
const { tabInfo, currentHost } = useWindowInfo()

// drafts = {
//     'test.m.iqiyi.com': {
//         selectedIdx: 0,
//         list: [
//             {
//                 pic: '',
//                 top: 0,
//                 left: 0,
//                 opacity: 1,
//             },
//         ],
//     },
// }

const drafts = ref({}),
    currentDraft = computed(() => drafts.value?.[currentHost?.value] ?? {})

export function useDrafts() {
    const initDrafts = () =>
        draftsStorage.get((val) => {
            if (val) drafts.value = val
            else
                drafts.value = {
                    [currentHost.value]: {
                        selectedIdx: 0,
                        list: [],
                    },
                }
        })

    const updateDraftsStorage = () => {
        // 存储草稿
        draftsStorage.set(drafts.value)
        // 通知页面更新
        tabInfo.value.id &&
            chrome.tabs.sendMessage(tabInfo.value.id, {
                type: 'updateDrafts',
                payload: { drafts },
            })
    }
    return {
        drafts,
        currentDraft,
        initDrafts,
        updateDraftsStorage,
    }
}
