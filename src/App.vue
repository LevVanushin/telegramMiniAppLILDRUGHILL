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
const SYNC_TIMEOUT = 30000; // 30 секунд таймаут на запрос к Supabase

// ====== Реактивные данные ======
const data = ref([]);
const loading = ref(true);
const errorMessage = ref('');
const subscriptionVerified = ref(false);

// Состояние викторины
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

// ====== Работа с сессией (localStorage + Supabase) ======

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

function createSession() {
  const session = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    expiresAt: Date.now() + (30 * 60000),
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

function getLocalSession() {
  const raw = localStorage.getItem('quiz_session');
  if (!raw) return null;
  const session = JSON.parse(raw);
  if (Date.now() > session.expiresAt) {
    localStorage.removeItem('quiz_session');
    return null;
  }
  return session;
}

async function syncSessionToSupabase() {
  const session = getLocalSession();
  if (!session) return;

  const telegramId = getTelegramId();
  if (!telegramId) {
    console.warn('Нет telegram_id, синхронизация с Supabase невозможна');
    return;
  }

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
      expires_at: new Date(session.expiresAt).toISOString(),
      quiz_progress: session.quizProgress,
      total_score: score.value,
      subscription_verified: localStorage.getItem('subscription_verified') === 'true',
      subscription_verified_at: localStorage.getItem('subscription_verified_at') 
        ? new Date(parseInt(localStorage.getItem('subscription_verified_at'))).toISOString() 
        : null,
      last_active: new Date().toISOString()
    }, { onConflict: 'telegram_id' });
    console.log('✅ Сессия синхронизирована с Supabase');
  } catch (err) {
    console.warn('Ошибка синхронизации с Supabase:', err);
  }
}

async function loadSessionFromSupabase() {
  const telegramId = getTelegramId();
  if (!telegramId) {
    // Нет Telegram ID, используем только localStorage
    const localSession = getLocalSession();
    if (localSession) {
      loadProgressFromSession(localSession);
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

  try {
    const response = await Promise.race([fetchPromise, timeoutPromise]);
    clearTimeout(timeoutId);

    if (response.error) throw response.error;

    // Если данные есть в Supabase
    if (response.data && response.data.quiz_progress && Object.keys(response.data.quiz_progress).length > 0) {
      const supabaseSession = response.data;
      const session = {
        id: supabaseSession.session_id,
        createdAt: new Date(supabaseSession.created_at).getTime(),
        expiresAt: new Date(supabaseSession.expires_at).getTime(),
        quizProgress: supabaseSession.quiz_progress
      };
      localStorage.setItem('quiz_session', JSON.stringify(session));
      if (supabaseSession.subscription_verified) {
        localStorage.setItem('subscription_verified', 'true');
        localStorage.setItem('subscription_user_id', telegramId);
        localStorage.setItem('subscription_verified_at', new Date(supabaseSession.subscription_verified_at).getTime());
      }
      loadProgressFromSession(session);
      console.log('✅ Данные загружены из Supabase');
      return;
    }
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('Не удалось загрузить сессию из Supabase (таймаут или ошибка):', err);
  }

  // Если данных в Supabase нет (response.data === null) или ошибка — пробуем localStorage
  const localSession = getLocalSession();
  if (localSession) {
    loadProgressFromSession(localSession);
    console.log('⚠️ Данные загружены из localStorage (fallback)');
  } else {
    createSession();
    console.log('🆕 Новая сессия создана');
  }
}

function loadProgressFromSession(session) {
  const progress = session.quizProgress;
  if (progress.isCompleted) {
    quizCompleted.value = true;
    completedScore.value = progress.finalScore || 0;
  } else {
    currentIndex.value = progress.currentIndex || 0;
    userAnswers.value = progress.answers || [];
    if (currentIndex.value >= data.value.length && data.value.length > 0) {
      quizFinished.value = true;
    }
  }
}

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
  localStorage.setItem('quiz_session', JSON.stringify(session));
  syncSessionToSupabase().catch(e => console.warn(e));
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
    } else {
      // если нет вопросов, всё равно завершаем загрузку
      loading.value = false;
    }
  } catch (err) {
    console.error(err);
    errorMessage.value = err.message;
    loading.value = false;
  } finally {
    // убираем лишний finally, чтобы не сбросить loading раньше времени
    if (loading.value) loading.value = false;
  }
}

function onSubscriptionVerified() {
  subscriptionVerified.value = true;
  const telegramId = getTelegramId();
  if (telegramId) {
    localStorage.setItem('subscription_verified', 'true');
    localStorage.setItem('subscription_verified_at', Date.now());
    syncSessionToSupabase();
  }
}

function clearStorage() {
  localStorage.removeItem('quiz_session');
  localStorage.removeItem('telegram_id');
  localStorage.removeItem('subscription_verified');
  localStorage.removeItem('subscription_verified_at');
  alert('✅ Все данные очищены! Страница перезагрузится.');
  window.location.reload();
}

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