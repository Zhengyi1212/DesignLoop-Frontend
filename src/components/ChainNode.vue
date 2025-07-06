<script setup>
import { computed } from 'vue';
import { Handle, Position } from '@vue-flow/core';
import { NodeResizer } from '@vue-flow/node-resizer';

const props = defineProps({
  id: { type: String, required: true },
  data: { type: Object, required: true },
  position: { type: Object, required: true },
  selected: { type: Boolean, default: false },
});

const emit = defineEmits(['delete', 'add-text-node']);

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
    :class="{ 'is-text-node': data.isTextNode }"
    :style="[nodeSelectionStyle, data.color ? { backgroundColor: data.color } : {}]"
  >
    <NodeResizer
      v-if="id !== 'ghost-node'"
      :min-width="180"
      :min-height="60"
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
      <div class="node-content">
        <p class="content-display">{{ data.content || '...' }}</p>
      </div>

      <button v-if="id !== 'ghost-node' && !data.isTextNode" class="action-btn" @click.stop="handleAddTextClick" title="Show Rationale">Rationale</button>
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
    justify-content: center;
}
.node-content {
  font-size: 13px;
  color: #2c3e50;
  overflow-y: auto;
  cursor: default;
}
.content-display {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

/* MODIFIED: Removed .node-actions and applied shared styles directly to buttons */
.delete-btn, .action-btn {
  position: absolute; /* Each button is positioned independently */
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  opacity: 0; /* Buttons are invisible by default */
}

/* Buttons become visible when hovering over the node */
.chain-node:hover .delete-btn,
.chain-node:hover .action-btn {
    opacity: 1;
}

/* MODIFIED: Delete button positioned top-right */
.delete-btn {
  top: 8px;
  right: 8px;
  background: rgba(0,0,0,0.1);
  border-radius: 50%;
  width: 22px;
  height: 22px;
  font-size: 16px;
  color: #555;
  line-height: 1;
}
.delete-btn:hover {
  background: #e74c3c;
  color: white;
  transform: scale(1.1);
}

/* UNCHANGED: Rationale button remains bottom-right */
.action-btn {
  bottom: 8px;
  right: 8px;
  background: #e9ecef;
  color: #495057;
  border-radius: 5px;
  padding: 5px 12px;
  font-size: 12px;
  font-family: 'JetBrains Mono', sans-serif;
  font-weight: 500;
}
.action-btn:hover {
  background: #3498db;
  color: white;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

/* Deep styles for handles and resizer remain unchanged */
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