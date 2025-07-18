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
  },
  isShow: {
    type: Boolean,
    default: true
  },
  showRateButton: {
    type: Boolean,
    default: false,
  }
});

// Add a new event for the run node mode
const emit = defineEmits(['toggle-add-node-mode', 'toggle-add-run-node-mode', 'update:newNodeColor', 'toggle-add-group-mode','rate-clicked']);

const colorPicker = ref(null);
function handleRateClick() {
  emit('rate-clicked');
}
function handleAddNodeClick() {
  emit('toggle-add-node-mode');
}

// Function to handle the new "Run Node" button click
function handleAddRunNodeClick() {
  emit('toggle-add-run-node-mode');
}

function onColorChange(event) { // 'update:newGroupColor'
  emit('update:newNodeColor', event.target.value);
}

function handleGroupClick() {
  emit('toggle-add-group-mode');
}

function openColorPicker() {
  colorPicker.value.click();
}

//function handleUnshow() {
 // emit('is-showing-runnode')
//}
</script>

<template>
  <div class="toolbar-container">
    <div class="tool-section">
      <button class="tool-button" :class="{ active: isAddingNode }"
        :style="{ backgroundColor: isAddingNode ? newNodeColor : '', borderColor: isAddingNode ? newNodeColor : '' }"
        @click="handleAddNodeClick" title="Click to add a new customizable node.">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        </svg>
        <span>New Node</span>
      </button>

      <!-- New Button: Run Node -->
      <button v-if="isShow" class="tool-button" :class="{ active: isAddingRunNode }"
        @click="handleAddRunNodeClick" title="Click to add a new executable AI Node">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
        <span>AI Node</span>
      </button>

      <button class="tool-button" :class="{ active: isAddGroup }"
        :style="{ backgroundColor: isAddGroup ? newNodeColor : '', borderColor: isAddGroup ? newNodeColor : '' }"
        @click="handleGroupClick" title="Click to add a new group base.">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="6" ry="6"></rect>
        </svg>
        <span>New Group</span>
      </button>

      <button class="tool-button color-picker-btn" @click="openColorPicker" title="Select new node color">
        <div class="color-swatch" :style="{ backgroundColor: newNodeColor }"></div>

        <input type="color" ref="colorPicker" :value="newNodeColor" @input="onColorChange" class="hidden-color-input" />
      </button>
    </div>
    <div class="tool-section">
    <button 
        v-if="showRateButton" 
        class="tool-button-rate" 
        @click="handleRateClick" 
        title="Rate"
      >
        <span>Rate LLM responses in this Chain</span>
      </button>
  </div>
  </div>
</template>

<style scoped>
.toolbar-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 20px;
  gap: 20px;
  height: 55px;
  border-radius: 18px;
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

.tool-button, 
.tool-button-rate{
  display: flex;
  align-items: center;
  gap: 8px;
 
  padding: 4px 8px;
  border: 1px solid #ced4da;
  background-color: #fff;
  border-radius: 18px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: Arial;
  font-size: 13px;
  color: #343a40;
}

.toolbar-container .tool-section .tool-button-rate {
  display: flex;
  align-items: center;
  gap: 8px;
  height : 30px;
  padding: 4px 8px;
  border: 1px solid #ced4da;
  background-color: #fff;
  border-radius: 18px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: Arial;
  font-size: 13px;
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
