<script setup>
import { ref, computed, nextTick, watch, onMounted } from 'vue';
import { Handle, Position } from '@vue-flow/core';
import { NodeResizer } from '@vue-flow/node-resizer';
import { marked } from 'marked';

defineOptions({
  inheritAttrs: false,
});

const props = defineProps({
  id: { type: String, required: true },
  data: {
    type: Object,
    required: true,
    default: () => ({ title: 'Send a request to AI or create a new name...', rationales: [] , parent_content:'',}),
  },
  // Other props from Vue Flow are implicitly passed
});

const emit = defineEmits(['create-node-from-text', 'update-node-data', 'regenerate', 'delete']);

// --- State ---
const title = ref(props.data.title || 'Send a request to AI or create a new name...');
const rationales = ref(props.data.rationales && props.data.rationales.length > 0 ? props.data.rationales : ['']);
const parent_content = ref(props.data.parent_content || '')
const listContainerRef = ref(null);
const isEditingTitle = ref(false);
const titleInput = ref(null);
const isSending = ref(false);

// --- Watchers ---
watch(() => props.data, (newData) => {
  title.value = newData.title || 'Send a request to AI or create a new name...';
  rationales.value = newData.rationales && newData.rationales.length > 0 ? newData.rationales : [''];
}, { deep: true });

// --- Core Data Update Function ---
function emitDataUpdate() {
  emit('update-node-data', {
    id: props.id,
    data: {
      title: title.value,
      rationales: rationales.value,
      parent_content: parent_content.value,
    }
  });
}

// =================================================================
// --- 核心修改：从 CustomNode 移植 Markdown 和 Enter 键逻辑 ---
// =================================================================

const editingRationaleIndex = ref(null);
const rationaleTextareaRefs = ref([]);

// 1. Markdown 渲染函数
function getRenderedHtml(rationale) {
  return marked(rationale || '');
}

// 2. 切换到编辑模式
async function startEditing(index) {
  editingRationaleIndex.value = index;
  await nextTick();
  const textareaEl = rationaleTextareaRefs.value[index];
  if (textareaEl) {
    textareaEl.focus();
    // 自动调整高度
    textareaEl.style.height = 'auto';
    textareaEl.style.height = `${textareaEl.scrollHeight}px`;
  }
}

// 3. 退出编辑模式
function stopEditing(index) {
  if (editingRationaleIndex.value === index) {
    editingRationaleIndex.value = null;
    emitDataUpdate(); // 确保在退出时数据被保存
  }
}

// 4. 处理文本域输入
function handleTextareaInput(event, index) {
    const textarea = event.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
    if (rationales.value[index] !== textarea.value) {
        rationales.value[index] = textarea.value;
        emitDataUpdate();
    }
}

// 5. 重新定义键盘事件
async function handleKeyDown(event, index) {
  // Shift+Enter = 换行 (默认行为)
  if (event.key === 'Enter' && event.shiftKey) {
    return;
  }

  // Enter 键逻辑
  if (event.key === 'Enter') {
    const textarea = event.target;
    const isLastItem = index === rationales.value.length - 1;
    const text = textarea.value;
    const cursorPosition = textarea.selectionStart;

    // 在最后一个文本块的末尾空行处按回车，创建新块
    if (isLastItem && cursorPosition === text.length && text.endsWith('\n')) {
      event.preventDefault();
      rationales.value[index] = text.trimEnd();
      await addNewRationale(true); // 创建并聚焦新块
    }
  }
}

// 6. 更新 addNewRationale 以配合新的编辑模式
async function addNewRationale(focus = false) {
  rationales.value.push('');
  emitDataUpdate();
  if (focus) {
    await nextTick();
    startEditing(rationales.value.length - 1);
  }
}

// =================================================================
// --- 原有函数 (稍作调整) ---
// =================================================================

function startEditTitle() {
  isEditingTitle.value = true;
  nextTick(() => { titleInput.value?.focus(); });
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
  setTimeout(() => { isSending.value = false; }, 2000);
}

function handleDeleteNode() {
  emit('delete', props.id);
}

function deleteRationale(index) {
  if (rationales.value.length > 1) {
    rationales.value.splice(index, 1);
  } else {
    rationales.value[0] = ''; // 剩最后一个时清空内容
  }
  emitDataUpdate();
}

function handleCreateNode(text) {
  emit('create-node-from-text', text);
}

