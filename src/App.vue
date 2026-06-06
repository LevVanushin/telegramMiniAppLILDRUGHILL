<template>
  <div class="container">
    <img src="./assets/mike.png" alt="" class="mike">
   
    <SubscriptionCheck 
      v-if="!subscriptionVerified && data.length > 0"
      class="subscription-check"
      @verified="onSubscriptionVerified"
    />

    <template v-else>
      <div v-if="loading" class="loading">Загрузка вопросов...</div>
      
      <div v-else-if="quizCompleted" class="results">
        <h2>Викторина уже пройдена!</h2>
        <p>Баллы: {{ completedScore * 5 }} из {{ data.length * 5 }}</p>
      </div>
      
      <quizCard 
        v-else-if="data.length > 0 && !quizFinished"
        class="quiz" 
        :key="currentIndex"
        :title="currentQuestion?.question_text"
        :options="currentOptions"
        :correctOption="currentQuestion?.correct_option" 
        @select="handleAnswer"
      />
      
      <div v-else-if="quizFinished" class="results">
        <h2>Викторина завершена!</h2>
        <p>Ваш балл: {{ score * 5 }} из {{ data.length * 5 }}</p>
      </div>
      
      <div v-else-if="errorMessage" class="error">{{ errorMessage }}</div>
      <div v-else-if="!loading" class="error">Нет данных</div>
    </template>
  </div>
  <div class="shadow"></div>
</template>

<script setup>
import { supabase } from "./lib/supabase.js";
import quizCard from "./components/quizCard.vue";
import SubscriptionCheck from "./components/SubscriptionCheck.vue";
import { onMounted, ref, computed } from "vue";

// ====== Конфигурация ======
const SYNC_TIMEOUT = 30000;
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;

// ====== Реактивные данные ======
const data = ref([]);
const loading = ref(true);
const errorMessage = ref('');
const subscriptionVerified = ref(false);

const currentIndex = ref(0);
const userAnswers = ref([]);
const quizFinished = ref(false);
const quizCompleted = ref(false);
const completedScore = ref(0);

// ====== Computed ======
const currentQuestion = computed(() => data.value[currentIndex.value]);
const currentOptions = computed(() => {
  if (!currentQuestion.value) return [];
  return [
    currentQuestion.value.option_a,
    currentQuestion.value.option_b,
    currentQuestion.value.option_c,
    currentQuestion.value.option_d
  ];
});
const score = computed(() => userAnswers.value.filter(a => a.isCorrect).length);

// ====== Вспомогательные функции ======
function getTelegramId() {
  const urlParams = new URLSearchParams(window.location.search);
  let id = urlParams.get('user_id');
  if (id) {
    localStorage.setItem('telegram_id', id);
    return parseInt(id);
  }
  const saved = localStorage.getItem('telegram_id');
  return saved ? parseInt(saved) : null;
}

// Создание новой сессии
function createSession() {
  const session = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL,
    quizProgress: {
      currentIndex: 0,
      answers: [],
      isCompleted: false,
      finalScore: 0,
      savedAt: Date.now()
    }
  };
  localStorage.setItem('quiz_session', JSON.stringify(session));
  return session;
}

// Получение сессии из localStorage без удаления
function getLocalSession() {
  const raw = localStorage.getItem('quiz_session');
  if (!raw) return null;
  const session = JSON.parse(raw);
  // не удаляем по истечению, а просто помечаем
  return session;
}

// Применение данных сессии к состоянию викторины (восстанавливаем и счёт!)
function loadProgressFromSession(session) {
  const progress = session.quizProgress;
  
  // Восстанавливаем ответы
  userAnswers.value = progress.answers || [];
  currentIndex.value = progress.currentIndex || 0;
  
  // ВАЖНО: восстанавливаем счёт завершённой викторины
  if (progress.isCompleted) {
    quizCompleted.value = true;
    completedScore.value = progress.finalScore || 0;
    quizFinished.value = false;
  } else {
    quizCompleted.value = false;
    completedScore.value = 0;
    if (currentIndex.value >= data.value.length && data.value.length > 0) {
      quizFinished.value = true;
    } else {
      quizFinished.value = false;
    }
  }
  // Принудительно пересчитываем баллы из ответов (на случай, если finalScore устарел)
  if (!quizCompleted.value && userAnswers.value.length > 0) {
    const correctCount = userAnswers.value.filter(a => a.isCorrect).length;
    if (correctCount !== progress.finalScore) {
      progress.finalScore = correctCount;
      session.quizProgress = progress;
      localStorage.setItem('quiz_session', JSON.stringify(session));
    }
  }
  console.log(`📊 Загружено: ответов ${userAnswers.value.length}, правильных ${score.value}, завершена: ${quizCompleted.value}`);
}

// Сохранение прогресса в localStorage и фоновая синхронизация
function saveQuizProgress() {
  const session = getLocalSession();
  if (!session) return;
  session.quizProgress = {
    currentIndex: currentIndex.value,
    answers: userAnswers.value,
    isCompleted: quizFinished.value || quizCompleted.value,
    finalScore: score.value,
    savedAt: Date.now()
  };
  session.expiresAt = Date.now() + SESSION_TTL;
  localStorage.setItem('quiz_session', JSON.stringify(session));
  // Фоновая синхронизация с Supabase
  syncSessionToSupabase().catch(e => console.warn(e));
}

