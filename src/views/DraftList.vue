<!--
 * @Description: 草稿列表
 * @Author: wangfengxiang
 * @Date: 2024-05-10 18:50:23
 * @LastEditTime: 2024-05-10 19:38:13
 * @LastEditors: wangfengxiang
-->
<template>
    <section class="m-draft-list">
        <div class="draft-item" v-for="item in currentDraft.list" :key="item.pic"></div>
        <input class="draft-item add" type="file" accept="image/*" @change="handleAdd" />
    </section>
</template>

<script setup>
import { useDrafts } from '../hooks/useDrafts'
const { currentDraft } = useDrafts()

const handleAdd = (e) => {
    const file = e.target.files[0]
    console.log('file: ', file)
}
</script>

<style lang="less" scoped>
@import '../mixin.less';
.m-draft-list {
    width: 100%;
    height: 177px;
    overflow: hidden;
    display: flex;
    flex-wrap: no-wrap;
    align-items: center;
    margin: 20px 0 10px;

    .draft-item {
        flex-shrink: 0;
        .size(100px, 177px);
        border-radius: 10px;
        margin-right: 4px;
        border: 1px solid #e6e6e6;
        background: no-repeat 0 0 / cover;

        &.add {
            position: relative;
            font-size: 0;
            &::after {
                content: '';
                .ab(0,0);
                .square(100%);
                background: #333 url(../icons/add.png) no-repeat center/30px;
            }
        }
    }
}
</style>
