<script setup>
import { ref, computed, nextTick, watch, onMounted } from 'vue';
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
    default: () => ({ title: 'New Rationale', rationales: [] , parent_content:'',}),
  },

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

const emit = defineEmits(['create-node-from-text', 'update-node-data', 'regenerate', 'delete']);

// --- State ---
const title = ref(props.data.title || 'New Rationale');
const rationales = ref(props.data.rationales || []);
const parent_content = ref(props.data.parent_content || '')
const listContainerRef = ref(null);
const isEditingTitle = ref(false);
const titleInput = ref(null);
const isSending = ref(false);

// --- Watchers ---
watch(() => props.data, (newData) => {
  title.value = newData.title || 'New Rationale';
  rationales.value = newData.rationales || [];
  adjustAllItemsHeight();
}, { deep: true });

// --- Core Functions ---
function emitDataUpdate() {
  emit('update-node-data', {
    id: props.id,
    data: {
      title: title.value,
      rationales: rationales.value,
    }
  });
}

function startEditTitle() {
  isEditingTitle.value = true;
  nextTick(() => {
    titleInput.value?.focus();
   // titleInput.value?.select();
  });
}

function saveTitle() {
  isEditingTitle.value = false;
  if (!title.value.trim()) {
    title.value = 'Untitled Rationale';
  }
  emitDataUpdate();
}

function handleSendData() {
  if (isSending.value) return;
  isSending.value = true;
  emit('regenerate', {
    id: props.id,
    title: title.value,
    rationales: rationales.value,
    parent_content: parent_content.value,
  });
  // Simulate API call duration
  setTimeout(() => { isSending.value = false; }, 2000);
}

// ✨ 新增：处理节点删除的方法
function handleDeleteNode() {
  emit('delete', props.id);
}


// --- Rationale Item Management (Height, Dragging, CRUD) ---
function adjustItemHeight(textElement) {
  if (!textElement) return;
  const itemElement = textElement.parentElement;
  if (!itemElement) return;
  textElement.style.height = 'auto';
  const minHeight = 80;
  const requiredHeight = textElement.scrollHeight;
  itemElement.style.height = `${Math.max(minHeight, requiredHeight)}px`;
}
const adjustAllItemsHeight = () => {
  nextTick(() => {
    if (listContainerRef.value) {
      const textDivs = listContainerRef.value.querySelectorAll('.rationale-text');
      textDivs.forEach(adjustItemHeight);
    }
  });
};
onMounted(adjustAllItemsHeight);

function handleTextInput(event) {
  const target = event.target;
  setTimeout(() => { adjustItemHeight(target); }, 0);
}

function handleKeyDown(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    event.target.blur();
  }
}

const isDragging = ref(false);
const draggedIndex = ref(null);
const dragOverIndex = ref(null);
const draggedItemClone = ref(null);
const cloneStyle = ref({});

// ✨ BUG FIX: Corrected mouse down handling
function handleMouseDown(event, index) {
  // CRITICAL FIX: Stop event propagation immediately.
  // This prevents the event from bubbling up to the Vue Flow node wrapper,
  // which would otherwise incorrectly initiate a node drag,
  // blocking both text editing and item dragging.
  event.stopPropagation();

  // Guard clause: If the click is on a button or the editable text area,
  // do nothing further. This allows default browser actions like
  // focusing the text editor or clicking a button.
  if (event.target.closest('.rationale-actions') || event.target.closest('.delete-btn') || event.target.closest('[contenteditable="true"]')) {
    return;
  }
  
  // If the code reaches here, it means the user is trying to drag a rationale item.
  // Prevent default browser actions like text selection during the drag.
  event.preventDefault();
  
  isDragging.value = true;
  draggedIndex.value = index;
  const itemElement = event.currentTarget;
  const rect = itemElement.getBoundingClientRect();
  draggedItemClone.value = { text: rationales.value[index], width: rect.width, height: rect.height };
  cloneStyle.value = { position: 'fixed', top: `${rect.top}px`, left: `${rect.left}px`, width: `${rect.width}px`, height: `${rect.height}px`, pointerEvents: 'none', zIndex: 9999 };
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
    emitDataUpdate();
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
  emitDataUpdate();
}

async function addNewRationale() {
  rationales.value.push('');
  emitDataUpdate();
  await nextTick();
  const listItems = listContainerRef.value.querySelectorAll('.rationale-text');
  const newItem = listItems[listItems.length - 1];
  if (newItem) {
    newItem.focus();
    adjustItemHeight(newItem);
  }
}

function updateRationaleText(event, index) {
  const newText = event.target.innerText;
  if (rationales.value[index] !== newText) {
    rationales.value[index] = newText;
    emitDataUpdate();
  }
}


</script>

