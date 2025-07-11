<script setup>
import { ref, computed, nextTick } from 'vue';
import { Handle, Position } from '@vue-flow/core';
import { NodeResizer } from '@vue-flow/node-resizer';

const props = defineProps({
  id: { type: String, required: true },
  data: {
    type: Object,
    required: true,
    default: () => ({ rationales: [] }),
  },
  selected: { type: Boolean, default: false },
});

const emit = defineEmits(['create-node-from-text', 'update:rationales']);

const rationales = ref(props.data.rationales || []);
const listContainerRef = ref(null); // Ref for the list container

// --- State for Manual Drag & Drop ---
const isDragging = ref(false);
const draggedIndex = ref(null);
const dragOverIndex = ref(null);
const draggedItemClone = ref(null); // Info for the visual clone
const cloneStyle = ref({}); // Style for the clone

// --- Mouse Down: The starting point of the drag ---
function handleMouseDown(event, index) {
  // Prevent text selection while dragging
  event.preventDefault();

  isDragging.value = true;
  draggedIndex.value = index;

  const itemElement = event.currentTarget;
  const rect = itemElement.getBoundingClientRect();

  // Create the visual clone
  draggedItemClone.value = {
    text: rationales.value[index],
    width: rect.width,
    height: rect.height,
  };

  // Position the clone exactly where the original item was
  const initialX = event.clientX - rect.left;
  const initialY = event.clientY - rect.top;
  
  cloneStyle.value = {
    position: 'fixed',
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    pointerEvents: 'none', // Make sure the clone doesn't interfere with mouse events
    zIndex: 9999,
  };

  // Add listeners to the window to track mouse movement everywhere
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
}

// --- Mouse Move: Move the clone and detect drop target ---
function handleMouseMove(event) {
  if (!isDragging.value) return;

  // Update clone position to follow the mouse
  const newTop = event.clientY - (draggedItemClone.value.height / 2);
  const newLeft = event.clientX - (draggedItemClone.value.width / 2);
  cloneStyle.value.top = `${newTop}px`;
  cloneStyle.value.left = `${newLeft}px`;

  // Determine which item we are dragging over
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

// --- Mouse Up: Finalize the drop ---
function handleMouseUp() {
  if (!isDragging.value) return;

  // Perform the reorder if we have a valid drop target
  if (dragOverIndex.value !== null && dragOverIndex.value !== draggedIndex.value) {
    const itemToMove = rationales.value.splice(draggedIndex.value, 1)[0];
    rationales.value.splice(dragOverIndex.value, 0, itemToMove);
    emit('update:rationales', { nodeId: props.id, newRationales: rationales.value });
  }

  // Cleanup
  isDragging.value = false;
  draggedIndex.value = null;
  dragOverIndex.value = null;
  draggedItemClone.value = null;
  window.removeEventListener('mousemove', handleMouseMove);
  window.removeEventListener('mouseup', handleMouseUp);
}

function handleCreateNode(text) {
  emit('create-node-from-text', text);
}

const nodeSelectionStyle = computed(() => {
  return props.selected
    ? { boxShadow: '0 0 0 2px #2563EB, 0 6px 15px rgba(0,0,0,0.2)' }
    : {};
});
</script>

<template>
  <div class="text-node-container" :style="nodeSelectionStyle">
    <NodeResizer :min-width="200" :min-height="150" :visible="selected" />
    <Handle id="top" :position="Position.Top" />
    <Handle id="bottom" :position="Position.Bottom" />
    <Handle id="left" :position="Position.Left" />
    <Handle id="right" :position="Position.Right" />

    <!-- The list container -->
    <div class="rationales-list" ref="listContainerRef">
      <div
        v-for="(rationale, index) in rationales"
        :key="rationale"
        class="rationale-item"
        :class="{ 
          'is-dragging-placeholder': isDragging && draggedIndex === index,
          'is-drop-target': isDragging && dragOverIndex === index
        }"
        @mousedown.stop="handleMouseDown($event, index)"
      >
        <p class="rationale-text">{{ rationale }}</p>
        <button class="create-node-btn" @click="handleCreateNode(rationale)" title="Create node from this text">
          + Create Node
        </button>
      </div>
    </div>
  </div>

  <!-- This is the visual clone that follows the mouse -->
  <div v-if="draggedItemClone" class="rationale-item rationale-item-clone" :style="cloneStyle">
    <p class="rationale-text">{{ draggedItemClone.text }}</p>
  </div>
</template>

<style scoped>
.text-node-container {
  width: 100%;
  height: 100%;
  background-color: #fefce8;
  border: 1px solid #eab308;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: 'JetBrains Mono', sans-serif;
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}
.node-header {
  padding: 8px 12px;
  font-weight: 600;
  color: #a16207;
  background-color: #fef9c3;
  border-bottom: 1px solid #fde047;
  flex-shrink: 0;
}
.rationales-list {
  flex-grow: 1;
  padding: 8px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rationale-item {
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
  font-size: 13px;
  color: #334155;
  cursor: grab;
  position: relative;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  overflow: hidden;
}
.rationale-item:hover {
  border-color: #3b82f6;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
.rationale-text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}
.create-node-btn {
  /* styles for create button */
  position: absolute;
  bottom: 8px;
  right: 8px;
  background-color: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 10px;
  font-weight: 500;
  cursor: pointer;
  opacity: 0;
  transform: translateY(5px);
  transition: all 0.2s ease-in-out;
}
.rationale-item:hover .create-node-btn {
  opacity: 1;
  transform: translateY(0);
}
.create-node-btn:hover {
  background-color: #2563eb;
}

/* --- Drag & Drop Styles --- */

/* This is the clone that follows the mouse */
.rationale-item-clone {
  cursor: grabbing;
  box-shadow: 0 10px 25px rgba(0,0,0,0.2);
  transform: scale(1.05);
}

/* This is the placeholder for the item being dragged */
.is-dragging-placeholder {
  background-color: #f0f9ff;
  border-color: #bae6fd;
  border-style: dashed;
}
.is-dragging-placeholder > * {
  opacity: 0; /* Hide content of the placeholder */
}

/* This highlights the potential drop location */
.is-drop-target {
  background-color: #dbeafe;
  border-color: #3b82f6;
}

/* Resizer 样式 */
:deep(.resizer-handle) {
  width: 12px;
  height: 12px;
  background-color: #2563eb;
  border-radius: 2px;
  border: 1px solid white;
}
:deep(.resizer-line) {
  border-color: #2563eb;
  border-width: 3px;
}
.text-node-container .vue-flow__handle-top,
.text-node-container .vue-flow__handle-right,
.text-node-container .vue-flow__handle-left {
  opacity: 0;  /* 完全透明 */
  

}
:deep(.vue-flow__handle) {
  width: 10px;
  height: 10px;
  background-color: #9e9e9e;
  border: 1px solid #f0f0f0;
}
</style>
