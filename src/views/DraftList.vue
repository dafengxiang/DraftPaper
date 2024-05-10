<!--
 * @Description: 草稿列表
 * @Author: wangfengxiang
 * @Date: 2024-05-10 18:50:23
 * @LastEditTime: 2024-05-10 21:22:58
 * @LastEditors: wangfengxiang
-->
<template>
    <ul class="m-draft-list">
        <li
            class="draft-item"
            :class="{ selected: currentDraft.selectedIdx === i }"
            v-for="({ pic }, i) in currentDraft?.list ?? []"
            :style="`background-image: url(${pic});`"
            :key="i"
            @click="currentDraft.selectedIdx = i"
        ></li>
        <input type="file" accept="image/*" class="draft-item add" @change="handleImageUpload" />
    </ul>
</template>

<script setup>
import { useDrafts } from '../hooks/useDrafts'
const { currentDraft } = useDrafts()

const handleImageUpload = (event) => {
    const file = event.target.files[0]
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
        const pic = reader.result
        console.log('pic : ', pic)
        if (!currentDraft.value?.list?.length) currentDraft.value.list = []
        currentDraft.value.list.push({
            pic,
            top: 0,
            left: 0,
            opacity: 1,
        })
        currentDraft.value.selectedIdx = currentDraft.value.list.length - 1
        console.log('currentDraft.value: ', currentDraft.value)
    }
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
        filter: grayscale(0.8);
        background: no-repeat 0 0 / cover;
        &.selected {
            filter: grayscale(0);
            border-color: #ff9900;
        }

        &.add {
            font-size: 0;
            position: relative;
            &::after {
                content: '';
                .square(100%);
                .ab(0,0);
                background: #333 url(../icons/add.png) no-repeat center/30px;
            }
        }
    }
}
</style>
