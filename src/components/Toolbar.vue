<script setup>
import { ref } from 'vue';

// Define props including the new color prop
const props = defineProps({
  isAddingNode: {
    type: Boolean,
    default: false,
  },
  isFrozen: {
    type: Boolean,
    default: false,
  },
  // New prop to receive the current color for the node
  newNodeColor: {
    type: String,
    default: '#34495e',
  }
});

// Define emits including the new event to update the color
const emit = defineEmits(['toggle-freeze', 'toggle-add-node-mode', 'update:newNodeColor']);

const colorPicker = ref(null);

function handleAddNodeClick() {
  emit('toggle-add-node-mode');
}

function handleFreezeClick() {
  emit('toggle-freeze');
}

// When the user selects a color, emit an event to the parent
function onColorChange(event) {
  emit('update:newNodeColor', event.target.value);
}

// A helper function to programmatically click the hidden color input
function openColorPicker() {
  colorPicker.value.click();
}
</script>

<template>
  <div class="toolbar-container">
    <div class="tool-section">
      <!-- "New Node" button now has a dynamic style bound to the selected color -->
      <button 
        class="tool-button" 
        :class="{ active: isAddingNode }"
        :style="{ backgroundColor: isAddingNode ? newNodeColor : '', borderColor: isAddingNode ? newNodeColor : '' }"
        @click="handleAddNodeClick"
        title="Click to enter Add Node mode, then click on the canvas to place."
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
        <span>New Node</span>
      </button>

      <!-- New Feature: Color Picker Button -->
      <button 
        class="tool-button color-picker-btn" 
        @click="openColorPicker" 
        title="Select new node color"
      >
        <div class="color-swatch" :style="{ backgroundColor: newNodeColor }"></div>
        <span>Color</span>
        <!-- The actual color input is hidden and is triggered programmatically -->
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
  justify-content: space-between; /* Adjusted for better spacing */
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
