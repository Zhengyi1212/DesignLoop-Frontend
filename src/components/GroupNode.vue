<script setup>
import { NodeResizer } from '@vue-flow/node-resizer';

defineProps({
  data: {
    type: Object,
    required: true,
  },
  selected: {
    type: Boolean,
    default: false,
  },
});
</script>

<template>
  <div class="group-node-wrapper">
    <div 
      class="group-node-border"
      :style="{
        borderColor: data.color || 'rgba(0,0,0,0.15)'
      }"
    />
    <NodeResizer :min-width="100" :min-height="100" />
  </div>
</template>

<style scoped>
.group-node-wrapper {
  width: 100%;
  height: 100%;
  position: absolute;
  z-index: 0 !important; /* 永远最底层 */
  border-radius: 12px;
  box-sizing: border-box;
}

/* 只显示边框，背景透明 */
.group-node-border {
  width: 100%;
  height: 100%;
  border: 6px solid;
  border-radius: 12px;
  background-color: transparent; /* 透明背景 */
  pointer-events: none; /* 不阻挡交互 */
  transition: border-color 0.2s;
}

/* 保持 NodeResizer 正常交互 */
:deep(.vue-flow__node-resizer) {
  pointer-events: auto;
}

/* 调整 resize 手柄样式 */
:deep(.vue-flow__node-resizer-handle) {
  background-color: #007bff;
  border: 1px solid white;
  width: 10px;
  height: 10px;
  border-radius: 2px;
}
</style>
