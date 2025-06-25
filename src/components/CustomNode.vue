<script setup>
import { Handle, Position } from '@vue-flow/core';

const props = defineProps({
  id: {
    type: String,
    required: true,
  },
  data: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(['delete', 'open-canvas']);

/**
 * Emits a 'delete' event with the node's ID.
 * .stop prevents the dblclick event from firing simultaneously.
 */
function onDelete() {
  emit('delete', props.id);
}

/**
 * Emits an 'open-canvas' event when the node is double-clicked.
 * App.vue listens for this to open the SubCanvas window.
 */
function onOpenCanvas() {
  emit('open-canvas', props.id);
}
</script>

<template>
  <div class="custom-node" @dblclick="onOpenCanvas" title="Double-click to open sub-canvas">
    <Handle type="target" :position="Position.Top" />
    
    <div class="node-header">
      <strong>{{ data.title || 'New Node' }}</strong>
      <button class="delete-btn" @click.stop="onDelete" title="Delete Node">×</button>
    </div>

    <div class="node-content">
      <p>{{ data.content || 'Double-click to open...' }}</p>
    </div>

    <Handle type="source" :position="Position.Bottom" />
  </div>
</template>

<style scoped>
/* Styles for CustomNode remain the same. */
.custom-node {
  width: 200px; background-color: #ffffff; border: 1px solid #34495e;
  border-radius: 8px; font-family: 'JetBrains Mono', sans-serif;
  box-shadow: 0 4px 8px rgba(0,0,0,0.1); transition: box-shadow 0.2s, transform 0.2s;
  cursor: pointer;
}
.vue-flow__node-selected .custom-node {
    box-shadow: 0 0 0 2px #3498db, 0 6px 15px rgba(0,0,0,0.2);
    transform: translateY(-2px);
}
.node-header {
  background-color: #34495e; color: white; padding: 8px 12px;
  border-top-left-radius: 7px; border-top-right-radius: 7px;
  display: flex; justify-content: space-between; align-items: center;
}
.node-content {
  padding: 12px; font-size: 13px; color: #2c3e50;
}
.node-content p {
  margin: 0; white-space: pre-wrap; word-break: break-word;
}
.delete-btn {
  background: none; border: none; color: white; font-size: 22px;
  cursor: pointer; padding: 0 5px; line-height: 1; opacity: 0.8;
  transition: opacity 0.2s;
}
.delete-btn:hover {
  opacity: 1; color: #e74c3c;
}
</style>