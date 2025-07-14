<script setup>
import { computed, ref, nextTick } from 'vue';
import { Handle, Position } from '@vue-flow/core';
import { NodeResizer } from '@vue-flow/node-resizer';

const props = defineProps({
  id: { type: String, required: true },
  data: { type: Object, required: true },
  selected: { type: Boolean, default: false },
  isRunning: { type: Boolean, default: false },
});

// 1. 在 emits 列表中添加 'show-rating'
const emit = defineEmits(['delete', 'run-node', 'update-node-data', 'run-triggered', 'show-rating']);

// --- In-place Editing Logic (Unchanged) ---
const isEditingTitle = ref(false);
const isEditingContent = ref(false);
const titleInput = ref(null);
const contentInput = ref(null);

function startEditTitle() {
  if (props.id === 'ghost-node') return;
  isEditingTitle.value = true;
  nextTick(() => {
    titleInput.value?.focus();
    titleInput.value?.select();
  });
}

function startEditContent() {
  if (props.id === 'ghost-node') return;
  isEditingContent.value = true;
  nextTick(() => {
    contentInput.value?.focus();
  });
}

function saveChanges() {
  emit('update-node-data', {
    id: props.id,
    data: {
      title: props.data.title,
      content: props.data.content,
    }
  });
  isEditingTitle.value = false;
  isEditingContent.value = false;
}

// --- Component Specific Logic & Handlers ---
const nodeHeaderStyle = computed(() => {
  return {
    backgroundColor: '#f1c40f',
    color: '#3d3f43'
  };
});

const nodeSelectionStyle = computed(() => {
  if (props.selected) {
    return {
      boxShadow: `0 0 0 2px #f1c40f, 0 6px 15px rgba(0,0,0,0.2)`
    };
  }
  return {};
});

function onDelete() {
  emit('delete', props.id);
}

function onRun() {
  if (props.isRunning) return;
  emit('run-triggered', props.id);
  emit('run-node', props.id);
}

// 2. 新增方法，用于触发 show-rating 事件
function onShowRating() {
  emit('show-rating', { nodeId: props.id });
}
</script>

<template>
  <div
    class="run-node"
    :class="{ 
      'is-editing': isEditingTitle || isEditingContent,
    }"
    :style="[
      id === 'ghost-node' ? { pointerEvents: 'none' } : {},
      nodeSelectionStyle
    ]"
  >
    <NodeResizer
      v-if="id !== 'ghost-node'"
      :min-width="180"
      :min-height="180"
      :visible="selected"
      line-class-name="resizer-line"
      handle-class-name="resizer-handle"
    />

    <template v-if="id !== 'ghost-node'">
      <Handle id="left" :position="Position.Left" />
      <Handle id="right" :position="Position.Right" />
    </template>

    <div class="node-header" :style="nodeHeaderStyle">
      <strong
        v-if="!isEditingTitle"
        @click.stop="startEditTitle"
      >
        {{ data.title || "Edit instruction..." }}
      </strong>
      <input
        v-else
        ref="titleInput"
        v-model="data.title"
        @blur="saveChanges"
        @keydown.enter="saveChanges"
        @click.stop
        class="title-input"
        type="text"
      />
      <button v-if="!isEditingTitle" class="delete-btn" @click.stop="onDelete" title="Delete Node">×</button>
    </div>

    <div class="node-content" @click.stop="startEditContent" title="Click to edit content">
      <p v-if="!isEditingContent" class="content-display">{{ data.content || 'Click the run button...' }}</p>
      <textarea
        v-else
        ref="contentInput"
        v-model="data.content"
        @blur="saveChanges"
        @click.stop
        readonly
        @mousedown.stop
        class="content-input"
      ></textarea>
    </div>

    <!-- 3. 修改 node-footer 结构 -->
    <div class="node-footer">
        <!-- 新增的评价按钮 -->
        <button v-if="!isRunning && !isEditingContent" class="rating-btn" @click.stop="onShowRating" title="Rate this result">
            <p>Rate</p>
        </button>

        <!-- 原有的运行按钮/加载动画 -->
        <button v-if="!isRunning && !isEditingContent" class="run-btn" @click.stop="onRun" title="Run this node">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
            </svg>
            <span>Run</span>
        </button>
        <div v-else-if="isRunning" class="spinner-container">
            <div class="spinner"></div>
        </div>
    </div>
  </div>
