<script setup>
import { ref } from 'vue';

// Add a new prop to track if we are in "add run node" mode
defineProps({
  isAddingNode: {
    type: Boolean,
    default: false,
  },
  isAddingRunNode: {
    type: Boolean,
    default: false,
  },
  isFrozen: {
    type: Boolean,
    default: false,
  },
  newNodeColor: {
    type: String,
    default: '#34495e',
  },
  newGroupColor: {
    type: String,
    default: '#FFC0CB',
  },
  isAddGroup: {
    type: Boolean,
    default: false,
  }
});

// Add a new event for the run node mode
const emit = defineEmits(['toggle-freeze', 'toggle-add-node-mode', 'toggle-add-run-node-mode', 'update:newNodeColor','toggle-add-group-mode']);

const colorPicker = ref(null);

function handleAddNodeClick() {
  emit('toggle-add-node-mode');
}

// Function to handle the new "Run Node" button click
function handleAddRunNodeClick() {
  emit('toggle-add-run-node-mode');
}

function handleFreezeClick() {
  emit('toggle-freeze');
}

function onColorChange(event) { // or add few colored circle options
  emit('update:newNodeColor', 'update:newGroupColor', event.target.value);
}

function handleGroupClick() {
  emit('toggle-add-group-mode');
}

function openColorPicker() {
  colorPicker.value.click();
}
</script>

<template>
  <div class="toolbar-container">
    <div class="tool-section">
      <button
        class="tool-button"
        :class="{ active: isAddingNode }"
        :style="{ backgroundColor: isAddingNode ? newNodeColor : '', borderColor: isAddingNode ? newNodeColor : '' }"
        @click="handleAddNodeClick"
        title="Click to add a new customizable node."
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
        <span>New Node</span>
      </button>

      <!-- New Button: Run Node -->
      <button
        class="tool-button"
        :class="{ active: isAddingRunNode }"
        @click="handleAddRunNodeClick"
        title="Click to add a new executable Run Node"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        <span>Run Node</span>
      </button>

      <button
        class="tool-button"
        :class="{ active: isAddGroup }"
        :style="{ backgroundColor: isAddGroup ? newGroupColor : '', borderColor: isAddingGroup ? newGroupColor : '' }"
        @click="handleGroupClick"
        title="Click to add a new group base."
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="6" ry="6"></rect></svg>
        <span>New Group</span>
      </button>

      <button
        class="tool-button color-picker-btn"
        @click="openColorPicker"
        title="Select new node color"
      >
        <div class="color-swatch" :style="{ backgroundColor: newNodeColor }"></div>
        <span>Color</span>
        <input
          type="color"
          ref="colorPicker"
          :value="newNodeColor"
          @input="onColorChange"
          class="hidden-color-input"
        />
      </button>
    </div>

    <div class="tool-section">
      <button
        @click="handleFreezeClick"
        class="tool-button"
        :class="{ active: isFrozen }"
        title="Toggle node movement"
      >
        <svg v-if="isFrozen" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
        <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>
        <span>{{ isFrozen ? ' Unfreeze' : 'Freeze' }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.toolbar-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 25px;
  gap: 20px;
  height: 70px;
  background-color: #ffffff;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
  border-top: 1px solid #dee2e6;
  box-sizing: border-box;
}
.tool-section {
    display: flex;
    align-items: center;
    gap: 15px;
}
.tool-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 15px;
  border: 1px solid #ced4da;
  background-color: #fff;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  color: #343a40;
}
.tool-button:hover {
  background-color: #f8f9fa;
  border-color: #adb5bd;
}
.tool-button.active {
    background-color: #007bff;
    color: white;
    border-color: #007bff;
}
.tool-button.active svg {
    stroke: white;
}
/* Style for the active Run Node button */
.tool-button:nth-child(2).active {
    background-color: #f39c12;
    border-color: #f39c12;
}
.color-picker-btn {
  position: relative;
}
.color-swatch {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
}
.hidden-color-input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}
</style>
