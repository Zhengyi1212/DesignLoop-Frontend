<script setup>
import useDragAndDrop from '../composables/useDnD';

defineProps({
  snapshots: {
    type: Array,
    required: true,
  },
});
const emit = defineEmits(['delete-snapshot']);
const { onDragStart } = useDragAndDrop();
const getRandomColor = () => {
  const hue = Math.floor(Math.random() * 360)
  return `hsl(${hue}, 80%, 90%)` // 80%饱和度 + 90%亮度 = 柔和的浅色
}
</script>

<template>
  <div class="canvas-node-panel">
    <h3 class="panel-title">

      LLM Chains
    </h3>
    <div v-if="snapshots.length === 0" class="empty-state">
      <p>No LLM chain saved yet.</p>

    </div>
    <div v-else class="snapshots-list">
      <div v-for="snapshot in snapshots" 
      :key="snapshot.id" class="snapshot-item" 
      draggable="true"
      @dragstart="onDragStart($event, snapshot)" 
      title="Drag to a node on the canvas"
      :style="{ backgroundColor: getRandomColor() }"
      >
        
        <div class="snapshot-info">
          <div class="snapshot-goal">Goal: {{ snapshot.goal }}</div>
          <div class="snapshot-goal">Instruction: {{ snapshot.data.instruction }}</div>
          <div class="snapshot-id">ID: {{ snapshot.id }}</div>
          
          
        </div>
        <button class="delete-button" @click.stop="emit('delete-snapshot', snapshot.id)" title="Delete this chain">
          ×
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.canvas-node-panel {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;

  padding: 15px;
  width: 100 px;
  border-top: 1px solid #e9ecef;
}

.panel-title {
  font-size: 16px;
  font-weight: 600;
  color: #343a40;
  margin: 0 0 15px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.empty-state {
  text-align: center;
  color: #6c757d;
  font-size: 13px;
  padding: 20px;
  background-color: #fff;
  border-radius: 8px;
  border: 1px dashed #ced4da;
}

.empty-state p {
  margin: 0 0 5px 0;
  font-weight: 500;
}

.snapshots-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.snapshot-item {
  justify-content: space-between;
  
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background-color: #ffffff;
  border-radius: 8px;
  border: 1px solid #dee2e6;
  cursor: grab;
  transition: all 0.2s ease-in-out;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.snapshot-item:hover {
  border-color: #007bff;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.snapshot-item:active {
  cursor: grabbing;
  background-color: #e9f5ff;
}

.snapshot-icon {
  font-size: 24px;
}

.snapshot-info {
  overflow: hidden;
}

.snapshot-goal {
  font-weight: 500;
  color: #212529;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 10px;
}

.snapshot-id {
  font-size: 8px;
  color: #adb5bd;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.delete-button {
  background: none;
  border: none;
  color: #adb5bd;
  font-size: 16px;
  cursor: pointer;
  padding: 0 1px;
  line-height: 1;
  border-radius: 50%;
  width: 12px;
  height: 14px;
  flex-shrink: 0; /* 防止按钮被压缩 */
  transition: all 0.2s ease;
}

.delete-button:hover {
  color: white;
  background-color: #e74c3c; /* 红色背景 */
}
</style>