</template>

<style scoped>
/* 4. 修改/增加样式 */
.run-node {
  background-color: #ffffff;
  border: 1px solid #f3d179;
  border-radius: 8px;
  font-family: 'JetBrains Mono', sans-serif;
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
  cursor: grab;
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  transition: all 0.2s ease-in-out;
}
.run-node.is-dragging-over {
  outline: 3px dashed #2ecc71;
  outline-offset: 4px;
  box-shadow: 0 0 20px rgba(46, 204, 113, 0.5);
  transform: scale(1.02);
}
.run-node.is-editing {
  cursor: default;
}
.vue-flow__node-selected .run-node {
  border-color: transparent;
}
.node-header {
  padding: 8px 12px;
  border-top-left-radius: 7px;
  border-top-right-radius: 7px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.node-header strong {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
  cursor: text;
}
.node-content {
  padding: 12px;
  font-size: 13px;
  color: #2c3e50;
  flex-grow: 1;
  overflow-y: auto;
  cursor: text;
}
.content-display {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  min-height: 20px;
}
.delete-btn {
  background: none; border: none; font-size: 22px; cursor: pointer;
  padding: 0 5px; line-height: 1; opacity: 0.8; transition: opacity 0.2s;
  color: inherit;
}
.delete-btn:hover {
  opacity: 1;
}
.node-footer {
    padding: 0 12px 12px;
    display: flex;
    /* 修改为 space-between */
    justify-content: space-between; 
    align-items: center;
    height: 40px;
}

.rating-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 1px solid #bdc3c7;
    background-color: #ecf0f1;
    color: #7f8c8d;
    border-radius: 50%; /* 圆形 */
    cursor: pointer;
    transition: all 0.2s ease;
}

.rating-btn:hover {
    background-color: #bdc3c7;
    color: white;
    border-color: #95a5a6;
}

.run-btn {
    display: flex; align-items: center; gap: 8px; padding: 6px 12px;
    border: 1px solid #e67e22; background-color: #f39c12; color: white;
    border-radius: 8px; cursor: pointer; transition: all 0.2s ease;
    font-family: 'JetBrains Mono', monospace; font-size: 14px;
}
.run-btn:hover {
    background-color: #e67e22; border-color: #d35400;
}
.spinner-container {
    display: flex; justify-content: flex-end; align-items: center; width: 100%;
}
.spinner {
  border: 3px solid rgba(0,0,0,0.1); border-radius: 50%;
  border-top-color: #d35400; width: 22px; height: 22px;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
.title-input {
  background-color: transparent;
  color: #3d3f43;
  border: none; outline: none; font-family: 'JetBrains Mono', sans-serif;
  font-size: 1em; font-weight: bold; width: 100%; padding: 0; margin: 0;
}
.content-input {
  width: 100%; height: 100%; border: none; outline: none; resize: none;
  background-color: #fdf5e6;
  border-radius: 4px; padding: 8px; box-sizing: border-box;
  font-family: 'JetBrains Mono', sans-serif; font-size: 13px; color: #2c3e50;
}

:deep(.resizer-handle) {
  background-color: #f1c40f;
}
:deep(.resizer-line) {
  border-color: #f1c40f;
}
:deep(.vue-flow__handle) {
  background-color: #9e9e9e;
  width: 12px;
  height: 12px;
}
.run-node .vue-flow__handle-top,
.run-node .vue-flow__handle-bottom {
  opacity: 0;
}
</style>
