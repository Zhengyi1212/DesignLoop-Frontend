<script setup>
import { computed, ref, nextTick, watch } from 'vue';
import { Handle, Position } from '@vue-flow/core';
import { NodeResizer } from '@vue-flow/node-resizer';

defineOptions({
  inheritAttrs: false,
});

const props = defineProps({
  id: { type: String, required: true },
  data: {
    type: Object,
    required: true,
    default: () => ({ rationales: [], content: '', color: '#34495e' }),
  },
  selected: { type: Boolean, default: false },
});

const emit = defineEmits(['delete', 'open-canvas', 'update-node-data', 'snapshot-dropped', 'content-changed']);

// --- 核心逻辑：rationales 和 content 同步 (保持不变) ---
const rationales = ref([]);
const listContainerRef = ref(null);
const content = computed(() => rationales.value.join('\n'));

if (props.data.rationales && props.data.rationales.length > 0) {
  rationales.value = [...props.data.rationales];
} else if (props.data.content) {
  rationales.value = [props.data.content];
} else {
  rationales.value = [''];
}

watch(() => props.data.rationales, (newRationales) => {
  if (newRationales && JSON.stringify(newRationales) !== JSON.stringify(rationales.value)) {
    rationales.value = newRationales;
    if (rationales.value.length === 0) {
      rationales.value.push('');
    }
  }
}, { deep: true });


// --- 拖拽排序逻辑 (保持不变) ---
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
    emitUpdate();
  }
  isDragging.value = false;
  draggedIndex.value = null;
  dragOverIndex.value = null;
  draggedItemClone.value = null;
  window.removeEventListener('mousemove', handleMouseMove);
  window.removeEventListener('mouseup', handleMouseUp);
}

// --- 文字块管理 (保持不变) ---
async function addNewRationale(focus = true) {
  rationales.value.push('');
  emitUpdate();

  if (focus) {
    await nextTick();
    const listItems = listContainerRef.value.querySelectorAll('.rationale-text');
    const newItem = listItems[listItems.length - 1];
    if (newItem) {
      newItem.focus();
    }
  }
}

function deleteRationale(index) {
  if (rationales.value.length === 1) {
    rationales.value[0] = '';
  } else {
    rationales.value.splice(index, 1);
  }
  emitUpdate();
}

function updateRationaleText(event, index) {
  const newText = event.target.innerText;
  if (rationales.value[index] !== newText) {
    rationales.value[index] = newText;
    emitUpdate();
  }
}

async function handleKeyDown(event, index) {
  if (event.key === 'Enter' && !event.shiftKey) {
     const isLastItem = index === rationales.value.length - 1;
     const currentText = event.target.innerText;
     if (isLastItem && currentText.endsWith('\n\n')) {
        event.preventDefault();
        rationales.value[index] = currentText.trimEnd();
        emitUpdate();
        await nextTick();
        addNewRationale(true);
     }
  }
}

// --- 统一的数据更新事件 (保持不变) ---
function emitUpdate() {
  emit('update-node-data', {
    id: props.id,
    data: {
      ...props.data,
      rationales: rationales.value,
      content: content.value,
    }
  });
  emit('content-changed', props.id);
}


// --- 原有的编辑和拖放逻辑 (保持不变) ---
const isEditingTitle = ref(false);
const titleInput = ref(null);

function startEditTitle() {
  if (props.id === 'ghost-node') return;
  isEditingTitle.value = true;
  nextTick(() => {
    titleInput.value?.focus();
    titleInput.value?.select();
  });
}

function saveTitle() {
  isEditingTitle.value = false;
  emitUpdate();
}

const isDraggingOver = ref(false);

function onDragOver(event) {
  event.preventDefault();
  if (event.dataTransfer.types.includes('application/json/snapshot')) {
    isDraggingOver.value = true;
    event.dataTransfer.dropEffect = 'copy';
  }
}

function onDragLeave() {
  isDraggingOver.value = false;
}

function onDrop(event) {
  event.preventDefault();
  isDraggingOver.value = false;
  const snapshotDataString = event.dataTransfer.getData('application/json/snapshot');
  if (!snapshotDataString) return;
  try {
    const snapshotData = JSON.parse(snapshotDataString);
    emit('snapshot-dropped', { nodeId: props.id, snapshotData });
  } catch (e) {
    console.error("Failed to parse snapshot data on drop:", e);
  }
}

