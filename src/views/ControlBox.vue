<!--
 * @Description: 
 * @Author: wangfengxiang
 * @Date: 2024-05-10 15:36:57
 * @LastEditTime: 2024-05-13 14:55:46
 * @LastEditors: wangfengxiang
-->
<template>
    <ul class="m-control-box" v-if="draftsInfo">
        <li class="item">
            <span class="title">top(px):</span>
            <input type="number" class="number" v-model.trim="draftsInfo.top" />
        </li>
        <li class="item">
            <span class="title">left(px):</span>
            <input type="number" class="number" v-model.trim="draftsInfo.left" />
        </li>
        <li class="item">
            <span class="title">opacity:</span>
            <input
                type="range"
                class="range"
                min="0"
                max="1"
                step="0.1"
                v-model.trim="draftsInfo.opacity"
            />
        </li>
    </ul>
</template>

<script setup>
import { useDrafts } from '../hooks/useDrafts'
const { draftsInfo } = useDrafts()
</script>

<style lang="less">
@import '../mixin.less';
.m-control-box {
    padding: 10px;
    border-radius: 10px;
    background-color: #666;

    .item {
        height: 40px;
        display: flex;
        align-items: center;

        .title {
            width: 80px;
            font-size: 14px;
        }

        .number {
            .size(200px, 30px);
            border-radius: 5px;
            padding: 3px 10px;
        }

        .range {
            width: 200px;
        }
    }
}
</style>