// Отправка в Supabase
async function syncSessionToSupabase() {
  const session = getLocalSession();
  if (!session) return;
  const telegramId = getTelegramId();
  if (!telegramId) return;

  session.quizProgress = {
    currentIndex: currentIndex.value,
    answers: userAnswers.value,
    isCompleted: quizFinished.value || quizCompleted.value,
    finalScore: score.value,
    savedAt: Date.now()
  };
  localStorage.setItem('quiz_session', JSON.stringify(session));

  try {
    await supabase.from('user_sessions').upsert({
      telegram_id: telegramId,
      session_id: session.id,
      created_at: new Date(session.createdAt).toISOString(),
      expires_at: new Date(Date.now() + SESSION_TTL).toISOString(),
      quiz_progress: session.quizProgress,
      total_score: score.value,
      subscription_verified: localStorage.getItem('subscription_verified') === 'true',
      subscription_verified_at: localStorage.getItem('subscription_verified_at') 
        ? new Date(parseInt(localStorage.getItem('subscription_verified_at'))).toISOString() 
        : null,
      last_active: new Date().toISOString()
    }, { onConflict: 'telegram_id' });
  } catch (err) {
    console.warn('Ошибка синхронизации с Supabase:', err);
  }
}

// Загрузка сессии: сначала Supabase с таймаутом, потом localStorage
async function loadSessionFromSupabase() {
  const telegramId = getTelegramId();
  if (!telegramId) {
    const local = getLocalSession();
    if (local) {
      loadProgressFromSession(local);
    } else {
      createSession();
    }
    return;
  }

  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Timeout')), SYNC_TIMEOUT);
  });

  const fetchPromise = supabase
    .from('user_sessions')
    .select('*')
    .eq('telegram_id', telegramId)
    .maybeSingle();

  let supabaseData = null;
  try {
    const response = await Promise.race([fetchPromise, timeoutPromise]);
    clearTimeout(timeoutId);
    if (!response.error && response.data) {
      supabaseData = response.data;
    }
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('Supabase timeout/error, используем localStorage');
  }

  if (supabaseData && supabaseData.quiz_progress) {
    const session = {
      id: supabaseData.session_id,
      createdAt: new Date(supabaseData.created_at).getTime(),
      expiresAt: new Date(supabaseData.expires_at).getTime(),
      quizProgress: supabaseData.quiz_progress
    };
    localStorage.setItem('quiz_session', JSON.stringify(session));
    if (supabaseData.subscription_verified) {
      localStorage.setItem('subscription_verified', 'true');
      localStorage.setItem('subscription_user_id', telegramId);
      localStorage.setItem('subscription_verified_at', new Date(supabaseData.subscription_verified_at).getTime());
    }
    loadProgressFromSession(session);
    console.log('✅ Данные загружены из Supabase');
    return;
  }

  // Fallback на localStorage
  const localSession = getLocalSession();
  if (localSession) {
    loadProgressFromSession(localSession);
    console.log('⚠️ Использованы данные из localStorage (fallback)');
    // При первой возможности синхронизируем
    syncSessionToSupabase().catch(e => console.warn(e));
  } else {
    createSession();
  }
}

// ====== Логика викторины ======
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

// ====== Загрузка вопросов ======
async function getData() {
  try {
    loading.value = true;
    const response = await supabase
      .from('questions')
      .select('*')
      .order('id');
    
    if (response.error) throw new Error(response.error.message);
    data.value = response.data || [];
    
    if (data.value.length > 0) {
      await loadSessionFromSupabase();
    }
  } catch (err) {
    console.error(err);
    errorMessage.value = err.message;
  } finally {
    loading.value = false;
  }
}

// ====== Обработчики ======
function onSubscriptionVerified() {
  subscriptionVerified.value = true;
  const telegramId = getTelegramId();
  if (telegramId) {
    localStorage.setItem('subscription_verified', 'true');
    localStorage.setItem('subscription_verified_at', Date.now());
    syncSessionToSupabase();
  }
}

// ====== Lifecycle ======
onMounted(async () => {
  await getData();
});
</script>

<style>
/* ... твои стили без изменений ... */
@keyframes fadeSlideDown {
  from { opacity: 0; transform: translateY(-30px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes fadeScaleUp {
  from { opacity: 0; transform: translateY(40px) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes questionSlideIn {
  from { opacity: 0; transform: translateY(40px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 30px;
  padding: 15px 30px 20px 30px;
}
.loading, .error {
  text-align: center;
  padding: 20px;
  font-size: 18px;
}
.error { color: red; }
.results {
  background: #1e2a5e;
  border-radius: 32px;
  padding: 40px;
  text-align: center;
  color: white;
  max-width: 500px;
  animation: fadeScaleUp 0.5s ease-out 0.2s both;
}
.mike {
  position: relative;
  top: 10px;
  width: 250px;
  height: 250px;
  transition: .2s ease-in-out;
  animation: fadeSlideDown 0.5s ease-out both;
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
  animation: questionSlideIn 0.35s ease-out both;
}
.subscription-check {
  animation: fadeScaleUp 0.5s ease-out 0.2s both;
}
@media(max-width: 330px) {
  .container { padding: 5px; }
}
</style>