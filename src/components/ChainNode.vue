<script setup>
import { computed, ref, nextTick } from 'vue';
import { Handle, Position } from '@vue-flow/core';
import { NodeResizer } from '@vue-flow/node-resizer';

const props = defineProps({
  id: { type: String, required: true },
  data: { type: Object, required: true },
  position: { type: Object, required: true },
  selected: { type: Boolean, default: false },
  isGeneratingRationale: { type: Boolean, default: false },
});

const emit = defineEmits(['delete', 'add-text-node', 'update-content']);

const isEditing = ref(false);
const editableContent = ref(props.data.content);
const textareaRef = ref(null);

function startEditing() {
  if (props.id === 'ghost-node' || props.isGeneratingRationale) return;
  editableContent.value = props.data.content;
  isEditing.value = true;
  nextTick(() => {
    textareaRef.value?.focus();
    //textareaRef.value?.select();
  });
}

function saveEdit() {
  isEditing.value = false;
  if (props.data.content !== editableContent.value) {
    emit('update-content', { id: props.id, content: editableContent.value });
  }
}

const nodeSelectionStyle = computed(() => {
  if (props.selected) {
    return {
      boxShadow: `0 0 0 2px #6366F1, 0 6px 15px rgba(0,0,0,0.2)`
    };
  }
  return {};
});

function onDelete() {
  emit('delete', props.id);
}

function handleAddTextClick() {
    emit('add-text-node', {
        sourceNodeId: props.id,
        position: props.position
    });
}
</script>

<template>
  <div
    class="chain-node"
    :class="{ 'is-text-node': data.isTextNode, 'is-editing': isEditing }"
    :style="[nodeSelectionStyle, data.color ? { backgroundColor: data.color } : {}]"
    @wheel.capture.stop
  >
    <NodeResizer
      v-if="id !== 'ghost-node'"
      :min-width="120"
      :min-height="80"
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

    <div class="node-content-wrapper">
      <div class="node-content" @click="startEditing">
        <p v-if="!isEditing" class="content-display">{{ data.content}}</p>
        <textarea
          v-else
          ref="textareaRef"
          v-model="editableContent"
          class="content-editor"
          @blur="saveEdit"
          @keydown.enter.prevent="saveEdit"
          @keydown.esc.prevent="saveEdit"
          placeholder="Click to edit..."
          @mousedown.stop
        ></textarea>
      </div>

      <div class="node-footer">
        <button
          v-if="id !== 'ghost-node' && !data.isTextNode"
          class="action-btn"
          @click.stop="handleAddTextClick"
          :disabled="isGeneratingRationale"
          title="Show Rationale"
        >
          <div v-if="isGeneratingRationale" class="spinner"></div>
          <span v-else>Run</span>
        </button>
      </div>

      <button v-if="id !== 'ghost-node'" class="delete-btn" @click.stop="onDelete" title="Delete Node">×</button>
    </div>
  </div>
</template>

<style scoped>
.chain-node {
  background-color: #ffffff;
  border: 1px solid #b7c0ce;
  border-radius: 8px;
  font-family: 'JetBrains Mono', sans-serif;
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
  transition: all 0.2s ease-in-out;
  cursor: grab;
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  position: relative;
  overflow: hidden; 
}
.chain-node.is-text-node {
    background-color: #f7f1e3;
    border-color: #ddd;
}
.vue-flow__node-selected .chain-node {
  border-color: #6366F1;
}
.node-content-wrapper {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
   
    padding: 12px;
}

/* --- MODIFIED AND SIMPLIFIED --- */
/* This style now applies to ALL chain nodes, ensuring they can scroll long content. */
/* The incorrect flex properties have been removed. */
.node-content {
  font-size: 13px;
  color: #2c3e50;
  flex-grow: 1; /* Allows the content area to fill available space */
  
  min-height: 20px; /* Ensures the area has a minimum size */
  cursor: text;
}

/* The special styling for .is-text-node is no longer needed for overflow */
/* and has been removed to simplify the code and fix the bug. */

.content-display {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  padding: 5px;
}

.content-editor {
  width: 100%;
  height: 100%;
  border: none;
  background-color: rgba(255, 255, 255, 0.8);
  border-radius: 4px;
  padding: 5px;
  font-family: 'JetBrains Mono', sans-serif;
  font-size: 13px;
  color: #2c3e50;
  resize: none;
  box-sizing: border-box;
  outline: 2px solid #6366F1;
}
.chain-node.is-editing {
  cursor: default;
}

.delete-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0,0,0,0.1);
  border-radius: 50%;
  width: 20px;
  height: 20px;
  font-size: 16px;
  color: #555;
  line-height: 1;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  opacity: 0;
}
.chain-node:hover .delete-btn {
    opacity: 1;
}
.delete-btn:hover {
  background: #e74c3c;
  color: white;
  transform: scale(1.1);
}

/* --- NEW: Added a dedicated footer for the action button --- */
.node-footer {
  flex-shrink: 0; /* Prevents the footer from shrinking */
  padding-top: 4px;
  display: flex;
  justify-content: flex-end;
  height: 15px; /* Give footer a fixed height */
}

.action-btn {
  background: #e9ecef;
  color: #495057;
  border-radius: 5px;
  padding: 5px 12px;
  font-size: 6px;
  font-family: 'JetBrains Mono', sans-serif;
  font-weight: 500;
  width: 28px; /* Ensure button width is consistent */
  height: 18px;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

/* Make action button visible on hover, like the delete button */
.chain-node:hover .action-btn {
    opacity: 1;
}
.action-btn:hover:not(:disabled) {
  background: #3498db;
  color: white;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
.action-btn:disabled {
  cursor: not-allowed;
  background: #f8f9fa;
  opacity: 0.5;
}

.spinner {
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top-color: #495057;
  width: 14px;
  height: 10px;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

:deep(.resizer-handle) {
  width: 12px;
  height: 12px;
  background-color: #6366F1;
  border-radius: 2px;
  border: 1px solid white;
}
:deep(.resizer-line) {
  border-color: #6366F1;
  border-width: 3px;
}
:deep(.vue-flow__handle) {
  width: 10px;
  height: 10px;
  background-color: #9e9e9e;
  border: 1px solid #f0f0f0;
}
.chain-node .vue-flow__handle-top {
  opacity: 0;  
}

.chain-node .vue-flow__handle-bottom {
  opacity: 0;  
}

:deep(.vue-flow__handle:hover) {
  background-color: #007bff;
}
</style>