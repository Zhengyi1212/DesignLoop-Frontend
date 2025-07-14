<script setup>
import { ref, computed } from 'vue';
import { NodeToolbar } from '@vue-flow/node-toolbar';

const props = defineProps({
  id: {
    type: String,
    required: true,
  },
  data: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(['close', 'submit']);

// 评分的响应式状态保持不变
const ratings = ref({
  novelty: 3, 
  relevance: 3, // 相关性
  clarity: 3,   // 清晰度
  value: 3,
  suprise: 3,
});

/**
 * 计算填充条的宽度百分比
 * @param {number} score - 当前分数
 */
const getFilledWidth = (score) => {
  // 我们有10个点，9个间隔。宽度从0%到100%。
  return computed(() => ((score - 1) / 4) * 100 + '%');
};

/**
 * 计算滑块（Thumb）的位置百分比
 * @param {number} score - 当前分数
 */
const getThumbPosition = (score) => {
  return computed(() => `calc(${((score - 1) / 4) * 100}%)`);
};

/**
 * 当用户点击圆点时，设置评分
 * @param {string} category - 评分类别 (e.g., 'accuracy')
 * @param {number} score - 分数 (1-10)
 */
function setRating(category, score) {
  ratings.value[category] = score;
}

/**
 * 当用户点击评分条时，根据点击位置更新分数
 * @param {string} category - 评分类别
 * @param {MouseEvent} event - 点击事件
 */
function updateRatingFromClick(category, event) {
  const bar = event.currentTarget;
  const rect = bar.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const barWidth = rect.width;

  // 确保百分比在 0 和 1 之间
  const percentage = Math.max(0, Math.min(1, clickX / barWidth));
  
  // 将百分比映射到 1-10 的分数
  const score = Math.round(percentage * 4) + 1;
  
  setRating(category, score);
}


// 提交和关闭的逻辑保持不变
function handleSubmit() {
  emit('submit', {
    nodeId: props.id,
    ratings: { ...ratings.value },
    context: props.data.context,
  });
}

function handleClose() {
  emit('close', props.id);
}
</script>

<template>
  <div class="rating-node-wrapper">
    

    <div class="node-header">
      <span class="header-icon">📝</span>
      <span class="header-title">Feedback</span>
    </div>

    <div class="node-content">
      <!-- Accuracy Rating -->
      <div class="rating-item">
        <label>Novelty: <span class="rating-value">{{ ratings.novelty }}</span></label>
        <div class="rating-bar-container" @click="updateRatingFromClick('novelty', $event)">
          <div class="rating-bar-track"></div>
          <div class="rating-bar-ticks">
            <span v-for="n in 5" :key="n" class="tick"></span>
          </div>
          <div class="rating-bar-filled" :style="{ width: getFilledWidth(ratings.novelty).value }"></div>
          <div class="rating-thumb" :style="{ left: getThumbPosition(ratings.novelty).value }"></div>
        </div>
      </div>

      <!-- Relevance Rating -->
      <div class="rating-item">
        <label>Relevance: <span class="rating-value">{{ ratings.relevance }}</span></label>
        <div class="rating-bar-container" @click="updateRatingFromClick('relevance', $event)">
          <div class="rating-bar-track"></div>
          <div class="rating-bar-ticks">
            <span v-for="n in 5" :key="n" class="tick"></span>
          </div>
          <div class="rating-bar-filled" :style="{ width: getFilledWidth(ratings.relevance).value }"></div>
          <div class="rating-thumb" :style="{ left: getThumbPosition(ratings.relevance).value }"></div>
        </div>
      </div>

      <!-- Clarity Rating -->
      <div class="rating-item">
        <label>Clarity: <span class="rating-value">{{ ratings.clarity }}</span></label>
        <div class="rating-bar-container" @click="updateRatingFromClick('clarity', $event)">
          <div class="rating-bar-track"></div>
          <div class="rating-bar-ticks">
            <span v-for="n in 5" :key="n" class="tick"></span>
          </div>
          <div class="rating-bar-filled" :style="{ width: getFilledWidth(ratings.clarity).value }"></div>
          <div class="rating-thumb" :style="{ left: getThumbPosition(ratings.clarity).value }"></div>
        </div>
      </div>
      <div class="rating-item">
        <label>Value <span class="rating-value">{{ ratings.value }}</span></label>
        <div class="rating-bar-container" @click="updateRatingFromClick('value', $event)">
          <div class="rating-bar-track"></div>
          <div class="rating-bar-ticks">
            <span v-for="n in 5" :key="n" class="tick"></span>
          </div>
          <div class="rating-bar-filled" :style="{ width: getFilledWidth(ratings.value).value }"></div>
          <div class="rating-thumb" :style="{ left: getThumbPosition(ratings.value).value }"></div>
        </div>
      </div>
      <div class="rating-item">
        <label>Suprise: <span class="rating-value">{{ ratings.suprise }}</span></label>
        <div class="rating-bar-container" @click="updateRatingFromClick('suprise', $event)">
          <div class="rating-bar-track"></div>
          <div class="rating-bar-ticks">
            <span v-for="n in 5" :key="n" class="tick"></span>
          </div>
          <div class="rating-bar-filled" :style="{ width: getFilledWidth(ratings.suprise).value }"></div>
          <div class="rating-thumb" :style="{ left: getThumbPosition(ratings.suprise).value }"></div>
        </div>
      </div>
    </div>

    <div class="node-footer">
      <button @click="handleSubmit" class="submit-button">Submit</button>
    </div>
  </div>
</template>

<style scoped>
.rating-node-wrapper {
  width: 260px;
  background-color: #ffffff;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
  font-family: 'JetBrains Mono', sans-serif;
  display: flex;
  flex-direction: column;
  transition: all 0.2s ease-in-out;
  border-left: 5px solid #3498db;
}

.node-header {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background-color: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
  border-top-left-radius: 8px;
  border-top-right-radius: 8px;
}

.header-icon {
  font-size: 16px;
  margin-right: 8px;
}

.header-title {
  font-weight: 600;
  color: #343a40;
}

.close-button {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: rgba(0, 0, 0, 0.6);
  color: white;
  border: none;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  box-shadow: 0 2px 5px rgba(0,0,0,0.2);
}

.close-button:hover {
  background-color: #e74c3c;
  transform: scale(1.1);
}

.node-content {
  padding: 15px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.rating-item {
  display: flex;
  flex-direction: column;
}

.rating-item label {
  font-size: 13px;
  color: #495057;
  margin-bottom: 12px;
}

.rating-value {
  font-weight: bold;
  color: #3498db;
  background-color: #ecf0f1;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
}

/* --- 评分条容器 --- */
.rating-bar-container {
  position: relative;
  width: 100%;
  height: 20px; /* 增加容器高度以方便点击 */
  display: flex;
  align-items: center;
  cursor: pointer; /* 提示用户这里可以点击 */
}

/* --- 评分条轨道 (背景) --- */
.rating-bar-track {
  position: absolute;
  width: 100%;
  height: 6px; /* 加粗轨道条 */
  background-color: #e9ecef;
  border-radius: 3px;
  z-index: 1;
}

/* --- NEW: 刻度线容器 --- */
.rating-bar-ticks {
  position: absolute;
  width: 100%;
  height: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 2; /* 在轨道之上 */
  pointer-events: none; /* 确保点击事件能穿透到容器 */
}

/* --- NEW: 单个刻度线样式 --- */
.tick {
  width: 2px;
  height: 10px; /* 让刻度线比轨道高一点 */
  background-color: #d1d8e0;
  border-radius: 1px;
}


/* --- 评分条填充部分 (前景) --- */
.rating-bar-filled {
  position: absolute;
  height: 6px; /* 加粗填充条 */
  background-color: #3498db;
  border-radius: 3px;
  transition: width 0.3s ease;
  z-index: 3; /* 在刻度线之上 */
}

/* --- 单个可移动滑块 --- */
.rating-thumb {
  position: absolute;
  width: 18px;
  height: 18px;
  background-color: white;
  border: 3px solid #3498db;
  border-radius: 50%;
  top: 50%;
  transform: translateY(-50%) translateX(-50%); /* 使圆心对准位置 */
  z-index: 4; /* 在最顶层 */
  box-shadow: 0 2px 4px rgba(0,0,0,0.15);
  transition: left 0.3s ease;
}

.rating-bar-container:hover .rating-thumb {
  transform: translateY(-50%) translateX(-50%) scale(1.1);
}


.node-footer {
  padding: 10px 15px;
  border-top: 1px solid #e9ecef;
  display: flex;
  justify-content: flex-end;
}

.submit-button {
  background-color: #2ecc71;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.submit-button:hover {
  background-color: #27ae60;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}
</style>
