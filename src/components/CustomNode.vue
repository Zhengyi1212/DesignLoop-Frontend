<script setup>
import { computed, ref, nextTick, watch } from 'vue';
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
    default: () => ({ rationales: [], content: '', color: '#34495e' }),
  },
  selected: { type: Boolean, default: false },
});

const emit = defineEmits(['delete', 'open-canvas', 'update-node-data', 'snapshot-dropped', 'content-changed']);

const rationales = ref([]);
const listContainerRef = ref(null);
const content = computed(() => rationales.value.join('\n\n'));

if (props.data.rationales && props.data.rationales.length > 0) {
  rationales.value = [...props.data.rationales];
} else if (props.data.content) {
  rationales.value = props.data.content.split(/\n\s*\n/).filter(r => r.trim() !== '');
  if (rationales.value.length === 0) rationales.value = [props.data.content];
} else {
  rationales.value = [''];
}
if (rationales.value.length === 0) {
    rationales.value.push('');
}

watch(() => props.data.rationales, (newRationales) => {
  if (newRationales && JSON.stringify(newRationales) !== JSON.stringify(rationales.value)) {
    rationales.value = newRationales;
    if (rationales.value.length === 0) {
      rationales.value.push('');
    }
  }
}, { deep: true });

// =================================================================
// --- BUG修复：Markdown编辑与回车键逻辑 ---
// =================================================================

const editingRationaleIndex = ref(null);
const rationaleTextareaRefs = ref([]);


function getRenderedHtml(rationale, index) {
  let contentToRender = rationale || '';
  const title = props.data.title || '';

  // 保持原有逻辑：如果第一行是匹配标题的H1，则不渲染它
  if (index === 0 && contentToRender && title) {
    const lines = contentToRender.split('\n');
    const firstLine = lines[0].trim();
    const potentialTitleInContent = firstLine.startsWith('# ')
      ? firstLine.substring(2).trim()
      : null;
    if (potentialTitleInContent && potentialTitleInContent === title.trim()) {
      contentToRender = lines.slice(1).join('\n').trim();
    }
  }
  return marked(contentToRender);
}

async function startEditing(index) {
  editingRationaleIndex.value = index;
  await nextTick();
  const textareaEl = rationaleTextareaRefs.value[index];
  if (textareaEl) {
    textareaEl.focus();
    textareaEl.style.height = 'auto';
    textareaEl.style.height = `${textareaEl.scrollHeight}px`;
  }
}

function stopEditing(index) {
  if (editingRationaleIndex.value === index) {
    editingRationaleIndex.value = null;
  }
}

function handleTextareaInput(event, index) {
    const textarea = event.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
    if (rationales.value[index] !== textarea.value) {
        rationales.value[index] = textarea.value;
        emitUpdate();
    }
}

async function handleKeyDown(event, index) {
  if (event.key === 'Enter' && event.shiftKey) {
    return;
  }

  if (event.key === 'Enter') {
    const textarea = event.target;
    const isLastItem = index === rationales.value.length - 1;
    const text = textarea.value;
    const cursorPosition = textarea.selectionStart;

    if (isLastItem && cursorPosition === text.length && text.endsWith('\n')) {
      event.preventDefault();
      rationales.value[index] = text.trimEnd();
      emitUpdate();
      await addNewRationale(true);
    }
  }
}

// =================================================================
// --- 拖拽排序逻辑 (保持不变) ---
// =================================================================
const isDragging = ref(false);
const draggedIndex = ref(null);
const dragOverIndex = ref(null);
const draggedItemClone = ref(null);
const cloneStyle = ref({});

