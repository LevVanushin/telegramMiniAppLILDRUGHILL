<template>
  <div class="container">
    <div v-if="debugMode" class="debug-panel">
      <p v-for="(log, i) in logs" :key="i">{{ log }}</p>
    </div>
    <img src="./assets/mike.png" alt="" class="mike">
    
    <div v-if="loading" class="loading">Загрузка вопросов...</div>
    
    <!-- Показываем текущий вопрос -->
    <quizCard 
      v-else-if="data.length > 0 && !quizFinished"
      class="quiz" 
      :title="currentQuestion?.question_text"
      :options="currentOptions"
      :correctOption="currentQuestion?.correct_option" 
      @select="handleAnswer"
    />
    
    <!-- Результаты -->
    <div v-else-if="quizFinished" class="results">
      <h2>Викторина завершена!</h2>
      <p>Правильных ответов: {{ score }} из {{ data.length }}</p>
      <button @click="restartQuiz">Пройти заново</button>
    </div>
    
    <div v-else-if="errorMessage" class="error">{{ errorMessage }}</div>
    <div v-else-if="!loading" class="error">Нет данных</div>
  </div>
  <div class="shadow"></div>
</template>

<script setup>
import { supabase } from "./lib/supabase.js";
import quizCard from "./components/quizCard.vue";
import { onMounted, ref, computed } from "vue";

const data = ref([]);
const loading = ref(true);
const errorMessage = ref('');

// Состояние викторины
const currentIndex = ref(0);
const userAnswers = ref([]);
const quizFinished = ref(false);

const debugMode = ref(true);
const logs = ref([]);

function addLog(msg) {
  const time = new Date().toLocaleTimeString();
  logs.value.unshift(`${time}: ${msg}`);
  console.log(msg);
}

// Текущий вопрос
const currentQuestion = computed(() => data.value[currentIndex.value]);

// Опции для текущего вопроса
const currentOptions = computed(() => {
  if (!currentQuestion.value) return [];
  return [
    currentQuestion.value.option_a,
    currentQuestion.value.option_b,
    currentQuestion.value.option_c,
    currentQuestion.value.option_d
  ];
});

// Количество правильных ответов
const score = computed(() => {
  return userAnswers.value.filter(a => a.isCorrect).length;
});

function createSession() {
  const session = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    expiresAt: Date.now() + (24 * 60 * 60 * 1000)
  };
  localStorage.setItem('session', JSON.stringify(session));
  addLog('Сессия создана');
  return session;
}

function getSession() {
  const raw = localStorage.getItem('session');
  if (!raw) return createSession();
  
  const session = JSON.parse(raw);
  if (Date.now() > session.expiresAt) {
    localStorage.removeItem('session');
    return createSession();
  }
  return session;
}

// Сохранение прогресса викторины
function saveQuizProgress() {
  const progress = {
    currentIndex: currentIndex.value,
    answers: userAnswers.value,
    savedAt: Date.now()
  };
  localStorage.setItem('quiz_progress', JSON.stringify(progress));
  addLog(`Прогресс сохранён: вопрос ${currentIndex.value + 1}`);
}

// Загрузка прогресса викторины
function loadQuizProgress() {
  const saved = localStorage.getItem('quiz_progress');
  if (saved) {
    const progress = JSON.parse(saved);
    currentIndex.value = progress.currentIndex;
    userAnswers.value = progress.answers;
    addLog(`Прогресс загружен: вопрос ${currentIndex.value + 1}, ${userAnswers.value.length} ответов`);
    
    // Проверяем, не закончена ли викторина
    if (currentIndex.value >= data.value.length && data.value.length > 0) {
      quizFinished.value = true;
    }
    return true;
  }
  return false;
}