<template>
  <div class="text-node-container" :style="nodeSelectionStyle">
    <NodeResizer :min-width="200" :min-height="200" :visible="false" />
    <Handle id="top" :position="Position.Top" />
    <Handle id="bottom" :position="Position.Bottom" />
    <Handle id="left" :position="Position.Left" />
    <Handle id="right" :position="Position.Right" />

    <div class="node-header">
       <div class="title-wrapper">
        <div class="title-container" v-if="!isEditingTitle" @click.stop="startEditTitle">
          <strong title="Click to edit title">
            {{ title }}
          </strong>
        </div>
        <textarea
          v-else
          ref="titleInput"
          v-model="title"
          @blur="saveTitle"
          @keydown.enter.prevent="saveTitle"
          @click.stop
          class="title-input"
          rows="2"
        ></textarea>
      </div>
       <button @click.stop="handleDeleteNode" class="delete-node-btn" title="Delete Node">×</button>
    </div>

    <div class="rationales-list" ref="listContainerRef" @wheel.stop>
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
          @input="handleTextInput($event)"
          @keydown="handleKeyDown($event)"
          v-text="rationale"
        ></div>
       
        <div class="rationale-actions">
           <button class="action-btn delete-btn" @click.stop="deleteRationale(index)" title="Delete this item">-</button>
          <button class="create-node-btn" @click.stop="handleCreateNode(rationale)" title="Create node from this text">
            + Create Node
          </button>
        </div>
      </div>
    </div>
    
    <div class="node-footer">
      <button @click="addNewRationale" class="add-new-btn" title="Add a new item to the end">
        + 
      </button>
      
    </div>
    <div class="node-footer2">
      
      <button @click="handleSendData" class="send-data-btn" :disabled="isSending" title="">
        <div v-if="isSending" class="spinner"></div>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
          </svg>
      </button>
    </div>
  </div>

  <Teleport to="body">
    <div v-if="draggedItemClone" class="rationale-item rationale-item-clone" :style="cloneStyle">
      <div class="rationale-text">{{ draggedItemClone.text }}</div>
    </div>
  </Teleport>
</template>

