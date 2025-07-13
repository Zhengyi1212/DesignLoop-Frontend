<script setup>
import { computed, ref, nextTick, watch } from 'vue';
import { Handle, Position } from '@vue-flow/core';
import { NodeResizer } from '@vue-flow/node-resizer';

const props = defineProps({
  id: { type: String, required: true },
  data: { type: Object, required: true },
  selected: { type: Boolean, default: false },
});

// MODIFIED: Add 'snapshot-dropped' to the list of emitted events.
const emit = defineEmits(['delete', 'open-canvas', 'update-node-data', 'snapshot-dropped','content-changed']);

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
    console.log(snapshotData.goal)
    // Emit an event to the parent (App.vue) with the node's ID and the dropped data.
    emit('snapshot-dropped', { nodeId: props.id, snapshotData });
  } catch (e) {
    console.error("Failed to parse snapshot data on drop:", e);
  }
}

// --- Computed Properties & Functions (Unchanged) ---
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

function onDelete() {
  emit('delete', props.id);
}

function onOpenCanvas() {
  if (isEditingTitle.value || isEditingContent.value) return;
  if (props.id === 'ghost-node') return;
  emit('open-canvas', props.id);
}

watch(() => props.data.content, (newValue, oldValue) => {
  // 仅当内容实际发生有意义的改变时才触发
  // 这可以防止初始加载或无意义的重渲染触发事件
  if (newValue !== oldValue && oldValue !== undefined) {
    emit('content-changed', props.id);
  }
}, {
  deep: true // 深度监听以处理复杂内容
});
</script>

<template>
  <div class="custom-node" :class="{
    'is-editing': isEditingTitle || isEditingContent,
    'is-dragging-over': isDraggingOver  // NEW: Add class for drop feedback
  }" 
  :style="[
    id === 'ghost-node' ? { pointerEvents: 'none' } : {},
    nodeSelectionStyle
  ]"
   @dblclick="onOpenCanvas" 
  @dragover.prevent="onDragOver" 
  @dragleave="onDragLeave" 
  @drop="onDrop" 
  @wheel.stop>
    <NodeResizer v-if="id !== 'ghost-node'" :min-width="180" :min-height="180" :visible="selected"
      line-class-name="resizer-line" handle-class-name="resizer-handle" />

    <template v-if="id !== 'ghost-node'">
      <Handle id="top" :position="Position.Top" />
      <Handle id="left" :position="Position.Left" />
      <Handle id="bottom" :position="Position.Bottom" />
      <Handle id="right" :position="Position.Right" />
    </template>

    <div class="node-header" :style="nodeHeaderStyle">

      <div class="title-container" v-if="!isEditingTitle">
        <strong @click.stop="startEditTitle" title="Click to edit title">
          {{ data.title || "New Node"}}
        </strong>


      </div>

      <input v-else ref="titleInput" 
      v-model="data.title"
       @blur="saveChanges" 
       @keydown.enter="saveChanges" 
       @click.stop
       @mousedown.stop
       
        class="title-input" type="text" 
        
        />
      <div v-if="data.appliedSnapshotId" class="snapshot-indicator" title="Applied Snapshot">
        <span class="icon"></span>
        ID:{{ data.appliedSnapshotId }}
      </div>
      <button v-if="!isEditingTitle" class="delete-btn" @click.stop="onDelete" title="Delete Node">×</button>

    </div>

    <div class="node-content"
     @click.stop="startEditContent"
     title="Click to edit content"
     
     >
      <p v-if="!isEditingContent" class="content-display">{{ data.content || ''|| 'Click to edit...' }}</p>
      <textarea v-else ref="contentInput" 
      v-model="data.content" 
      @blur="saveChanges" 
      @click.stop
      @mousedown.stop
      placeholder="Click to edit..."
        class="content-input"></textarea>
    </div>

  </div>
</template>

<style scoped>
.custom-node {
  
  border: 1px solid #b7c0ce;
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
  
  background-color: v-bind('props.data.color || "#34495e"');
}

/* NEW: Style for when a snapshot is being dragged over the node */
.custom-node.is-dragging-over {
  outline: 3px dashed #2ecc71;
  outline-offset: 4px;
  box-shadow: 0 0 20px rgba(46, 204, 113, 0.5);
  transform: scale(1.02);
}

.custom-node.is-editing {
  cursor: default;
  overflow: hidden;
  
}
.custom-node.is-editing .node-content {
  overflow-y: hidden;
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
   
  height: calc(100% - 40px); 
  font-size: 13px;
  color: #2c3e50;
  flex-grow: 1;
  overflow-y: auto;
  cursor: text;
   background-color: #ffffff; /* 保持 content 区域为白色 */
  background-clip: content-box;
  border-radius: 4px; /* 可选：让 content 区域有圆角 */
}

.content-display {
  padding: 12px;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  min-height: 20px;
}

.content-input {
  padding: 12px;
  width: 100%;
  height: 100%;
  border: none;
  outline: none;
  resize: none;
  
  border-radius: 4px;
  
  box-sizing: border-box;
  font-family: 'JetBrains Mono', sans-serif;
  font-size: 14px;
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
  color: red;
}

:deep(.resizer-handle) {
  width: 8px;
  height: 8px;
  background-color: #6366F1;
  border-radius: 2px;
  border: 2px solid white;
}

:deep(.resizer-line) {
  border-color: #6366F1;
  border-width: 2px;
}

:deep(.vue-flow__handle) {
  width: 12px;
  height: 11px;
  background-color: #9e9e9e;
  border: 1px solid #f0f0f0;
}

:deep(.vue-flow__handle:hover) {
  background-color: #007bff;
}
/* 隐藏上下handle但保留功能 */
.custom-node .vue-flow__handle-top,
.custom-node .vue-flow__handle-bottom {
  opacity: 0;  /* 完全透明 */
  

}

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
  /* Allows clicks to pass through to the node */
}

.node-header .snapshot-indicator .icon {
  width: 12px;
  height: 12px;
  background-color: #27ae60;
  /* A nice green color */
  border-radius: 50%;
  margin-right: 5px;
  border: 1px solid rgba(0, 0, 0, 0.1);
}
</style>
