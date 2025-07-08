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

// MODIFIED: Add 'snapshot-dropped' to the list of emitted events.
const emit = defineEmits(['delete', 'open-canvas', 'run-node', 'update-node-data', 'snapshot-dropped']);

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

// --- NEW: Drag and Drop Snapshot Logic ---
const isDraggingOver = ref(false);

function onDragOver(event) {
  event.preventDefault();
  // Provide visual feedback only if the dragged item is a snapshot.
  if (event.dataTransfer.types.includes('application/json/snapshot')) {
    isDraggingOver.value = true;
    event.dataTransfer.dropEffect = 'copy'; // Show a 'copy' cursor
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
    // Emit an event to the parent (App.vue) with the node's ID and the dropped data.
    emit('snapshot-dropped', { nodeId: props.id, snapshotData });
  } catch (e) {
    console.error("Failed to parse snapshot data on drop:", e);
  }
}

// --- Component Specific Logic & Handlers (Unchanged) ---
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

function onOpenCanvas() {
  if (isEditingTitle.value || isEditingContent.value) return;
  if (props.id === 'ghost-node') return;
  emit('open-canvas', props.id);
}

function onRun() {
  if (props.isRunning) return;
  emit('run-node', props.id);
}
</script>

<template>
  <div
    class="run-node"
    :class="{ 
      'is-editing': isEditingTitle || isEditingContent,
      'is-dragging-over': isDraggingOver // NEW: Add class for drop feedback
    }"
    :style="[
      id === 'ghost-node' ? { pointerEvents: 'none' } : {},
      nodeSelectionStyle
    ]"
    @dblclick="onOpenCanvas"
    @dragover.prevent="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <NodeResizer
      v-if="id !== 'ghost-node'"
      :min-width="200"
      :min-height="200"
      :visible="selected"
      line-class-name="resizer-line"
      handle-class-name="resizer-handle"
    />

    <template v-if="id !== 'ghost-node'">
      <Handle id="top" :position="Position.Top" />
      <Handle id="left" :position="Position.Left" />
      <Handle id="bottom" :position="Position.Bottom" />
      <Handle id="right" :position="Position.Right" />
    </template>

    <div class="node-header" :style="nodeHeaderStyle">
      <strong
        v-if="!isEditingTitle"
        @click.stop="startEditTitle"
        
      >
        {{ data.title || "New Node" }}
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
        placeholder="Click to edit..."
        class="content-input"
      ></textarea>
    </div>

    <div class="node-footer">
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
/* NEW: Style for when a snapshot is being dragged over the node */
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
    justify-content: flex-end;
    align-items: center;
    height: 40px;
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
    display: flex; justify-content: center; align-items: center; width: 100%;
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
}
</style>
