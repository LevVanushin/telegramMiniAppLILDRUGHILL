<template>
  <div class="card-container">
    <!-- Новая курсивная надпись -->
    <div class="army-signature">
      <p class="army">lildrughill army</p>
      <p class="mikeCaption">MIKE</p>
    </div>

    <!-- Заголовок (передается через props) -->
    <h1 class="main-title">{{ title }}</h1>

    <!-- Подзаголовок -->
    <p class="subtitle">выбери один вариант</p>

    <!-- Список вариантов (передается через props) -->
    <div class="options-list">
      <button 
        v-for="(option, index) in options" 
        :key="index"
        class="option-button"
        @click="selectOption(option)"
      >
        <span class="option-index">{{ String.fromCharCode(65 + index) }}</span>
        {{ option }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';

// Определяем входящие параметры
const props = defineProps({
  title: {
    type: String,
    required: true,
    default: 'Вопрос'
  },
  options: {
    type: String,
    required: true,
    default: () => ['ответ', 'ответ', 'ответ', 'ответ']
  }
});

// Определяем события
const emit = defineEmits(['select']);

// Логика выбора
const selectOption = (text) => {
  console.log('Выбран вариант:', text);
  emit('select', text);
};
</script>

<style scoped>
/* Основной контейнер – тёмный градиент + лёгкая текстура */
.card-container {
  background: linear-gradient(145deg, #2d376e 0%, #0c122f 100%);
  padding: 28px 24px 32px;
  border-radius: 32px;
  max-width: 500px;
  width: 100%;
  margin: 0 auto;
  font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
  box-sizing: border-box;
  color: #ffffff;
  box-shadow: 0 20px 35px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  transition: transform 0.2s ease;
}

.card-container:hover {
  transform: translateY(-3px);
}

/* Новая курсивная подпись */
.army-signature {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  margin-bottom: 16px;
  padding-bottom: 10px;
  border-bottom: 1px dashed rgba(93, 129, 225, 0.3);
}

.mikeCaption {
  text-align: right;
  font-weight: bold;
  letter-spacing: 2px;
}

.army{
font-family: 'Playfair Display', 'Cormorant Garamond', 'Georgia', serif;
  font-style: italic;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.5px;
}
.army, .mikeCaption {
  position: relative;
  
  color: #b9cbff;
  opacity: 0.8;
  width: 100%;
}

/* Заголовок – крупный, с лёгким градиентом текста */
.main-title {
  font-size: 28px;
  font-weight: 800;
  line-height: 1.25;
  margin: 0 0 12px 0;
  text-transform: uppercase;
  background: linear-gradient(135deg, #ffffff 0%, #b9c8ff 100%);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  letter-spacing: -0.3px;
}

/* Подзаголовок */
.subtitle {
  position: relative;
  font-size: 13px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #8d9bee;
  margin: 0 0 28px 0;
  border-left: 3px solid #5d81e1;
  padding-left: 12px;
}

/* Список кнопок */
.options-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* Кнопки – глянцевые, с градиентом и тенью */
.option-button {
  position: relative;

  background: linear-gradient(105deg, #1e2a5e 0%, #172147 100%);
  border: none;
  border-radius: 20px;
  padding: 16px 20px;
  text-align: left;
  font-size: 16px;
  font-weight: 600;
  color: #f0f3ff;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.2, 0.9, 0.4, 1.1);
  box-shadow: 0 6px 0 #182043;
  display: flex;
  align-items: center;
  gap: 14px;
  overflow: hidden;
}

/* Буква-индекс (A, B, C, D) */
.option-index {
  background: rgba(255, 255, 255, 0.12);
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  font-weight: 800;
  font-size: 18px;
  color: #b9cbff;
  transition: 0.2s;
}

/* Эффект наведения */
.option-button:hover {
  background: linear-gradient(105deg, #2a3b7c 0%, #1f2a5a 100%);
  transform: translateY(-2px);
  box-shadow: 0 8px 0 #0b0f24;
}

.option-button:hover .option-index {
  background: rgba(255, 255, 255, 0.25);
  color: white;
  transform: scale(1.02);
}

/* Эффект нажатия */
.option-button:active {
  transform: translateY(4px);
  box-shadow: 0 2px 0 #0b0f24;
  transition: 0.05s;
}

/* Эффект скользящей волны */
.option-button::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
  transition: 0.4s;
}

.option-button:hover::after {
  left: 100%;
}

/* Адаптив */
@media (max-width: 520px) {
  .card-container {
    padding: 20px 18px 24px;
    border-radius: 24px;
  }
  .main-title {
    font-size: 22px;
  }
  .option-button {
    font-size: 14px;
    padding: 12px 16px;
  }
  .option-index {
    width: 28px;
    height: 28px;
    font-size: 16px;
  }
  .army-signature {
    font-size: 12px;
    margin-bottom: 12px;
  }
}
</style>