// --- 计算属性与原有函数 (保持不变) ---
const nodeHeaderStyle = computed(() => ({
  backgroundColor: props.data.color || '#34495e'
}));

const nodeSelectionStyle = computed(() => {
  if (props.selected) {
    return {
      boxShadow: `0 0 0 2px ${props.data.color || '#6366F1'}, 0 6px 15px rgba(0,0,0,0.2)`
    };
  }
  return {};
});

function onDelete() {
  emit('delete', props.id);
}

function onOpenCanvas() {
  if (isEditingTitle.value) return;
  if (props.id === 'ghost-node') return;
  emit('open-canvas', props.id);
}
</script>

<template>
  <div class="custom-node" :class="{
    'is-editing-title': isEditingTitle,
    'is-dragging-over': isDraggingOver
  }" :style="[
    id === 'ghost-node' ? { pointerEvents: 'none' } : {},
    nodeSelectionStyle
  ]" @dblclick="onOpenCanvas" @dragover.prevent="onDragOver" @dragleave="onDragLeave" @drop="onDrop" @wheel.stop>
    <NodeResizer v-if="id !== 'ghost-node'" :min-width="200" :min-height="180" :visible="selected"
      line-class-name="resizer-line" handle-class-name="resizer-handle" />

    <template v-if="id !== 'ghost-node'">
      <Handle id="top" :position="Position.Top" />
      <Handle id="left" :position="Position.Left" />
      <Handle id="bottom" :position="Position.Bottom" />
      <Handle id="right" :position="Position.Right" />
    </template>

    <div class="node-header" :style="nodeHeaderStyle">
      <!-- 颜色选择器已被移除 -->
      <div class="title-container" v-if="!isEditingTitle">
        <strong @click.stop="startEditTitle" title="Click to edit title">
          {{ data.title || "New Node" }}
        </strong>
      </div>
      <input v-else ref="titleInput" v-model="data.title" @blur="saveTitle" @keydown.enter="saveTitle" @click.stop
        @mousedown.stop class="title-input" type="text" />

      <div v-if="data.appliedSnapshotId" class="snapshot-indicator" title="Applied Snapshot">
        <span class="icon" :style="{ backgroundColor: data.appliedSnapshotColor || '#27ae60' }"></span>
        ID:{{ data.appliedSnapshotId }}
      </div>
      <button v-if="!isEditingTitle" class="delete-btn" @click.stop="onDelete" title="Delete Node">×</button>
    </div>

    <div class="rationales-list" ref="listContainerRef">
      <div
        v-for="(rationale, index) in rationales"
        :key="index"
        class="rationale-item"
        :class="{
          'is-dragging-placeholder': isDragging && draggedIndex === index,
          'is-drop-target': isDragging && dragOverIndex === index
        }"
        @mousedown="handleMouseDown($event, index)"
      >
        <div
          class="rationale-text"
          contenteditable="true"
          @blur="updateRationaleText($event, index)"
          @keydown="handleKeyDown($event, index)"
          @click.stop
          @mousedown.stop
          v-text="rationale"
        ></div>

        <div class="rationale-actions">
           <button class="action-btn delete-btn-item" @click.stop="deleteRationale(index)" title="Delete this item">
            -
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
/* --- 基础样式 (大部分来自原 CustomNode) --- */
.custom-node {
  border: 1px solid #b7c0ce;
  border-radius: 8px;
  font-family: 'JetBrains Mono', sans-serif;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease-in-out;
  cursor: grab;
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  overflow: hidden;
  background-color: #ffffff; /* 设置一个白色背景 */
}

.custom-node.is-dragging-over {
  outline: 3px dashed #2ecc71;
  outline-offset: 4px;
  box-shadow: 0 0 20px rgba(46, 204, 113, 0.5);
  transform: scale(1.02);
}

.custom-node.is-editing-title {
  cursor: default;
}

.vue-flow__node-selected .custom-node {
  border-color: transparent;
}

.node-header {
 
  border: 1px solid #b7c0ce;
  color: white;
  padding: 8px 12px;
  border-top-left-radius: 7px;
  border-top-right-radius: 7px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background-color 0.2s;
  flex-shrink: 0;
  gap: 8px; /* Add gap for spacing */
}

