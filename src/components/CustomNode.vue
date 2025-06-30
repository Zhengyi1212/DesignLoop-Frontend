<script setup>
import { computed, ref, nextTick } from 'vue';
import { Handle, Position } from '@vue-flow/core';
import { NodeResizer } from '@vue-flow/node-resizer';

const props = defineProps({
  id: { type: String, required: true },
  data: { type: Object, required: true },
  selected: { type: Boolean, default: false },
});

// Add a new event for updating node data
const emit = defineEmits(['delete', 'open-canvas', 'update-node-data']);

// --- New Feature: In-place Editing ---

const isEditingTitle = ref(false);
const isEditingContent = ref(false);
const titleInput = ref(null);
const contentInput = ref(null);

// Function to enter title editing mode
function startEditTitle() {
  // Do not allow editing for the ghost node
  if (props.id === 'ghost-node') return;
  isEditingTitle.value = true;
  // Use nextTick to ensure the input is in the DOM before we try to focus it
  nextTick(() => {
    titleInput.value?.focus();
    titleInput.value?.select();
  });
}

// Function to enter content editing mode
function startEditContent() {
  if (props.id === 'ghost-node') return;
  isEditingContent.value = true;
  nextTick(() => {
    contentInput.value?.focus();
  });
}

// Function to save changes and exit editing mode
function saveChanges() {
  // Emit an event with the node's ID and the new data
  emit('update-node-data', {
    id: props.id,
    data: {
      title: props.data.title,
      content: props.data.content,
    }
  });
  // Reset editing flags
  isEditingTitle.value = false;
  isEditingContent.value = false;
}

// --- Existing Computed Properties ---

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

// --- Existing Functions ---

function onDelete() {
  emit('delete', props.id);
}

function onOpenCanvas() {
  // Do not open sub-canvas if we are currently editing text
  if (isEditingTitle.value || isEditingContent.value) return;
  if (props.id === 'ghost-node') return;
  emit('open-canvas', props.id);
}
</script>

<template>
  <div
    class="custom-node"
    :class="{ 'is-editing': isEditingTitle || isEditingContent }"
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
      <!-- Title Section: Toggles between display and input -->
      <strong
        v-if="!isEditingTitle"
        @click.stop="startEditTitle"
        title=""
      >
        {{ data.title || 'New Node' }}
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
      <button v-if="id !== 'ghost-node' && !isEditingTitle" class="delete-btn" @click.stop="onDelete" title="Delete Node">×</button>
    </div>

    <div class="node-content" @click.stop="startEditContent" title="">
      <!-- Content Section: Toggles between display and textarea -->
      <p v-if="!isEditingContent" class="content-display">{{ data.content || '' }}</p>
      <textarea
        v-else
        ref="contentInput"
        v-model="data.content"
        @blur="saveChanges"
        @click.stop
        class="content-input"
      ></textarea>
    </div>
  </div>
</template>

<style scoped>
.custom-node {
  background-color: #ffffff;
  border: 1px solid #b7c0ce;
  border-radius: 8px;
  font-family: 'JetBrains Mono', sans-serif;
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
  transition: box-shadow 0.2s, transform 0.2s;
  cursor: grab;
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}
.custom-node.is-editing {
  cursor: default;
}
.vue-flow__node-selected .custom-node {
  border-color: transparent;
}
.node-header {
  color: white;
  padding: 8px 12px;
  border-top-left-radius: 7px;
  border-top-right-radius: 7px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background-color 0.2s;
}
.node-header strong {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: text;
  width: 100%;
}
.title-input {
  background-color: transparent;
  color: white;
  border: none;
  outline: none;
  font-family: 'JetBrains Mono', sans-serif;
  font-size: 1em;
  font-weight: bold;
  width: 100%;
  padding: 0;
  margin: 0;
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
.content-input {
  width: 100%;
  height: 100%;
  border: none;
  outline: none;
  resize: none;
  background-color: #f0f2f5;
  border-radius: 4px;
  padding: 8px;
  box-sizing: border-box;
  font-family: 'JetBrains Mono', sans-serif;
  font-size: 13px;
  color: #2c3e50;
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
}
.delete-btn:hover {
  opacity: 1;
}

:deep(.resizer-handle) {
  width: 8px;
  height: 8px;
  background-color: #6366F1;
  border-radius: 2px;
  border: 1px solid white;
}
:deep(.resizer-line) {
  border-color: #6366F1;
}
:deep(.vue-flow__handle) {
  width: 8px;
  height: 8px;
  background-color: #9e9e9e;
  border: 1px solid #f0f0f0;
}
:deep(.vue-flow__handle:hover) {
  background-color: #007bff;
}
</style>
