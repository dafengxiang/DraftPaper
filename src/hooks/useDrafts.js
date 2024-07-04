/*
 * @Description:草稿列表
 * @Author: wangfengxiang
 * @Date: 2024-05-10 16:33:15
 * @LastEditTime: 2024-07-04 10:19:23
 * @LastEditors: wangfengxiang
 */

import { ref } from 'vue'
import { getDataByKey, addData, updateDB } from '../utils/database'

// draftsInfo = {
//         selectedIdx: 0, 选中的草稿下标
//         isCanPick: false, 选中的草稿下标
//         list: [
//             {
//                 pic: '',
//                 top: 0,
//                 left: 0,
//                 opacity: 1,
//             },
//         ],
//     },

const draftsInfo = ref({}),
    { host, pathname } = window.$currentUrl,
    dbKey = host + pathname
let hasDBInfo = false

export function useDrafts() {
    const initDrafts = async () => {
        const res = await getDataByKey(dbKey)
        hasDBInfo = !!res
        draftsInfo.value = res
            ? JSON.parse(res.val)
            : {
                  selectedIdx: 1000,
                  isCanPick: false,
                  templateCode: 'position: absolute; top: {top}px; left: {left}px;',
                  list: [],
              }
    }

    const updateDraftsDB = async () => {
        const data = {
            url_path: dbKey,
            val: JSON.stringify(draftsInfo.value),
        }
        // 无数据时为数据库初始数据
        const _ = (await hasDBInfo) ? updateDB(data) : addData(data)
        hasDBInfo = true
    }
    return {
        draftsInfo,
        initDrafts,
        updateDraftsDB,
    }
}