// Обработчик выбора ответа
function handleAnswer(selectedText) {
  if (!currentQuestion.value) return;
  
  // Определяем букву ответа
  const optionMap = {
    [currentQuestion.value.option_a]: 'A',
    [currentQuestion.value.option_b]: 'B',
    [currentQuestion.value.option_c]: 'C',
    [currentQuestion.value.option_d]: 'D'
  };
  
  const selectedLetter = optionMap[selectedText];
  const isCorrect = (selectedLetter === currentQuestion.value.correct_option);
  
  // Сохраняем ответ
  userAnswers.value.push({
    questionId: currentQuestion.value.id,
    questionText: currentQuestion.value.question_text,
    selectedAnswer: selectedLetter,
    isCorrect: isCorrect,
    timestamp: Date.now()
  });
  
  addLog(`Вопрос ${currentIndex.value + 1}: ответ ${selectedLetter} (${isCorrect ? '✅' : '❌'})`);
  
  // Переход к следующему вопросу
  if (currentIndex.value + 1 < data.value.length) {
    currentIndex.value++;
    saveQuizProgress();
  } else {
    // Викторина завершена
    quizFinished.value = true;
    localStorage.removeItem('quiz_progress'); // Очищаем прогресс
    addLog(`Викторина завершена! Результат: ${score.value}/${data.value.length}`);
  }
}

// Перезапуск викторины
function restartQuiz() {
  currentIndex.value = 0;
  userAnswers.value = [];
  quizFinished.value = false;
  localStorage.removeItem('quiz_progress');
  addLog('Викторина перезапущена');
}

async function getData() {
  try {
    loading.value = true;
    
    const response = await supabase
      .from('questions')
      .select('*')
      .order('id');
    
    addLog(`Supabase ответ: ${response.error ? 'ошибка' : 'успех'}`);
    
    if (response.error) {
      addLog(`Ошибка: ${response.error.message}`);
      errorMessage.value = response.error.message;
    }
  
    data.value = response.data || [];
    addLog(`Загружено вопросов: ${data.value.length}`);
    
    // После загрузки данных пробуем восстановить прогресс
    if (data.value.length > 0) {
      loadQuizProgress();
    }
    
  } catch (error) {
    console.error('Ошибка:', error);
    errorMessage.value = error.message;
    addLog(`Ошибка: ${error.message}`);
  } finally {
    loading.value = false;
  }
} 

onMounted(async () => {
  addLog('App mounted');
  const session = getSession();
  addLog(`Session ID: ${session.id}`);
  await getData();
});
</script>

<style>

.debug-panel {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0,0,0,0.8);
  color: lime;
  font-size: 10px;
  padding: 5px;
  max-height: 100px;
  overflow-y: auto;
  z-index: 9999;
  font-family: monospace;
}
.container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 50px;
  padding: 15px;
}

.loading, .error, .debug {
  text-align: center;
  padding: 20px;
  font-size: 18px;
}

.error {
  color: red;
}

.debug {
  color: orange;
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 5px;
}

.results {
  background: #1e2a5e;
  border-radius: 32px;
  padding: 40px;
  text-align: center;
  color: white;
  max-width: 500px;
}

.results button {
  margin-top: 20px;
  background: #5d81e1;
  border: none;
  border-radius: 16px;
  padding: 12px 24px;
  color: white;
  cursor: pointer;
}

.mike {
  position: relative;
  top: 20px;
  width: 250px;
  height: 250px;

  transition-property: width, height, top;
  transition-duration: .2s;
  transition-timing-function: ease-in-out;

}

.mike:hover{
  width: 300px;
  height: 300px;
  top: 0;
}

.shadow {
  position: absolute;
  width: 100%;
  height: 100%;
  top: -20px;
  opacity: 80%;
  background: linear-gradient(to bottom, #234082 10%, rgb(255, 255, 255) 90%);
  filter: blur(10px);
  z-index: -5;
}

.quiz {
  align-self: center;
}

@media(max-width: 330px) {
  .container{
    padding: 30px;
  }
}
</style>