.title-container {
  color:  #334155;
  flex-grow: 1;
  min-width: 0; /* 确保在 flex 布局中可以被压缩 */
}

.node-header strong {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: text;
  display: block; /* 确保 ellipsis 生效 */
}

.title-input {
  
  background-color: transparent;
  color: #334155;
  border: none;
  outline: none;
  font-family: 'JetBrains Mono', sans-serif;
  font-size: 13px;
  font-weight: bold;
  width: 100%;
  padding: 0;
  margin: 0;
  flex-grow: 1;
  min-width: 0;
}

.delete-btn {
  background: none;
  border: none;
  color: white;
  font-size: 22px;
  cursor: pointer;
  padding: 0 5px;
  line-height: 1;
  opacity: 0.8;
  transition: opacity 0.2s;
  flex-shrink: 0; /* Prevent button from shrinking */
}

.delete-btn:hover {
  opacity: 1;
  color: #e74c3c;
}

.rationales-list {
  flex-grow: 1;
  padding: 8px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background-color: #ffffff;
}

.rationales-list::-webkit-scrollbar { width: 6px; }
.rationales-list::-webkit-scrollbar-track { background: #f1f1f1; }
.rationales-list::-webkit-scrollbar-thumb { background: #ccc; border-radius: 3px; }
.rationales-list::-webkit-scrollbar-thumb:hover { background: #aaa; }

.rationale-item {
  background-color: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 12px;
  color: #374151;
  cursor: grab;
  position: relative;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  overflow: hidden;
  padding-bottom: 28px; /* 为操作按钮留出空间 */
}
.rationale-item:hover {
  border-color: #3b82f6;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}

.rationale-text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.2s;
  cursor: text;
  min-height: 1.2em; /* 确保空块也有高度 */
}
.rationale-text:focus {
  outline: none;
  background-color: #eff6ff;
  box-shadow: 0 0 0 2px #3b82f6 inset;
}

.rationale-actions {
  position: absolute;
  bottom: 4px;
  right: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
}

.rationale-item:hover .rationale-actions {
  opacity: 1;
}

.action-btn {
  background-color: #e5e7eb;
  color: #4b5563;
  border: 1px solid #d1d5db;
  border-radius: 50%;
  padding: 0;
  font-size: 12px;
  cursor: pointer;
  width: 12px;
  height: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
.action-btn:hover {
  background-color: #d1d5db;
  border-color: #9ca3af;
}
.delete-btn-item:hover {
  background-color: #fee2e2;
  color: #ef4444;
  border-color: #fca5a5;
  
}

.rationale-item-clone {
  cursor: grabbing;
  box-shadow: 0 10px 25px rgba(0,0,0,0.2);
  transform: scale(1.05);
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12px;
  font-family: 'JetBrains Mono', sans-serif;
  color: #334155;
}
.is-dragging-placeholder {
  background-color: #f0f9ff;
  border: 1px dashed #bae6fd;
}
.is-dragging-placeholder > * {
  opacity: 0;
}
.is-drop-target {
  background-color: #dbeafe;
  border-color: #3b82f6;
}

:deep(.resizer-handle) { 
  width: 8px; height: 8px; 
  background-color: transparent; border-radius: 2px; border: 2px solid transparent; }
:deep(.resizer-line) { border-color: transparent; border-width: 2px; }
.custom-node :deep(.vue-flow__handle) {
  width: 12px;
  height: 11px;
  background-color: #9e9e9e;
  border: 1px solid #f0f0f0;
}
:deep(.vue-flow__handle:hover) { background-color: #007bff; }
.custom-node .vue-flow__handle-top,
.custom-node .vue-flow__handle-bottom { display: none !important;opacity: 0; }

.node-header .snapshot-indicator {
  position: absolute;
  bottom: 5px;
  right: 8px;
  display: flex;
  align-items: center;
  background-color: rgba(255, 255, 255, 0.7);
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: bold;
  color: #34495e;
  pointer-events: none;
}
.node-header .snapshot-indicator .icon {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-right: 5px;
  border: 1px solid rgba(0, 0, 0, 0.1);
}
</style>
