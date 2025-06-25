<script setup>
// 定义 props 和 emits
// Define props and emits
defineProps({
  panels: {
    type: Array,
    required: true,
    default: () => [],
  },
});

const emit = defineEmits(['update-panel-content', 'fetch-objective']);

/**
 * 当用户在文本框中输入时，触发此函数
 * This function is triggered when the user types in the textarea
 * @param {Event} event - 输入事件对象
 * @param {number} index - 正在被修改的面板的索引
 */
function handleInput(event, index) {
  emit('update-panel-content', {
    index: index,
    content: event.target.value,
  });
}

/**
 * 当加载按钮被点击时，向父组件发送事件
 * Emits an event to the parent component when the load button is clicked
 */
function onFetchObjective() {
    emit('fetch-objective');
}
</script>

<template>
  <aside class="instruction-panel">
    <div v-for="(panel, index) in panels" :key="index" class="panel-box">
      <div class="panel-header">
        <h3>{{ panel.title }}</h3>
        
        <button v-if="panel.title === 'Pipeline'" @click="onFetchObjective" class="fetch-btn" title="">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
        </button>
      </div>
      <textarea
        class="panel-content-input"
        :value="panel.content"
        @input="handleInput($event, index)"
        :placeholder="`${panel.title}...`"
      ></textarea>
    </div>
  </aside>
</template>

<style scoped>
.instruction-panel {
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  width: 250px;
  background-color: #f8f9fa;
  border-right: 1px solid #dee2e6;
  padding: 10px; /* 减小内边距 */
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 10px; /* 减小间距 */
  z-index: 10;
  font-family: 'JetBrains Mono', 'Helvetica Neue', Arial, sans-serif;
}

.panel-box {
  background-color: #ffffff;
  border: 1px solid #ced4da;
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  flex: 1; /* 让每个面板平分高度 */
  min-height: 0; /* 配合 flex: 1，防止内容溢出 */
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #eee;
  padding-bottom: 8px;
  margin-bottom: 10px;
}

.panel-header h3 {
  margin: 0;
  font-size: 16px;
  color: #495057;
}

.fetch-btn {
  background-color: #e7f3ff;
  color: #007bff;
  border: 1px solid #007bff;
  border-radius: 5px;
  padding: 3px 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  transition: all 0.2s ease;
}

.fetch-btn:hover {
  background-color: #d0e7ff;
}

.panel-content-input {
  width: 100%;
  border: none;
  background-color: transparent;
  padding: 0;
  margin: 0;
  font-family: 'JetBrains Mono', 'Helvetica Neue', Arial, sans-serif;
  font-size: 14px;
  color: #343a40;
  resize: none;
  box-shadow: none;
  outline: none;
  flex-grow: 1; /* 让textarea填满剩余空间 */
  line-height: 1.5;
}

.panel-content-input::placeholder {
  color: #adb5bd;
}
</style>
