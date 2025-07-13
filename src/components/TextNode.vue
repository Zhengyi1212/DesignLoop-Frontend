<script setup>
// ✨ 1. 从 'vue' 中导入 watch
import { ref, computed, nextTick, watch } from 'vue';
import { Handle, Position } from '@vue-flow/core';
import { NodeResizer } from '@vue-flow/node-resizer';

const props = defineProps({
  id: { type: String, required: true },
  data: {
    type: Object,
    required: true,
    default: () => ({ rationales: [] }),
  },
  selected: { type: Boolean, default: false },
  dragging: Boolean,
  resizing: Boolean,
  selectable: Boolean,
  connectable: Boolean,
  deletable: Boolean,
  focusable: Boolean,
  position: Object,
  dimensions: Object,
  events: Object,
  isValidTargetPos: Function,
  isValidSourcePos: Function,
  parentNode: String,
  zIndex: Number,
  targetPosition: String,
  sourcePosition: String,
  label: [String, Object],
  dragHandle: String,
});

const emit = defineEmits(['create-node-from-text', 'update:rationales', 'updateNodeInternals']);

const rationales = ref(props.data.rationales || []);
const listContainerRef = ref(null);

// ✨ 2. 添加 watch 侦听器来同步 prop 的变化
watch(() => props.data.rationales, (newRationales) => {
  rationales.value = newRationales || [];
}, { deep: true });


const isDragging = ref(false);
const draggedIndex = ref(null);
const dragOverIndex = ref(null);
const draggedItemClone = ref(null);
const cloneStyle = ref({});

function handleMouseDown(event, index) {
  if (event.target.closest('.rationale-actions') || event.target.isContentEditable) {
    return;
  }
  event.preventDefault(); 
  event.stopPropagation();
  isDragging.value = true;
  draggedIndex.value = index;
  const itemElement = event.currentTarget;
  const rect = itemElement.getBoundingClientRect();
  draggedItemClone.value = {
    text: rationales.value[index],
    width: rect.width,
    height: rect.height,
  };
  cloneStyle.value = {
    position: 'fixed',
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    pointerEvents: 'none',
    zIndex: 9999,
  };
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
}

function handleMouseMove(event) {
  if (!isDragging.value) return;
  const newTop = event.clientY - (draggedItemClone.value.height / 2);
  const newLeft = event.clientX - (draggedItemClone.value.width / 2);
  cloneStyle.value.top = `${newTop}px`;
  cloneStyle.value.left = `${newLeft}px`;
  const elements = Array.from(listContainerRef.value.children);
  dragOverIndex.value = null;
  for (let i = 0; i < elements.length; i++) {
    if (i === draggedIndex.value) continue;
    const el = elements[i];
    const rect = el.getBoundingClientRect();
    if (event.clientY > rect.top && event.clientY < rect.bottom) {
      dragOverIndex.value = i;
      break;
    }
  }
}

function handleMouseUp() {
  if (!isDragging.value) return;
  if (dragOverIndex.value !== null && dragOverIndex.value !== draggedIndex.value) {
    const itemToMove = rationales.value.splice(draggedIndex.value, 1)[0];
    rationales.value.splice(dragOverIndex.value, 0, itemToMove);
    emit('update:rationales', { nodeId: props.id, newRationales: rationales.value });
  }
  isDragging.value = false;
  draggedIndex.value = null;
  dragOverIndex.value = null;
  draggedItemClone.value = null;
  window.removeEventListener('mousemove', handleMouseMove);
  window.removeEventListener('mouseup', handleMouseUp);
}

function handleCreateNode(text) {
  emit('create-node-from-text', text);
}

function deleteRationale(index) {
  rationales.value.splice(index, 1);
  emit('update:rationales', { nodeId: props.id, newRationales: rationales.value });
}

async function addRationale(index) {
  const newRationaleText = '';
  rationales.value.splice(index + 1, 0, newRationaleText);
  emit('update:rationales', { nodeId: props.id, newRationales: rationales.value });
  await nextTick();
  const listItems = listContainerRef.value.querySelectorAll('.rationale-text');
  const newItem = listItems[index + 1];
  if (newItem) {
    newItem.focus();
  }
}

function updateRationaleText(event, index) {
  const newText = event.target.innerText;
  if (rationales.value[index] !== newText) {
    rationales.value[index] = newText;
    emit('update:rationales', { nodeId: props.id, newRationales: rationales.value });
  }
}

const nodeSelectionStyle = computed(() => {
  return props.selected
    ? { boxShadow: '0 0 0 2px #2563EB, 0 6px 15px rgba(0,0,0,0.2)' }
    : {};
});
</script>

