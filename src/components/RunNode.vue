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
    //titleInput.value?.select();
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
    backgroundColor: 'transparent',
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
      <textarea
        v-else
        ref="titleInput"
        v-model="data.title"
        @blur="saveChanges"
        @keydown.enter.prevent="saveChanges"
        @click.stop
        class="title-input"
        rows="2"
      ></textarea>
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

    

<div class="node-footer">
    <div class="rating-group">
        <button v-if="!isRunning && !isEditingContent" class="rating-btn" @click.stop="onShowRating" title="Rate this result">
            <img src="@/assets/Group.svg" alt="Click" height="18px" width="18px">
        </button>
        <p class="text">Click to rate response</p>
    </div>

    <button v-if="!isRunning && !isEditingContent" class="run-btn" @click.stop="onRun" title="Run this node">
        <img src="@/assets/Run.svg" alt="Click to add a node" height="26px" width="26px">
    </button>
    </div>
  </div>
</template>

<style scoped>
/* 4. 修改/增加样式 */
.run-node {
  background-color: #ffffff;
  border:1px solid #b7c0ce;
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
 /* border-bottom: 0.2px solid #e8e9ea;*/
}
.node-header strong {
  white-space: normal;
  min-height: 2.8em;
  line-height: 1.4em; /* 这个值非常关键，必须与 background-size 的高度匹配 */
  display: inline-block;
  width: 100%;
  cursor: text;

  /* --- 新增/修改的下划线样式 --- */
  /* 移除旧的边框 */
  /* border-bottom: none; */
  /* padding-bottom: 0; */

  /* 使用渐变背景模拟下划线 */
  background-image: linear-gradient(to top, #888 1px, transparent 1px);
  background-repeat: repeat-y;
  background-size: 100% 1.4em; /* 宽度100%，高度必须和行高(line-height)完全一致 */
  word-break: break-all;
}
.node-content {
  padding: 12px;
  font-size: 13px;
  color: #2c3e50;
  flex-grow: 1;
  overflow-y: auto;
  cursor: text;
}
/* 添加到你的 <style> 块中 */
.rating-group {
  display: flex;
  align-items: center;
  gap: 1px; /* 在按钮和文字之间增加一点间距 */
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
    font-size: 6px;
}

.rating-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 28px;  /* 调整了尺寸以获得更好的视觉效果 */
            height: 24px;
            padding: 0 0px;
            border: transparent; /* 添加了匹配的深红色边框 */
            
            /* --- 修改的核心部分 --- */
            background-color:#F6E3E3 ; /* 深红色背景 (Dark Red) */
            color: #F35B5B ;           /* 浅红色/粉色文字 (Light Red/Pink) */
            /* --- ---------------- --- */

            border-radius: 2px; /* 调整了圆角使其更柔和 */
            cursor: pointer;
            transition: all 0.2s ease-in-out;
       
        }

        /* 鼠标悬停时的效果 */
        .rating-btn:hover {
            background-color: #922B21; /* 悬停时背景变得更深 */
            color: #FFFFFF;           /* 悬停时文字变为白色，以提供更清晰的视觉反馈 */
            transform: scale(1.05);    /* 添加轻微的放大效果 */
        }
.text {
  padding-left: 0%;
  font-size: 10px;
  color: #878787;
}
.run-btn {
  /* --- FIXES --- */
  display: flex;
  align-items: center;      /* Correct value for vertical centering */
  justify-content: center;  /* Add this for horizontal centering */
  padding: 0;               /* Remove horizontal padding */

  /* --- YOUR ORIGINAL STYLES (MOSTLY UNCHANGED) --- */
  width: 26px;
  height: 26px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  color: #495057;
  background-color: transparent;
  border: transparent;
  border-radius: 50%; /* Perfect circle */
  box-sizing: border-box; /* Good practice with borders and padding */
}

.run-btn:hover {
  background-color: #f5f3f3;;

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
  border: none;
  outline: none;
  font-family: 'JetBrains Mono', sans-serif;
  font-size: 1em;
  font-weight: bold;
  width: 100%;
  padding: 0;
  margin: 0;
  resize: none;
  line-height: 1.4em;
  height: 2.8em;
  
  /* --- 新增的下划线样式 --- */
  background-image: linear-gradient(to top, #888 1px, transparent 1px);
  background-repeat: repeat-y;
  background-size: 100% 1.4em;
}
.content-input {
  width: 100%; height: 100%; border: none; outline: none; resize: none;
  background-color: #ffffff;
  border-radius: 4px; padding: 8px; box-sizing: border-box;
  font-family: 'JetBrains Mono', sans-serif; font-size: 13px; color: #2c3e50;
}

:deep(.resizer-handle) {
  background-color: transparent;
  border:transparent;
}
:deep(.resizer-line) {
  border-color: transparent;
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