function handleMouseDown(event, index) {
  if (event.target.closest('.rationale-actions') || editingRationaleIndex.value !== null) {
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

async function addNewRationale(focus = true) {
  rationales.value.push('');
  emitUpdate();

  if (focus) {
    await nextTick();
    startEditing(rationales.value.length - 1);
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

const isEditingTitle = ref(false);
const titleInput = ref(null);

function startEditTitle() {
  if (props.id === 'ghost-node') return;
  isEditingTitle.value = true;
  nextTick(() => {
    titleInput.value?.focus();
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

const dynamicBackgroundStyle = computed(() => ({
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
  if (isEditingTitle.value || editingRationaleIndex.value !== null) return;
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
    <NodeResizer v-if="id !== 'ghost-node'" :min-width="160" :min-height="140" :visible="selected"
      line-class-name="resizer-line" handle-class-name="resizer-handle" />

    <template v-if="id !== 'ghost-node'">
      <Handle id="top" :position="Position.Top" />
      <Handle id="left" :position="Position.Left" />
      <Handle id="bottom" :position="Position.Bottom" />
      <Handle id="right" :position="Position.Right" />
    </template>

    <div class="node-header" :style="dynamicBackgroundStyle">
      <div class="title-container" v-if="!isEditingTitle">
        <strong @click.stop="startEditTitle" title="Click to edit title">
          {{ data.title || "Name the design step" }}
        </strong>
      </div>
      <textarea v-else ref="titleInput" v-model="data.title" @blur="saveTitle" @keydown.enter.prevent="saveTitle" @click.stop
        @mousedown.stop class="title-input" rows="1">
      </textarea>
      <div v-if="data.appliedSnapshotId" class="snapshot-indicator" title="Applied Snapshot">
        <span class="icon" :style="{ backgroundColor: data.appliedSnapshotColor || '#27ae60' }"></span>
        ID:{{ data.appliedSnapshotId }}
      </div>
      <button v-if="!isEditingTitle" class="delete-btn" @click.stop="onDelete" title="Delete Node">×</button>
    </div>

    <div class="rationales-list" ref="listContainerRef" :style="dynamicBackgroundStyle">
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
        <!-- 显示模式: 从计算属性中获取渲染后的HTML -->
        <!-- --- 核心修改：将 v-if/v-else 替换为 v-show --- -->
        <!-- v-show 仅切换 display 属性，而不是从DOM中移除元素，这在复杂组件中更稳定 -->

        <!-- 显示模式 -->
        <div
          v-show="editingRationaleIndex !== index"
          class="rationale-content markdown-body"
          @click.stop="startEditing(index)"
          v-html="getRenderedHtml(rationale, index)"
        ></div>

        <!-- 编辑模式 -->
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
  background-color: #ffffff;
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
  color: black;
  padding: 8px 12px;
  border-top-left-radius: 7px;
  border-top-right-radius: 7px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background-color 0.2s;
  flex-shrink: 0;
  gap: 8px;
}

.title-container {
  flex-grow: 1;
  min-width: 0;
}

.node-header strong {
  white-space: normal;
  cursor: text;
  display: inline-block;
  min-height: 2.8em;
  line-height: 1.4em;
  width: 100%;
  word-break: break-all;
  background-image: linear-gradient(to top, #888 1px, transparent 1px);
  background-repeat: repeat-y;
  background-size: 100% 1.4em;
}

.title-input {
  background-color: transparent;
  color: black;
  border: none;
  outline: none;
  font-family: Arial;
  font-size: 13px;
  font-weight: bold;
  width: 100%;
  padding: 0;
  margin: 0;
  flex-grow: 1;
  min-width: 0;
  resize: none;
  line-height: 1.4em;
  height: 2.8em;
  background-image: linear-gradient(to top, #888 1px, transparent 1px);
  background-repeat: repeat-y;
  background-size: 100% 1.4em;
}

.rationales-list {
  flex-grow: 1;
  padding: 8px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.delete-btn {
  background: none;
  border: none;
  color: #3c3c3c ;
  font-size: 22px;
  cursor: pointer;
  padding: 0 5px;
  line-height: 1;
  opacity: 0.8;
  transition: opacity 0.2s;
  flex-shrink: 0;
}

.delete-btn:hover {
  opacity: 1;
  color: #e74c3c;
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
  padding-bottom: 28px;
}
.rationale-item.is-editing {
  cursor: default;
}
.rationale-item:hover {
  border-color: #3b82f6;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}

.rationale-content {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.2s;
  min-height: 1.5em; 
  line-height: 1.5;
  width: 100%;
  box-sizing: border-box;
}

.markdown-body {
  cursor: text;
}
.markdown-body:empty::before {
  content: 'Click to edit or drop snapshot...';
  color: #9ca3af;
  font-style: italic;
  pointer-events: none;
}

.rationale-textarea {
  border: none;
  outline: none;
  background-color: #eff6ff; 
  box-shadow: 0 0 0 2px #3b82f6 inset; 
  font-family: inherit;
  font-size: inherit;
  color: inherit;
  resize: none; 
  overflow-y: hidden; 
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4),
.markdown-body :deep(h5),
.markdown-body :deep(h6) {
    margin-top: 0.8em;
    margin-bottom: 0.4em;
    font-weight: 600;
    line-height: 1.25;
}
.markdown-body :deep(h1) { font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: .3em;}
.markdown-body :deep(h2) { font-size: 1.3em; border-bottom: 1px solid #eaecef; padding-bottom: .3em;}
.markdown-body :deep(h3) { font-size: 1.15em; }
.markdown-body :deep(p) { margin-top: 0; margin-bottom: 0.8em; }
.markdown-body :deep(ul),
.markdown-body :deep(ol) {
    padding-left: 2em;
    margin-top: 0;
    margin-bottom: 0.8em;
}
.markdown-body :deep(li) {
    margin-bottom: 0.2em;
}
.markdown-body :deep(code) {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
    background-color: rgba(27,31,35,0.05);
    padding: 0.2em 0.4em;
    font-size: 85%;
    border-radius: 3px;
}
.markdown-body :deep(pre) {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
    background-color: #f6f8fa;
    padding: 1em;
    border-radius: 6px;
    overflow-x: auto;
    line-height: 1.45;
}
.markdown-body :deep(pre code) {
    padding: 0;
    background-color: transparent;
    font-size: 100%;
}
.markdown-body :deep(blockquote) {
    border-left: 0.25em solid #dfe2e5;
    padding: 0 1em;
    color: #6a737d;
    margin-left: 0;
    margin-right: 0;
}
.markdown-body :deep(hr) {
    height: .25em;
    padding: 0;
    margin: 24px 0;
    background-color: #e1e4e8;
    border: 0;
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
