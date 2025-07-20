<script setup>
import { ref } from 'vue';

// The 'newNodeColor' prop has been renamed to 'activeColor' for clarity.
// It now represents the color for both new nodes and selected nodes.
defineProps({
  isAddingNode: {
    type: Boolean,
    default: false,
  },
  isAddingRunNode: {
    type: Boolean,
    default: false,
  },
  activeColor: {
    type: String,
    default: '#34495e',
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

// The emit event is also updated to 'update:activeColor'.
const emit = defineEmits(['toggle-add-node-mode', 'toggle-add-run-node-mode', 'update:activeColor', 'toggle-add-group-mode','rate-clicked']);

const colorPicker = ref(null);

function handleRateClick() {
  emit('rate-clicked');
}

function handleAddNodeClick() {
  emit('toggle-add-node-mode');
}

function handleAddRunNodeClick() {
  emit('toggle-add-run-node-mode');
}

function onColorChange(event) {
  emit('update:activeColor', event.target.value);
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
      <button class="tool-button color-picker-btn" @click="openColorPicker" title="Select color for new or selected nodes">
        <div class="color-swatch" :style="{ backgroundColor: activeColor }"></div>
        <input type="color" ref="colorPicker" :value="activeColor" @input="onColorChange" class="hidden-color-input" />
      </button>
      <button class="tool-button" :class="{ active: isAddingNode }"
        :style="{ backgroundColor: isAddingNode ? activeColor : '', borderColor: isAddingNode ? activeColor : '' }"
        @click="handleAddNodeClick" title="Click to add a node">
        <img src="@/assets/custom.svg" alt="Click to add a node" height="23px" width="23px">
        
      </button>

      <button class="tool-button section-a" :class="{ active: isAddGroup }"
        :style="{ backgroundColor: isAddGroup ? activeColor : '', borderColor: isAddGroup ? activeColor : '' }"
        @click="handleGroupClick" title="Click to add a new section">
        <img src="@/assets/gp.svg" alt="Click to add a section" height="23px" width="23px">
        
      </button>

      <div class="divider"></div>

      <button v-if="isShow" class="tool-button" :class="{ active: isAddingRunNode }"
        @click="handleAddRunNodeClick" title="Click to add a AI Node">
        <img src="@/assets/ai.svg" lt="Click to add a AI node" height="23px" width="23px">
       
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
  /* Changed from inline-flex and added width */

  display: flex;
  width: 92%;
  align-items: center;
  justify-content: space-between;
  padding: 20px 10px;
  gap: 16px;
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
  gap: 8px;
}

/* New style for the divider */
.divider {
  width: 1px;
  height: 24px;
  background-color: #dee2e6;
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
  height: 32px;
}

.toolbar-container .tool-section .tool-button-rate {
  display: flex;
  align-items: center;
  gap: 8px;
  height : 30px;
  padding: 4px 4px;
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
.section-a {display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border: transparent;
  background-color: transparent;
  border-radius: 18px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: Arial;
  font-size: 13px;
  color: #343a40;
  height: 32px;
}
</style>