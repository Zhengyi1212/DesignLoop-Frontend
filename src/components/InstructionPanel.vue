<script setup>
// Props and emits remain unchanged as they correctly handle the component's logic.
defineProps({
  panels: {
    type: Array,
    required: true,
    default: () => [],
  },
  isGenerating: {
    type: Boolean,
    default: false,
  },
  isFetchingPipeline: {
    type: Boolean,
    default: false,
  },
});

// --- 核心修改: 增加 'userIdFocus' 事件 ---
const emit = defineEmits(['update-panel-content', 'fetch-pipeline', 'generate', 'userIdFocus','mode-changed']);

function handleModeChange(event) {
  const selectedValue = event.target.value;
  console.log('Mode changed to:', selectedValue); // For debugging
  emit('mode-changed', selectedValue);
}


function handleInput(event, index) {
  emit('update-panel-content', {
    index: index,
    content: event.target.value,
  });
}

function onFetchPipeline() {
    emit('fetch-pipeline', { event });
}

function onGenerate() {
  emit('generate', { event });
}
</script>

<template>
  <aside class="instruction-panel">
    <!-- 
      The layout is now driven by a gap between panel sections,
      with the title appearing in that gap.
    -->
    <div class="panel-container">
      <div 
        v-for="(panel, index) in panels" 
        :key="index" 
        class="panel-box"
        :class="{ 'user-panel': panel.title === 'User' }"
        
      ><div v-if="panel.title === 'Design Background'" class="text-help2">
        <div class="drop-mode-selector">
          <p class="task-style">Task</p>
        <select id="options" name="mode-selector" @change="handleModeChange">
          <option value="option--">Unselected</option>
          <option value="option1">TaskA: Baseline</option>
          <option value="option2">TaskB: DesignerlyLoop</option>
        </select>
        </div>

        <div class="text-help">  Instruction:</div>
        Describe how you want to build your initial instruction
      </div>
        <div class="panel-header">

          <h3>{{ panel.title }}</h3>
        
          <button 
            v-if="panel.title === 'Pipeline'" 
            @click="onFetchPipeline($event)" 
            class="fetch-btn" 
            :disabled="isFetchingPipeline"
            title="Fetch pipeline suggestion"
          >
            <div v-if="isFetchingPipeline" class="spinner"></div>
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
          </button>
        </div>
        
        <!-- --- 核心修改: 监听 user_id 输入框的 focus 事件 --- -->
        <textarea
          v-if="panel.title === 'User'"
          class="panel-content-input"
          :value="panel.content"
          @input="handleInput($event, index)"
          :placeholder="`Enter ${panel.title}...`"
          @keydown.ctrl.z.stop
          @keydown.meta.z.stop
          @focus="emit('userIdFocus')"
        ></textarea>
        <textarea
          v-else
          class="panel-content-input"
          :value="panel.content"
          @input="handleInput($event, index)"
          :placeholder="`Enter ${panel.title}...`"
          @keydown.ctrl.z.stop
          @keydown.meta.z.stop
        ></textarea>
      </div>
    </div>
    
    <div class="panel-footer">
      <button class="generate-btn" @click="onGenerate($event)" :disabled="isGenerating">
        <div v-if="isGenerating" class="spinner"></div>
        <span v-else>Generate</span>
      </button>
    </div>
  </aside>
</template>

<style scoped>
/* ================================================================== */
/* STYLE ADJUSTMENT: Reverting to a clean background and tuning layout. */
/* ================================================================== */

.instruction-panel {
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  width: 200px;
  /* STYLE CHANGE: Reverted to the clean, solid background color. */
  background-color: #f8f9fa;
  border-right: 1px solid #dee2e6;
  padding: 15px 15px; /* Adjusted horizontal padding */
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  z-index: 10;
  font-family: Arial;
}

.panel-container {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  min-height: 0;
  /* Removed scrollbar styling as it's not needed with the new layout */
}

.panel-box {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

/* STYLE CHANGE: Reduced the gap between sections for a tighter look. */
.panel-box + .panel-box {
  margin-top: 15px;
}

/* The User panel will not grow, maintaining its smaller size. */
.panel-box.user-panel {
  flex-grow: 0;
  flex-shrink: 0;
  height: 14px;
  margin-bottom: 34px;
}
/* The other panels will grow to fill the available space. */
.panel-box:not(.user-panel) {
  flex-grow: 1;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 0 0 8px 0; /* Removed horizontal margin for alignment */
}
.panel-header h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 500;
  color: #4a5568;
}

.panel-content-input {
  width: 100%;
  border: 1px solid #e2e8f0;
  background-color: #ffffff;
  border-radius: 8px;
  padding: 12px;
  font-family: Arial;
  font-size: 11px;
  color: #2d3748;
  resize: none;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  flex-grow: 1; /* Input grows to fill its parent .panel-box */
  box-sizing: border-box;
}
.panel-content-input:focus {
  border-color: #a0aec0;
  box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.2);
}

/* STYLE CHANGE: Set a fixed height for the User panel's textarea. */
.panel-box.user-panel .panel-content-input {
    height: 30px;
    flex-grow: 0; /* Ensure it doesn't grow */
} 

.text-help {
  
  margin-top: 4px; /* 添加此行来移除顶部边距 */
  margin-bottom: 4px; 
  
  color: #4a5568;
  
  font-size: 13px;
  font-weight: 500;
  color: #4a5568;
}
.text-help2 {
  font-size: 9.4px;
  margin-top: 0; /* 添加此行来移除顶部边距 */
  margin-bottom: 14px; 
  font-weight: 50;
  color: #828282;
}
.fetch-btn {
  background-color: #e2e8f0;
  color: #58e6e6;
  border: 1px solid #cbd5e0;
  border-radius: 5px;
  padding: 3px 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  font-size: 12px;
  transition: all 0.2s ease;
}
.fetch-btn:hover:not(:disabled) {
  background-color: #0dafee;
  border-color: #a0aec0;
}

.panel-footer {
  padding-top: 20px;
  margin-top: auto; /* Pushes the footer to the bottom */
  flex-shrink: 0;
}

.generate-btn {
  width: 100%;
  padding: 10px 15px;
  font-family: Arial;
  font-size: 16px;
  font-weight: bold;
  color: white;
  background-color: #5661F6;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 44px;
}
.generate-btn:hover:not(:disabled) {
  background-color: #1625f3;
}
.generate-btn:disabled,
.fetch-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
.drop-mode-selector {
   width: 100%;
  
   border-radius: 8px;
  margin-bottom: 13px;
}
.task-style {
  margin: 0;
  font-size: 13px;
  font-weight: 500;
  color: #4a5568;
  margin-bottom: 2px;
}
.drop-mode-selector select {
   width: 100%; 
  font-family: Arial;
  font-size: 11.5px;
  border: 1px solid #e2e8f0;
  background-color: #ffffff;
  color: #2d3748;
  border-radius: 4px;
  height: 24px;
}
.spinner {
  border: 3px solid rgba(0,0,0,0.1);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  border-top-color: #2d3748;
}
.fetch-btn .spinner {
  width: 14px;
  height: 14px;
}
.generate-btn .spinner {
  border-top-color: #ffffff;
  width: 20px;
  height: 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
