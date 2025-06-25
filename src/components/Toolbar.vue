<script setup>
// 从 useDnD composable 中导入拖拽起始函数
// Import the drag start function from the useDnD composable
import useDragAndDrop from '../composables/useDnD';

const { onDragStart } = useDragAndDrop();

// 定义 props 和 emits
// Define props and emits
const props = defineProps({
  isFrozen: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['toggle-freeze']);
</script>

<template>
  <div class="toolbar">
    <div class="tool-section">
      <span class="tool-label">Tool Kit</span>
      <!-- 
        这个 div 是可拖拽的。
        当拖拽开始时，我们调用 onDragStart，并传入事件对象和节点类型 'custom'。
        This div is draggable.
        When dragging starts, we call onDragStart, passing the event object and the node type 'custom'.
      -->
      <div 
        class="tool-button node-drag-handle" 
        :draggable="true" 
        @dragstart="onDragStart($event, 'custom')"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
        <span>New Node</span>
      </div>
    </div>
    <div class="tool-section">
       <span class="tool-label">Controls</span>
      <button 
        @click="emit('toggle-freeze')" 
        class="tool-button"
        :class="{ active: isFrozen }"
      >
        <!-- 使用了 Feather Icons 的 SVG 图标 -->
        <!-- Using SVG icons from Feather Icons -->
        <svg v-if="isFrozen" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
        <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>
        <span>{{ isFrozen ? ' Unfreeze' : 'Freeze' }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  position: fixed;
  bottom: 0;
  left: 250px; /* InstructionPanel 的宽度 */
  right: 0;
  height: 70px;
  /* 旧的灰色背景和边框已被替换 */
  /* The old grey background and border have been replaced */
  background-color: #ffffff; /* 修改为白色背景 */
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05); /* 添加了顶部阴影以增加层次感 */
  display: flex;
  align-items: center;
  padding: 0 25px;
  z-index: 10;
  gap: 30px;
}
.tool-section {
    display: flex;
    align-items: center;
    gap: 15px;
}
.tool-label {
    font-size: 12px;
    color: #6c757d;
    font-weight: 500;
}
.tool-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 15px;
  border: 1px solid #ced4da;
  background-color: #fff;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  color: #343a40;
}
.tool-button:hover {
  background-color: #f8f9fa;
  border-color: #adb5bd;
}
.tool-button.active {
    background-color: #007bff;
    color: white;
    border-color: #007bff;
}
.tool-button.active svg {
    stroke: white;
}
.node-drag-handle {
  cursor: grab;
}
.node-drag-handle:active {
  cursor: grabbing;
}
</style>
