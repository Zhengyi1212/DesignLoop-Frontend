<script setup>
import { computed , watch} from 'vue';

const props = defineProps({
  show: { type: Boolean, required: true },
  snapshot: { type: Object, default: null },
});

const emit = defineEmits(['close']);


watch(() => props.show, (isVisible) => {
  if (isVisible) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
});

const nodeCount = computed(() => props.snapshot?.data.subGraph.nodes.length || 0);
const edgeCount = computed(() => props.snapshot?.data.subGraph.edges.length || 0);
</script>

<template>
  <transition name="modal-fade">
    <div v-if="show" class="modal-overlay" @click.self="emit('close')">
      <div class="modal-window">
        <div class="modal-header">
          <h3>Snapshot Details (ID: {{ snapshot.id }})</h3>
          <button class="close-btn" @click="emit('close')">×</button>
        </div>
        <div class="modal-content" v-if="snapshot">
          <div class="detail-item">
            <label>From Node:</label>
            <p>{{ snapshot.parentNodeTitle }} (ID: {{ snapshot.parentNodeId }})</p>
          </div>
          <div class="detail-item">
            <label>Goal:</label>
            <p>{{ snapshot.goal }}</p>
          </div>
          <div class="detail-item">
            <label>Instruction:</label>
            <textarea readonly>{{ snapshot.data.instruction }}</textarea>
          </div>
          <div class="detail-item">
            <label>Chain Content:</label>
            <div class="chain-list">
              <span v-for="(item, index) in snapshot.data.chain" :key="index" class="chain-item">
                {{ item }}
              </span>
            </div>
          </div>
          <div class="detail-item stats">
            <label>Subgraph Stats:</label>
            <p><strong>{{ nodeCount }}</strong> Nodes, <strong>{{ edgeCount }}</strong> Edges</p>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: center;
}
.modal-window {
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}
.modal-header {
  padding: 15px 25px;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.modal-header h3 {
  margin: 0;
  font-size: 18px;
  color: #333;
}
.close-btn {
  background: none;
  border: none;
  font-size: 28px;
  font-weight: bold;
  cursor: pointer;
  color: #aaa;
  transition: color 0.2s;
}
.close-btn:hover {
  color: #333;
}
.modal-content {
  padding: 25px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.detail-item {
  display: flex;
  flex-direction: column;
}
.detail-item label {
  font-weight: 600;
  font-size: 14px;
  color: #555;
  margin-bottom: 8px;
}
.detail-item p {
  margin: 0;
  font-size: 14px;
  color: #333;
  background-color: #f9f9f9;
  padding: 10px;
  border-radius: 6px;
  border: 1px solid #eee;
}
.detail-item textarea {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  padding: 10px;
  border-radius: 6px;
  border: 1px solid #eee;
  background-color: #f9f9f9;
  resize: vertical;
  min-height: 80px;
}
.chain-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.chain-item {
  background-color: #e7f3ff;
  color: #0056b3;
  padding: 5px 10px;
  border-radius: 15px;
  font-size: 12px;
  font-weight: 500;
}
.modal-fade-enter-active, .modal-fade-leave-active {
  transition: opacity 0.3s ease;
}
.modal-fade-enter-from, .modal-fade-leave-to {
  opacity: 0;
}
</style>