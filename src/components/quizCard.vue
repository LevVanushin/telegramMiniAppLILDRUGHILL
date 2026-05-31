<template>
  <div class="card-container">
    <!-- Метка "ВЫБОР ОТВЕТА" -->
    <div class="status-badge">
      <div class="status-dot"></div>
      <span class="status-text">ВЫБОР ОТВЕТА</span>
    </div>

    <!-- Заголовок -->
    <h1 class="main-title">ЧТО ВДОХНОВИЛО НАЗВАНИЕ VIPERR</h1>

    <!-- Подзаголовок -->
    <p class="subtitle">выбери один вариант</p>

    <!-- Список вариантов -->
    <div class="options-list">
      <button 
        v-for="(option, index) in options" 
        :key="index"
        class="option-button"
        @click="selectOption(option)"
      >
        {{ option }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

// Данные для кнопок
const options = ref([
  'машина',
  'клуб the viper room',
  'старый ник 9mice',
  'название тура'
]);

// Логика выбора (можно расширить)
const selectOption = (text) => {
  console.log('Выбран вариант:', text);
  // Здесь можно добавить логику подсветки или перехода
};
</script>

<style scoped>
/* Основной контейнер */
.card-container {
  background-color: #234082; /* Основной синий фон */
  padding: 24px;
  border-radius: 20px;
  max-width: 400px;
  width: 100%;
  margin: 0 auto;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  box-sizing: border-box;
  color: #ffffff;
}

/* Бейдж статуса */
.status-badge {
  display: inline-flex;
  align-items: center;
  background-color: #2f4da1; /* Более светлый синий для бейджа */
  padding: 6px 12px 6px 6px;
  border-radius: 30px;
  margin-bottom: 20px;
}

.status-dot {
  width: 8px;
  height: 8px;
  background-color: #ffffff; /* Белая точка вместо розовой */
  border-radius: 50%;
  margin-right: 8px;
  
  /* Анимация мигания */
  animation: blink 1.5s ease-in-out infinite;
}

@keyframes blink {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.2;
  }
}

.status-text {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.5px;
  color: #ffffff;
}

/* Заголовок */
.main-title {
  font-size: 24px;
  font-weight: 800;
  line-height: 1.2;
  margin: 0 0 8px 0;
  text-transform: uppercase;
  color: #ffffff;
}

/* Подзаголовок */
.subtitle {
  font-size: 14px;
  color: #cbd5e1; /* Светло-серый/голубоватый для контраста с белым */
  margin: 0 0 24px 0;
  font-weight: 500;
}

/* Список кнопок */
.options-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Сами кнопки */
.option-button {
  background-color: #2f4da1; /* Светло-синий для кнопок (чтобы выделялись) */
  border: none;
  border-radius: 16px;
  padding: 16px 20px;
  text-align: left;
  font-size: 15px;
  font-weight: 700;
  color: #ffffff;
  cursor: pointer;
  transition: background-color 0.2s ease, transform 0.1s ease;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

/* Эффекты при наведении и клике */
.option-button:hover {
  background-color: #3b5bb5; /* Еще светлее при наведении */
}

.option-button:active {
  transform: scale(0.98);
  background-color: #1e3466; /* Темнее при клике */
}

/* Адаптив для маленьких экранов */
@media (max-width: 420px) {
  .main-title {
    font-size: 20px;
  }
  .option-button {
    font-size: 14px;
    padding: 14px 16px;
  }
}
</style>