// --- 拖拽逻辑 (保持不变) ---
const isDragging = ref(false);
const draggedIndex = ref(null);
const dragOverIndex = ref(null);
const draggedItemClone = ref(null);
const cloneStyle = ref({});

function handleMouseDown(event, index) {
  event.stopPropagation();
  if (event.target.closest('.rationale-actions') || editingRationaleIndex.value !== null) {
    return;
  }
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
</script>

<template>
  <div class="text-node-container">
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
          'is-drop-target': isDragging && dragOverIndex === index,
          'is-editing': editingRationaleIndex === index
        }"
        @mousedown="handleMouseDown($event, index)"
      >
        <!-- 核心修改: 使用v-show切换显示/编辑模式 -->
        <div
          v-show="editingRationaleIndex !== index"
          class="rationale-content markdown-body"
          @click.stop="startEditing(index)"
          v-html="getRenderedHtml(rationale)"
        ></div>

        <textarea
          v-show="editingRationaleIndex === index"
          :ref="el => { if (el) rationaleTextareaRefs[index] = el }"
          :value="rationale"
          @input="handleTextareaInput($event, index)"
          @blur="stopEditing(index)"
          @keydown="handleKeyDown($event, index)"
          @click.stop
          @mousedown.stop
          class="rationale-content rationale-textarea"
        ></textarea>

        <div class="rationale-actions">
           <button class="action-btn delete-btn" @click.stop="deleteRationale(index)" title="Delete this item">-</button>
          <button class="create-node-btn" @click.stop="handleCreateNode(rationale)" title="Create node from this text">
            + Create Node
          </button>
        </div>
      </div>
    </div>
    
    <div class="node-footer">
      <button @click="addNewRationale(false)" class="add-new-btn" title="Add a new item to the end">
        + 
      </button>
    </div>
    <div class="node-footer2">
      <button @click="handleSendData" class="send-data-btn" :disabled="isSending" title="Regenerate">
        <div v-if="isSending" class="spinner"></div>
        <svg v-else xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
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
/* Base Styles */
.text-node-container {
  width: 100%; height: 100%; background-color: #fefce8;
  border: 1px solid #b7c0ce; border-radius: 12px;
  display: flex; flex-direction: column; overflow: hidden;
  font-family: 'JetBrains Mono', sans-serif;
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}
.node-header {
  padding: 8px 12px; background-color: transparent;
  flex-shrink: 0; display: flex; justify-content: space-between;
  align-items: center; gap: 8px;
}
.title-wrapper { flex-grow: 1; min-width: 0; }
.node-header strong {
  font-weight: 600; font-size: 14px; color: #4b5563;
  cursor: pointer; display: inline-block; white-space: normal;
  min-height: 2.8em; line-height: 1.4em; width: 100%;
  word-break: break-all;
  background-image: linear-gradient(to top, #888 1px, transparent 1px);
  background-repeat: repeat-y;
  background-size: 100% 1.4em;
}
.title-input {
  width: 100%; background: transparent; border: transparent;
  border-radius: 4px; padding: 0; margin: 0;
  color: #334155; font-family: 'JetBrains Mono', sans-serif;
  font-size: 14px; font-weight: 600; outline: none;
  box-sizing: border-box; resize: none;
  line-height: 1.4em; height: 2.8em;
  background-image: linear-gradient(to top, #888 1px, transparent 1px);
  background-repeat: repeat-y;
  background-size: 100% 1.4em;
}
.delete-node-btn {
  background: none; border: none; font-size: 22px;
  font-weight: 600; cursor: pointer; color: #adb5bd;
  transition: color 0.2s ease, transform 0.2s ease;
  padding: 0; line-height: 1; flex-shrink: 0;
}
.delete-node-btn:hover { color: #e74c3c; transform: scale(1.1); }

/* List Styles */
.rationales-list {
  flex-grow: 1; padding: 8px; overflow-y: auto;
  display: flex; flex-direction: column; gap: 8px;
}
.rationales-list::-webkit-scrollbar { width: 8px; }
.rationales-list::-webkit-scrollbar-track { background: #fef9c3; border-radius: 4px; }
.rationales-list::-webkit-scrollbar-thumb { background-color: #fde047; border-radius: 4px; border: 2px solid #fef9c3; }
.rationales-list::-webkit-scrollbar-thumb:hover { background-color: #facc15; }

/* Item Styles */
.rationale-item {
  background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;
  padding: 12px; font-size: 13px; color: #334155; cursor: grab;
  position: relative; min-height: 95px;
  transition: height 0.2s ease-in-out, border-color 0.2s ease, box-shadow 0.2s ease;
  overflow: hidden; display: flex;
}
.rationale-item:hover { border-color: #3b82f6; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
.rationale-item.is-editing { cursor: default; }

/* --- 核心样式修改 --- */
.rationale-content {
  flex-grow: 1; margin: 0; white-space: pre-wrap; word-break: break-word;
  padding: 4px; border-radius: 4px; transition: background-color 0.2s;
  min-height: 1.5em; line-height: 1.5; width: 100%;
  box-sizing: border-box;
}
.markdown-body {
  cursor: text;
  font-size: 8px; /* Adjust this value as needed */
}
.markdown-body:empty::before {
  content: 'Click to edit...';
  color: #9ca3af;
  font-style: italic;
}
.rationale-textarea {
  border: none; outline: none; background-color: #eff6ff;
  box-shadow: 0 0 0 2px #3b82f6 inset;
  font-family: inherit; font-size: inherit; color: inherit;
  resize: none; overflow-y: hidden;
}
.markdown-body :deep(p) { margin: 0 0 0.5em; }
.markdown-body :deep(h1), .markdown-body :deep(h2), .markdown-body :deep(h3) { margin: 0.5em 0; border-bottom: none; padding-bottom: 0; }
.markdown-body :deep(ul), .markdown-body :deep(ol) { padding-left: 1.5em; margin: 0.5em 0; }
.markdown-body :deep(code) { background-color: #eef2ff; padding: .2em .4em; border-radius: 4px; font-size: 0.9em; }
.markdown-body :deep(blockquote) { border-left: 3px solid #ddd; padding-left: 1em; margin-left: 0; color: #666; }


/* Actions Styles */
.rationale-actions {
  position: absolute; bottom: 8px; right: 8px;
  opacity: 0; transition: opacity 0.2s ease-in-out;
  display: flex; justify-content: flex-end; align-items: center; gap: 8px;
}
.rationale-item:hover .rationale-actions { opacity: 1; }
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

/* Footer Styles */
.node-footer, .node-footer2 {
  padding: 6px; background-color: #fefce8;
  flex-shrink: 0; display: flex; align-items: center;
}
.node-footer { justify-content: space-between; }
.node-footer2 { justify-content: flex-end; }
.add-new-btn {
  background-color: #fffbeb; color: #c3c4c6; border: 2px solid #c3c4c6;
  border-radius: 8px; padding: -1px 8px; font-size: 13px; font-weight: 500;
  cursor: pointer; transition: all 0.2s ease;
  width: 24px; height: 24px;
}
.add-new-btn:hover { background-color: #fef9c3; border-color: #eab308; color: #a16207; }
.send-data-btn {
  background: transparent; color: #495057; border: 1.5px solid #c3c4c6;
  border-radius: 50%; width: 24px; height: 24px; padding: 0;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all 0.2s ease-in-out;
}
.send-data-btn:hover:not(:disabled) {
  background-color: #fef9c3; border-color: #eab308; color: #a16207;
  transform: scale(1.1); box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
.send-data-btn:disabled { background-color: #e9ecef; border-color: #ced4da; color: #adb5bd; cursor: not-allowed; }
.spinner {
  border: 3px solid rgba(0, 0, 0, 0.1); border-radius: 50%; border-top-color: #a16207;
  width: 14px; height: 14px; animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Drag & Drop Styles */
.rationale-item-clone { 
  cursor: grabbing; box-shadow: 0 10px 25px rgba(0,0,0,0.2); transform: scale(1.05); background-color: #ffffff; 
  border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; font-size: 6px; font-family: 'JetBrains Mono', sans-serif; color: #334155; }
.is-dragging-placeholder { background-color: #f0f9ff; border-color: #bae6fd; border-style: dashed; }
.is-dragging-placeholder > * { opacity: 0; }
.is-drop-target { background-color: #dbeafe; border-color: transparent; }
:deep(.vue-flow__handle) { width: 10px; height: 10px; background-color: transparent; border: none; }
:deep(.vue-flow__node-resizer .vue-flow__handle) { width: 10px; height: 10px; border-radius: 2px; background-color: transparent; border: none; }
:deep(.vue-flow__node-resizer) { border-color: transparent; }
</style>
