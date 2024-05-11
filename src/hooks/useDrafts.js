/*
 * @Description:草稿列表
 * @Author: wangfengxiang
 * @Date: 2024-05-10 16:33:15
 * @LastEditTime: 2024-05-11 10:19:36
 * @LastEditors: wangfengxiang
 */

import { ref } from 'vue'
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

let drafts = {},
    currentDraft = ref({})

export function useDrafts() {
    const initDrafts = () =>
        draftsStorage.get((val) => {
            console.log('val: ', val)
            drafts = val ?? {}

            drafts = {
                [currentHost.value]: {
                    selectedIdx: 100,
                    list: [],
                },
            }
            currentDraft.value = drafts[currentHost.value]
        })

    const updateDraftsStorage = () => {
        drafts[currentHost.value] = currentDraft.value
        // 存储草稿
        draftsStorage.set(drafts)
        // 通知页面更新
        tabInfo.value.id &&
            chrome.tabs.sendMessage(tabInfo.value.id, {
                type: 'updateDrafts',
                payload: { drafts },
            })
    }
    return {
        currentDraft,
        initDrafts,
        updateDraftsStorage,
    }
}
