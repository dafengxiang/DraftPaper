<!--
 * @Description: 
 * @Author: wangfengxiang
 * @Date: 2024-05-10 15:36:57
 * @LastEditTime: 2024-05-10 15:38:47
 * @LastEditors: wangfengxiang
-->
<template>
    <section class="m-control-box">
        <div class="item">
            <span class="title">top(px):</span>
            <input type="number" class="number" value="0" />
        </div>
        <div class="item">
            <span class="title">left(px):</span>
            <input type="number" class="number" value="0" />
        </div>
        <div class="item">
            <span class="title">opacity:</span>
            <input type="range" class="range" min="0" max="1" value="0" step="0.1" />
        </div>
    </section>
</template>

<script setup>
import { ref } from 'vue'
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
