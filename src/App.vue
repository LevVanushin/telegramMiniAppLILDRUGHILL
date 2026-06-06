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
        <p class="score">Баллы: {{ completedScore * 5 }} из {{ data.length * 5 }}</p>
        <p class="thankyou-message">Благодарим за прохождение. Желаем удачи всем на реальных экзаменах!</p>
        <p class="armyCaption">lildrughill army - off fan page</p>
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
        <p class="score">Баллы: {{ score * 5 }} из {{ data.length * 5 }}</p>
        <p class="thankyou-message">Благодарим за прохождение. Желаем удачи всем на реальных экзаменах!</p>
        <p class="armyCaption">lildrughill army - off fan page</p>
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
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 дней

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

// ====== Telegram ID из URL ======
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

// ====== Работа с сессией ======
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
  console.log('✨ Создана новая сессия');
  return session;
}

function getLocalSession() {
  const raw = localStorage.getItem('quiz_session');
  if (!raw) return null;
  return JSON.parse(raw);
}

function loadProgressFromSession(session) {
  const progress = session.quizProgress;
  
  userAnswers.value = progress.answers || [];
  currentIndex.value = progress.currentIndex || 0;
  
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
  
  // Синхронизация finalScore с реальными ответами
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
  
  syncSessionToSupabase().catch(e => console.warn(e));
}

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
    loadProgressFromSession(session);
    console.log('✅ Данные загружены из Supabase');
    return;
  }

  const localSession = getLocalSession();
  if (localSession) {
    loadProgressFromSession(localSession);
    console.log('⚠️ Использованы данные из localStorage (fallback)');
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
}

// ====== Lifecycle ======
onMounted(async () => {
  await getData();
});
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,100..900;1,100..900&display=swap');

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
  background: linear-gradient(to bottom, #3b4fa7 0%, #172147 100%);
  border-radius: 32px;
  padding: 40px;
  text-align: center;
  font-family: "Roboto", sans-serif; 
  font-weight: 700;
  color: white;
  max-width: 500px;
  animation: fadeScaleUp 0.5s ease-out 0.2s both;
  position: relative;
}

.results h2 {
  font-size: 30px;
  margin-bottom: 10px;
}

.score {
  font-size: 23px;
  font-weight: 600;
  margin-bottom: 20px;
}

.thankyou-message {
  font-family: 'Playfair Display', 'Cormorant Garamond', 'Georgia', serif;
  font-style: italic;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.5px;
  color: #b9cbff;
  opacity: 0.8;
  text-align: center;
  margin: 20px 0 10px;
  border-bottom: 1px dashed gray;
  padding-bottom: 15px;
  line-height: 1.4;
}

.armyCaption {
  position: absolute;
  bottom: 15px;
  left: 20px;
  font-family: 'Playfair Display', 'Cormorant Garamond', 'Georgia', serif;
  font-style: italic;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.5px;
  color: #b9cbff;
  opacity: 0.8;
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