<template>
  <div class="text-node-container" :style="nodeSelectionStyle">
    <NodeResizer :min-width="200" :min-height="150" :visible="selected" />
    <Handle id="top" :position="Position.Top" />
    <Handle id="bottom" :position="Position.Bottom" />
    <Handle id="left" :position="Position.Left" />
    <Handle id="right" :position="Position.Right" />

    <div class="rationales-list" ref="listContainerRef">
      <div
        v-for="(rationale, index) in rationales"
        :key="index"
        class="rationale-item"
        :class="{
          'is-dragging-placeholder': isDragging && draggedIndex === index,
          'is-drop-target': isDragging && dragOverIndex === index
        }"
        @mousedown.stop
        @mousedown="handleMouseDown($event, index)"
      >
        <div
          class="rationale-text"
          contenteditable="true"
          @blur="updateRationaleText($event, index)"
          @keydown.enter.prevent="($event.target).blur()"
          v-text="rationale"
        ></div>

        <div class="rationale-actions">
           <button class="action-btn delete-btn" @click.stop="deleteRationale(index)" title="Delete this item">
            🗑️
          </button>
          <button class="action-btn add-btn" @click.stop="addRationale(index)" title="Add a new item below">
            ➕
          </button>
          <button class="create-node-btn" @click.stop="handleCreateNode(rationale)" title="Create node from this text">
            + Create Node
          </button>
        </div>
      </div>
    </div>
  </div>

  <Teleport to="body">
    <div v-if="draggedItemClone" class="rationale-item rationale-item-clone" :style="cloneStyle">
      <div class="rationale-text">{{ draggedItemClone.text }}</div>
    </div>
  </Teleport>
</template>

<style scoped>
.text-node-container {
  width: 100%;
  height: 100%;
  background-color: #fefce8;
  border: 1px solid #eab308;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: 'JetBrains Mono', sans-serif;
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}

.rationales-list {
  flex-grow: 1;
  padding: 8px;
  overflow-y: auto; 
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rationales-list::-webkit-scrollbar {
  width: 8px;
}
.rationales-list::-webkit-scrollbar-track {
  background: #fef9c3;
  border-radius: 4px;
}
.rationales-list::-webkit-scrollbar-thumb {
  background-color: #fde047;
  border-radius: 4px;
  border: 2px solid #fef9c3;
}
.rationales-list::-webkit-scrollbar-thumb:hover {
  background-color: #facc15;
}

.rationale-item {
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
  font-size: 13px;
  color: #334155;
  cursor: grab;
  position: relative;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  overflow: hidden;
  padding-bottom: 40px; /* 增加底部内边距，为按钮区留出空间 */
}
.rationale-item:hover {
  border-color: #3b82f6;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.rationale-text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.2s;
  cursor: text;
}
.rationale-text:focus {
  outline: none;
  background-color: #eff6ff;
  box-shadow: 0 0 0 2px #3b82f6;
}

.rationale-actions {
  position: absolute;
  bottom: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
  opacity: 1; 
}

.action-btn {
  background-color: #e2e8f0;
  color: #475569;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 4px;
  font-size: 12px;
  cursor: pointer;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
.action-btn:hover {
  background-color: #cbd5e1;
  border-color: #94a3b8;
}
.delete-btn:hover {
  background-color: #fee2e2;
  color: #ef4444;
  border-color: #fca5a5;
}
.add-btn:hover {
  background-color: #dbeafe;
  color: #3b82f6;
  border-color: #93c5fd;
}

.create-node-btn {
  position: static;
  opacity: 1;
  transform: none;
  background-color: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 10px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease;
}
.create-node-btn:hover {
  background-color: #2563eb;
}

.rationale-item-clone {
  cursor: grabbing;
  box-shadow: 0 10px 25px rgba(0,0,0,0.2);
  transform: scale(1.05);
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
  font-size: 13px;
  font-family: 'JetBrains Mono', sans-serif;
  color: #334155;
}
.is-dragging-placeholder {
  background-color: #f0f9ff;
  border-color: #bae6fd;
  border-style: dashed;
}
.is-dragging-placeholder > * {
  opacity: 0;
}
.is-drop-target {
  background-color: #dbeafe;
  border-color: #3b82f6;
}

:deep(.resizer-handle) {
  width: 12px;
  height: 12px;
  background-color: #2563EB;
  border-radius: 2px;
  border: 1px solid white;
}
:deep(.resizer-line) {
  border-color: #2563EB;
  border-width: 3px;
}
.text-node-container .vue-flow__handle-top,
.text-node-container .vue-flow__handle-right,
.text-node-container .vue-flow__handle-left {
  opacity: 0;
}
:deep(.vue-flow__handle) {
  width: 10px;
  height: 10px;
  background-color: #9e9e9e;
  border: 1px solid #f0f0f0;
}
</style>