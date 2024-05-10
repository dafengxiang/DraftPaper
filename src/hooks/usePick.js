/*
 * @Description:拾取相关逻辑
 * @Author: wangfengxiang
 * @Date: 2024-05-10 15:30:52
 * @LastEditTime: 2024-05-10 15:31:06
 * @LastEditors: wangfengxiang
 */
import { ref } from 'vue'
const isPicking = ref(true)
export function usePick() {
    return { isPicking }
}
