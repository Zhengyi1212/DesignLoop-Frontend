<script setup>
import { computed } from 'vue';
import { Handle, Position } from '@vue-flow/core';
import { NodeResizer } from '@vue-flow/node-resizer';

// Add the new isRunning prop to receive the loading state
const props = defineProps({
  id: { type: String, required: true },
  data: { type: Object, required: true },
  selected: { type: Boolean, default: false },
  isRunning: { type: Boolean, default: false },
});

const emit = defineEmits(['delete', 'open-canvas', 'run-node']);

// --- Component Specific Logic (Unchanged) ---

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

// --- Event Handlers (Unchanged) ---

function onDelete() {
  emit('delete', props.id);
}

function onOpenCanvas() {
  if (props.id === 'ghost-node') return;
  emit('open-canvas', props.id);
}

function onRun() {
  // Prevent running again if already in progress
  if (props.isRunning) return;
  emit('run-node', props.id);
}
</script>

<template>
  <div
    class="run-node"
    :style="[
      id === 'ghost-node' ? { pointerEvents: 'none' } : {},
      nodeSelectionStyle
    ]"
    @dblclick="onOpenCanvas"
  >
    <NodeResizer
      v-if="id !== 'ghost-node'"
      :min-width="200"
      :min-height="150"
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
      <strong>{{ data.title || 'Run Node' }}</strong>
      <button class="delete-btn" @click.stop="onDelete" title="Delete Node">×</button>
    </div>

    <div class="node-content">
      <p class="content-display">{{ data.content || 'Click the run button...' }}</p>
    </div>

    <div class="node-footer">
        <!-- Show the Run button only when not running -->
        <button v-if="!isRunning" class="run-btn" @click.stop="onRun" title="Run this node">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
            </svg>
            <span>Run</span>
        </button>
        <!-- Show a spinner animation while running -->
        <div v-else class="spinner-container">
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
}
.node-content {
  padding: 12px;
  font-size: 13px;
  color: #2c3e50;
  flex-grow: 1;
  overflow-y: auto;
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
    height: 40px; /* Consistent height for footer */
}
.run-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border: 1px solid #e67e22;
    background-color: #f39c12;
    color: white;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: 'JetBrains Mono', monospace;
    font-size: 14px;
}
.run-btn:hover {
    background-color: #e67e22;
    border-color: #d35400;
}
/* Styles for the loading spinner */
.spinner-container {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
}
.spinner {
  border: 3px solid rgba(0,0,0,0.1);
  border-radius: 50%;
  border-top-color: #d35400; /* Darker orange for visibility */
  width: 22px;
  height: 22px;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
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
