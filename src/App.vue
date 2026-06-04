<template>
  <div class="container">
    <img src="./assets/mike.png" alt="" class="mike">
   
    
    <!-- Если проверка подписки не пройдена
    <SubscriptionCheck 
      v-if="!subscriptionVerified && !loading && data.length > 0"
      @verified="onSubscriptionVerified"
    /> -->

    
    
    
    <!-- Если подписка подтверждена, показываем викторину -->
    <!-- <template v-else> -->
      <div v-if="loading" class="loading">Загрузка вопросов...</div>
      
      <!-- Если викторина уже пройдена - показываем результат -->
      <div v-else-if="quizCompleted" class="results">
        <h2>Викторина уже пройдена!</h2>
        <p>Ваш результат: {{ completedScore }} из {{ data.length }}</p>
      </div>
      
      <!-- Показываем текущий вопрос -->
      <quizCard 
        v-else-if="data.length > 0 && !quizFinished"
        class="quiz" 
        :title="currentQuestion?.question_text"
        :options="currentOptions"
        :correctOption="currentQuestion?.correct_option" 
        @select="handleAnswer"
      />
      
      <!-- Результаты после прохождения -->
      <div v-else-if="quizFinished" class="results">
        <h2>Викторина завершена!</h2>
        <p>Ваш балл: {{ score * 5 }} из {{ data.length * 5 }}</p>
      </div>
      
      <div v-else-if="errorMessage" class="error">{{ errorMessage }}</div>
      <div v-else-if="!loading" class="error">Нет данных</div>
    <!-- </template> -->
  </div>
  <div class="shadow"></div>
</template>

<script setup>
import { supabase } from "./lib/supabase.js";
import quizCard from "./components/quizCard.vue";
import SubscriptionCheck from "./components/SubscriptionCheck.vue";
import { onMounted, ref, computed } from "vue";

const data = ref([]);
const loading = ref(true);
const errorMessage = ref('');
const subscriptionVerified = ref(false);

function clearStorage() {
  localStorage.clear();
  alert('✅ Все данные очищены! Страница перезагрузится.');
  window.location.reload();
}
// Состояние викторины
const currentIndex = ref(0);
const userAnswers = ref([]);
const quizFinished = ref(false);
const quizCompleted = ref(false);
const completedScore = ref(0);

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
    expiresAt: Date.now() + 60000
  };
  localStorage.setItem('session', JSON.stringify(session));
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
    isCompleted: quizFinished.value,
    completedAt: quizFinished.value ? Date.now() : null,
    finalScore: score.value,
    savedAt: Date.now()
  };
  localStorage.setItem('quiz_progress', JSON.stringify(progress));
}

// Загрузка прогресса викторины
function loadQuizProgress() {
  const saved = localStorage.getItem('quiz_progress');
  if (saved) {
    const progress = JSON.parse(saved);
    
    if (progress.isCompleted) {
      quizCompleted.value = true;
      completedScore.value = progress.finalScore || 0;
      return true;
    }
    
    currentIndex.value = progress.currentIndex;
    userAnswers.value = progress.answers;
    
    if (currentIndex.value >= data.value.length && data.value.length > 0) {
      quizFinished.value = true;
      saveQuizProgress();
    }
    return true;
  }
  return false;
}

// Обработчик выбора ответа
function handleAnswer(selectedText) {
  if (!currentQuestion.value) return;
  
  const optionMap = {
    [currentQuestion.value.option_a]: 'A',
    [currentQuestion.value.option_b]: 'B',
    [currentQuestion.value.option_c]: 'C',
    [currentQuestion.value.option_d]: 'D'
  };
  
  const selectedLetter = optionMap[selectedText];
  const isCorrect = (selectedLetter === currentQuestion.value.correct_option);
  
  userAnswers.value.push({
    questionId: currentQuestion.value.id,
    questionText: currentQuestion.value.question_text,
    selectedAnswer: selectedLetter,
    isCorrect: isCorrect,
    timestamp: Date.now()
  });
  
  if (currentIndex.value + 1 < data.value.length) {
    currentIndex.value++;
    saveQuizProgress();
  } else {
    quizFinished.value = true;
    saveQuizProgress();
  }
}

async function getData() {
  try {
    loading.value = true;
    
    const response = await supabase
      .from('questions')
      .select('*')
      .order('id');
    
    if (response.error) {
      errorMessage.value = response.error.message;
    }
  
    data.value = response.data || [];
    
    if (data.value.length > 0) {
      loadQuizProgress();
    }
    
  } catch (error) {
    console.error('Ошибка:', error);
    errorMessage.value = error.message;
  } finally {
    loading.value = false;
  }
}

function onSubscriptionVerified() {
  subscriptionVerified.value = true;
}

onMounted(async () => {
  getSession();
  await getData();
});
</script>

<style>
.container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 30px;
  padding: 15px 0px 15px 0px ;
}

.loading, .error {
  text-align: center;
  padding: 20px;
  font-size: 18px;
}

.error {
  color: red;
}

.results {
  background: #1e2a5e;
  border-radius: 32px;
  padding: 40px;
  text-align: center;
  color: white;
  max-width: 500px;
}

.mike {
  position: relative;
  top: 10px;
  width: 250px;
  height: 250px;
  transition-property: width, height, top;
  transition-duration: .2s;
  transition-timing-function: ease-in-out;
}

.mike:hover {
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

@media (max-width){

}
@media(max-width: 330px) {
  .container {
    padding: 5px;
  }
}
</style>