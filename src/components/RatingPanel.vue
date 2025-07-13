<script setup>
import { ref } from 'vue';

const props = defineProps({
  panelData: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(['close', 'submit-rating']);

// --- 改动 1: 从单一评分值变为一个包含多个评分对象的数组 ---
// 现在 ratings 是一个响应式数组，每个对象代表一个评分维度
const ratings = ref([
  { id: 'clarity', label: '清晰度', value: 5 },
  { id: 'relevance', label: '相关性', value: 5 },
  { id: 'creativity', label: '创新性', value: 5 },
  { id: 'depth', label: '深度', value: 5 },
]);

// --- 改动 2: 更新 submit 函数以发送所有评分 ---
function submit() {
  // 将数组转换为更方便后端处理的对象格式，例如 { clarity: 5, relevance: 5, ... }
  const formattedRatings = ratings.value.reduce((acc, rating) => {
    acc[rating.id] = rating.value;
    return acc;
  }, {});

  console.log(`Submitting ratings for ${props.panelData.id}:`, formattedRatings);
  
  // 发送包含所有评分数据的 payload
  emit('submit-rating', { 
    panelId: props.panelData.id, 
    ratings: formattedRatings 
  });
}

function closePanel() {
  emit('close', props.panelData.id);
}
</script>

<template>
  <div 
    class="rating-panel" 
    :style="{ top: `${panelData.y}px`, left: `${panelData.x}px` }"
  >
    <button @click="closePanel" class="close-btn">×</button>
    <h4>Rate the Result</h4>
    
    <div class="ratings-container">
      <div v-for="item in ratings" :key="item.id" class="rating-item">
        <label :for="item.id">{{ item.label }}</label>
        <div class="slider-wrapper">
          <input 
            type="range" 
            :id="item.id" 
            v-model.number="item.value" 
            min="0" 
            max="5" 
            step="1"
          />
          <span class="rating-value">{{ item.value }}</span>
        </div>
      </div>
    </div>
    
    <div class="rating-actions">
      <button @click="submit">Submit</button>
    </div>
  </div>
</template>

<style scoped>
.rating-panel {
  position: fixed;
  z-index: 999;
  background: #ffffff;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  padding: 15px 20px;
  box-shadow: 0 8px 25px rgba(0,0,0,0.15);
  width: 280px;
  font-family: sans-serif;
}

.rating-panel h4 {
  margin-top: 0;
  margin-bottom: 20px;
  text-align: center;
  font-size: 16px;
  color: #333;
}

.close-btn {
  position: absolute;
  top: 8px;
  right: 10px;
  background: none;
  border: none;
  font-size: 22px;
  cursor: pointer;
  color: #aaa;
  transition: color 0.2s;
}
.close-btn:hover {
  color: #333;
}

/* --- 新增样式: 评分项容器 --- */
.ratings-container {
  display: flex;
  flex-direction: column;
  gap: 15px; /* 每个评分条之间的间距 */
  margin-bottom: 20px;
}

.rating-item {
  display: flex;
  flex-direction: column;
}

.rating-item label {
  margin-bottom: 5px;
  font-size: 13px;
  color: #555;
}

.slider-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
}

.rating-value {
  font-weight: bold;
  font-size: 14px;
  color: #27ae60;
  min-width: 20px;
  text-align: center;
}

.rating-actions {
  display: flex;
  justify-content: center; /* 按钮居中 */
}

.rating-actions button {
    width: 100%;
    padding: 10px;
    border: none;
    border-radius: 6px;
    background-color: #007bff;
    color: white;
    font-size: 14px;
    font-weight: bold;
    cursor: pointer;
    transition: background-color 0.2s;
}

.rating-actions button:hover {
    background-color: #0056b3;
}

/* --- 新增样式: 自定义滑块外观 --- */
input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 8px;
  background: #e9ecef;
  border-radius: 5px;
  outline: none;
  opacity: 0.9;
  transition: opacity .2s;
}

input[type="range"]:hover {
  opacity: 1;
}

/* 滑块 (Chrome, Safari, Opera, Edge) */
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  background: #007bff;
  cursor: pointer;
  border-radius: 50%;
  border: 2px solid white;
  box-shadow: 0 0 5px rgba(0,0,0,0.2);
}

/* 滑块 (Firefox) */
input[type="range"]::-moz-range-thumb {
  width: 15px;
  height: 15px;
  background: #007bff;
  cursor: pointer;
  border-radius: 50%;
  border: 2px solid white;
}
</style>