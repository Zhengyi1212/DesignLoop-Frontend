<script setup>
import { computed } from 'vue';
import { getBezierPath, getSmoothStepPath } from '@vue-flow/core';
import Button from 'primevue/button';

const props = defineProps({
  id: { type: String, required: true },
  sourceX: { type: Number, required: true },
  sourceY: { type: Number, required: true },
  targetX: { type: Number, required: true },
  targetY: { type: Number, required: true },
  sourcePosition: { type: String, required: true },
  targetPosition: { type: String, required: true },
  selected: { type: Boolean, required: false },
  interactionWidth: { type: Number, required: false, default: 20 },
  // 新增 data prop，用于接收 animated 等状态
  data: { type: Object, required: false, default: () => ({}) },
});

const emit = defineEmits(['delete-edge']);

// 动态计算路径
// 支持 'bezier' 和 'smoothstep' 两种路径类型
const pathData = computed(() => {
  const pathType = props.data?.pathType || 'bezier'; // 默认为 bezier
  const options = {
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
  };
  return pathType === 'smoothstep' ? getSmoothStepPath(options) : getBezierPath(options);
});

// 动态计算 marker url
const markerUrl = computed(() => (props.selected ? 'url(#custom-arrow-selected)' : 'url(#custom-arrow)'));

// 动态计算 class，用于控制动画
// 默认 animated 为 true
const edgeClasses = computed(() => ({
  'vue-flow__edge-path': true,
  'animated-edge': props.data?.animated !== false, // 默认开启，除非显式设置为 false
}));

// 删除边的逻辑保持不变
function onDeleteEdge() {
  emit('delete-edge', props.id);
}
</script>

<template>
  <g>
    <!-- 主路径 -->
    <path
      :style="{ strokeWidth: selected ? 3 : 2, stroke: selected ? '#6366F1' : '#b1b1b7' }"
      :class="edgeClasses"
      :d="pathData[0]"
      :marker-end="markerUrl"
    />
    
    <!-- 交互区域路径 -->
    <path
      :d="pathData[0]"
      fill="none"
      stroke-opacity="0"
      :stroke-width="interactionWidth"
    />

    <!-- 删除按钮 (选中时显示) -->
    <foreignObject
      v-if="selected"
      width="32"
      height="32"
      :x="pathData[1] - 16"
      :y="pathData[2] - 16"
      class="edgebutton-foreignobject"
    >
      <div class="edge-button-container">
        <Button
          icon="pi pi-times"
          rounded
          text
          severity="danger"
          @click="onDeleteEdge"
          title="Delete Edge"
        />
      </div>
    </foreignObject>
  </g>
</template>

<style>

@keyframes dash-animation {
  to {
    stroke-dashoffset: -20;
  }
}

.animated-edge {
  stroke-dasharray: 10;
  animation: dash-animation 1s linear infinite;
}

.edge-button-container {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  background-color: rgba(255, 255, 255, 0.8);
  border-radius: 50%;
}
</style>