<style scoped>
/* Base Styles (unchanged) */
.text-node-container {
  width: 100%;
  height: 100%;
  background-color: #fefce8;
  border: 1px solid #b7c0ce;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: 'JetBrains Mono', sans-serif;
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}
/* ✨ 修改点: 为头部添加 flex 布局 */
.node-header {
  padding: 8px 12px;
  background-color: transparent; /* 改为透明 */
  /* border-bottom: 1px solid #fef9c8; */ /* 移除边框 */
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
/* ✨ 新增: 包装器样式，确保标题部分能正确伸缩 */
.title-wrapper {
  flex-grow: 1;
  min-width: 0;
}
/* 用下面的代码块完全替换掉旧的 .node-header strong 样式 */
.node-header strong {
  font-weight: 600;
  font-size: 14px;
  color: #4b5563;
  cursor: pointer;
  display: inline-block; 
  white-space: normal;
  min-height: 2.8em;
  line-height: 1.4em;
  width: 100%;
  word-break: break-all;
  background-image: linear-gradient(to top, #888 1px, transparent 1px);
  background-repeat: repeat-y;
  background-size: 100% 1.4em;
}
/* 用下面的代码块完全替换掉旧的 .title-input 样式 */
.title-input {
  width: 100%;
  background: transparent;
  border: transparent;
  border-radius: 4px;
  padding: 0;
  margin: 0;
  color: #334155;
  font-family: 'JetBrains Mono', sans-serif;
  font-size: 14px;
  font-weight: 600;
  outline: none;
  box-sizing: border-box;
  resize: none;
  line-height: 1.4em;
  height: 2.8em;
  background-image: linear-gradient(to top, #888 1px, transparent 1px);
  background-repeat: repeat-y;
  background-size: 100% 1.4em;
}

/* ✨ 新增: 删除按钮的样式 */
.delete-node-btn {
  background: none;
  border: none;
  font-size: 22px;
  font-weight: 600;
  cursor: pointer;
  color: #adb5bd;
  transition: color 0.2s ease, transform 0.2s ease;
  padding: 0;
  line-height: 1;
  flex-shrink: 0;
}
.delete-node-btn:hover {
  color: #e74c3c;
  transform: scale(1.1);
}

.rationales-list {
  flex-grow: 1; padding: 8px; overflow-y: auto; 
  display: flex; flex-direction: column; gap: 8px;
}
.rationales-list::-webkit-scrollbar { width: 8px; }
.rationales-list::-webkit-scrollbar-track { background: #fef9c3; border-radius: 4px; }
.rationales-list::-webkit-scrollbar-thumb { background-color: #fde047; border-radius: 4px; border: 2px solid #fef9c3; }
.rationales-list::-webkit-scrollbar-thumb:hover { background-color: #facc15; }

.rationale-item {
  background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;
  padding: 12px; font-size: 13px; color: #334155; cursor: grab;
  position: relative; min-height: 95px; 
  transition: height 0.2s ease-in-out, border-color 0.2s ease, box-shadow 0.2s ease;
  overflow: hidden; display: flex;
}
.rationale-item:hover { border-color: #3b82f6; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
.rationale-text {
  flex-grow: 1; margin: 0; white-space: pre-wrap; word-break: break-word;
  padding: 4px; border-radius: 4px; transition: background-color 0.2s;
  cursor: text; overflow-y: hidden;
}
.rationale-text:focus { outline: none; background-color: #eff6ff; box-shadow:transparent; }

.rationale-actions {
  position: absolute;
  bottom: 8px;
  left: 28px;   /* Position the container from the left */
  right: 8px; 
  opacity: 0;
  transition: opacity 0.2s ease-in-out;

 display: flex;
  justify-content: flex-end; /* 将所有项目对齐到容器的末尾（右侧） */
  align-items: center;
  gap: 8px; 
}

.delete-btn {
  /* The delete button no longer needs absolute positioning relative to its parent */
  /* We can remove the positioning properties */
  background-color: #fffbeb;
  color: #c3c4c6;
  border: 2px solid #c3c4c6;
}

.rationale-item:hover .rationale-actions {
  opacity: 1;
}



.action-btn {
  background-color: #fffbeb; color: #c3c4c6; border: 2px solid #c3c4c6;
  border-radius: 6px; padding: 4px; font-size: 12px; cursor: pointer;
  width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
  transition: all 0.2s ease;
}
.action-btn:hover { background-color: #cbd5e1; border-color: #94a3b8; }
.delete-btn:hover { background-color: #fee2e2; color: #ef4444; border-color: #fca5a5; }

.create-node-btn {
  background-color: #3b82f6; color: white; border: none; border-radius: 6px;
  padding: 4px 8px; font-size: 10px; font-weight: 500; cursor: pointer;
  transition: background-color 0.2s ease;
}
.create-node-btn:hover { background-color: #2563eb; }

.node-footer {
  padding: 6px;  background-color: #fefce8;
  flex-shrink: 0; display: flex; justify-content: space-between; align-items: center;
}
.node-footer2 {
  padding: 6px; background-color: #fefce8;
  flex-shrink: 0; display: flex; justify-content: flex-end; align-items: center;
}
.add-new-btn {
  background-color: #fffbeb; color: #c3c4c6; border: 2px solid #c3c4c6;
  border-radius: 8px; padding: -1px 8px; font-size: 13px; font-weight: 500;
  cursor: pointer; transition: all 0.2s ease;
  width: 24px;
  height: 24px;
}
.add-new-btn:hover {
  background-color: #fef9c3; border-color: #eab308;
  border-style: solid; color: #a16207;
}

.send-data-btn {
  background: transparent;
  color: #495057; /* Icon color */
  border: 1.5px solid #c3c4c6; /* Use a slightly thicker border */
  border-radius: 50%; /* Perfect circle */
  width: 24px; /* Fixed width */
  height: 24px; /* Fixed height */
  padding: 0; /* Remove padding to center icon */
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease-in-out; /* Transition all properties */
}
.send-data-btn:hover:not(:disabled) {
  background-color: #fef9c3; /* Fill with border color on hover */
  border-color: #eab308;
  color: white; /* Icon becomes white */
  transform: scale(1.1); /* A nice pop effect */
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
.send-data-btn:disabled {
  background-color: #e9ecef;
  border-color: #ced4da;
  color: #adb5bd;
  cursor: not-allowed;
}

.spinner {
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: #fff;
  width: 16px;
  height: 14px;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
/* Spinner inside disabled button */
.send-data-btn:disabled .spinner {
    border-top-color: #adb5bd;
}

/* Drag & Drop Styles (unchanged) */
.rationale-item-clone { cursor: grabbing; box-shadow: 0 10px 25px rgba(0,0,0,0.2); transform: scale(1.05); background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; font-size: 13px; font-family: 'JetBrains Mono', sans-serif; color: #334155; }
.is-dragging-placeholder { background-color: #f0f9ff; border-color: #bae6fd; border-style: dashed; }
.is-dragging-placeholder > * { opacity: 0; }
.is-drop-target { background-color: #dbeafe; border-color: transparent; }

:deep(.vue-flow__handle) {
  width: 10px;
  height: 10px;
  background-color: transparent;
  border: none; /* Use none instead of transparent for border */
}

/* Hide the resizer line and handles by default */
:deep(.vue-flow__node-resizer .vue-flow__handle) {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background-color: transparent;
  border: none;
}
/* This specifically targets the border of the resizer component */
:deep(.vue-flow__node-resizer) {
  border-color: transparent;
}
</style>