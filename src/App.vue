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
        <h2>Экзамен уже пройден!</h2>
        <p class="score">Баллы: {{ completedScore * 5 }} из {{ data.length * 5 }}</p>
        <p class="thankyou-message">Благодарим за прохождение. Желаем удачи всем на реальных экзаменах!</p>
        <button v-if="(completedScore * 5) >= 60" class="button_sert" @click="openDiplomaModal">Получить диплом</button>
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
        <h2>Экзамен завершен!</h2>
        <p class="score">Баллы: {{ score * 5 }} из {{ data.length * 5 }}</p>
        <p class="thankyou-message">Благодарим за прохождение. Желаем удачи всем на реальных экзаменах!</p>
        <button v-if="(score * 5) >= 60" class="button_sert" @click="openDiplomaModal">Получить диплом</button>
        <p class="armyCaption">lildrughill army - off fan page</p>
      </div>
      
      <div v-else-if="errorMessage" class="error">{{ errorMessage }}</div>
      <div v-else-if="!loading" class="error">Нет данных</div>
    </template>

    <!-- Модальное окно для диплома -->
    <div v-if="showDiplomaModal" class="modal-overlay" @click.self="closeDiplomaModal">
      <div class="results modal-content">
        <h2>Получение диплома</h2>
        <p class="score">Ваш результат: {{ (score * 5) || (completedScore * 5) }} баллов</p>
        <div class="input-group">
          <label>Введите ваш ник в Telegram:</label>
          <input 
            type="text" 
            v-model="nickname" 
            placeholder="например: @lildrughill"
            class="nick-input"
          />
        </div>
        <div class="modal-buttons">
          <button class="button_sert" @click="submitDiploma" :disabled="!nickname">Отправить</button>
          <button class="button_sert cancel" @click="closeDiplomaModal">Отмена</button>
        </div>
        <p class="armyCaption">lildrughill army - off fan page</p>
      </div>
    </div>
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

// Модальное окно диплома
const showDiplomaModal = ref(false);
const nickname = ref('');

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
  if (id) return parseInt(id);
  return null;
}

// ====== Парсинг timestamptz из Supabase ======
function parseSupabaseDate(dateStr) {
  if (!dateStr) return NaN;
  return new Date(dateStr.replace(' ', 'T')).getTime();
}

// ====== Очистка истёкшей сессии ======
async function clearExpiredSession(telegramId = null) {
  currentIndex.value = 0;
  userAnswers.value = [];
  quizFinished.value = false;
  quizCompleted.value = false;
  completedScore.value = 0;
  console.log('🔄 Реактивное состояние сброшено');
  if (telegramId) {
    try {
      await supabase.from('user_sessions').delete().eq('telegram_id', telegramId);
      console.log('🗑️ Истёкшая сессия удалена из Supabase');
    } catch (err) {
      console.warn('Ошибка удаления сессии из Supabase:', err);
    }
  }
}

// ====== Работа с сессией ======
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
  console.log(`📊 Загружено: ответов ${userAnswers.value.length}, правильных ${score.value}, завершена: ${quizCompleted.value}`);
}

async function saveQuizProgress() {
  const telegramId = getTelegramId();
  if (!telegramId) return;
  try {
    const { data: existing } = await supabase
      .from('user_sessions')
      .select('session_id, created_at')
      .eq('telegram_id', telegramId)
      .maybeSingle();
    const sessionId = existing?.session_id || crypto.randomUUID();
    const createdAt = existing?.created_at || new Date().toISOString();
    const quizProgress = {
      currentIndex: currentIndex.value,
      answers: userAnswers.value,
      isCompleted: quizFinished.value || quizCompleted.value,
      finalScore: score.value,
      savedAt: Date.now()
    };
    await supabase.from('user_sessions').upsert({
      telegram_id: telegramId,
      session_id: sessionId,
      created_at: createdAt,
      expires_at: new Date(Date.now() + SESSION_TTL).toISOString(),
      quiz_progress: quizProgress,
      total_score: score.value,
      last_active: new Date().toISOString()
    }, { onConflict: 'telegram_id' });
    console.log('✅ Прогресс сохранён в Supabase');
  } catch (err) {
    console.warn('Ошибка сохранения прогресса в Supabase:', err);
  }
}

async function loadSessionFromSupabase() {
  const telegramId = getTelegramId();
  if (!telegramId) return;
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
    if (!response.error && response.data) supabaseData = response.data;
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('Supabase timeout/error, сессия не загружена');
  }
  if (supabaseData) {
    const expiresAt = parseSupabaseDate(supabaseData.expires_at);
    if (isNaN(expiresAt) || Date.now() > expiresAt) {
      await clearExpiredSession(telegramId);
      return;
    }
    const session = {
      id: supabaseData.session_id,
      createdAt: parseSupabaseDate(supabaseData.created_at),
      expiresAt: expiresAt,
      quizProgress: supabaseData.quiz_progress
    };
    loadProgressFromSession(session);
    console.log('✅ Данные загружены из Supabase');
    return;
  }
  console.log('ℹ️ Сессия в Supabase не найдена, стартуем заново');
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
    const response = await supabase.from('questions').select('*').order('id');
    if (response.error) throw new Error(response.error.message);
    data.value = response.data || [];
    if (data.value.length > 0) await loadSessionFromSupabase();
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

// Модальное окно диплома
function openDiplomaModal() {
  nickname.value = '';
  showDiplomaModal.value = true;
}
function closeDiplomaModal() {
  showDiplomaModal.value = false;
}
function submitDiploma() {
  if (!nickname.value.trim()) return;
  const finalScore = (score.value * 5) || (completedScore.value * 5);
  const total = data.value.length * 5;
  const result = { nickname: nickname.value.trim(), score: finalScore, total: total, date: new Date().toISOString() };
  console.log('Отправка диплома:', result);
  // Отправка в Telegram (если приложение запущено в Telegram)
  if (window.Telegram?.WebApp) {
    window.Telegram.WebApp.sendData(JSON.stringify({ event: 'diploma_request', data: result }));
  }
  // Дополнительно можно сохранить в localStorage или отправить в Supabase
  localStorage.setItem('diploma_request', JSON.stringify(result));
  alert('Заявка отправлена! Ожидайте диплом в ближайшее время.');
  closeDiplomaModal();
}

// ====== Lifecycle ======
onMounted(async () => {
  await getData();
});
</script>

<style>
/* ... существующие стили ... */
/* Дополнительные стили для модального окна */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}
.modal-content {
  max-width: 400px;
  width: 90%;
  padding: 30px 20px 40px;
  position: relative;
  margin: 0;
  animation: fadeScaleUp 0.3s ease-out;
}
.input-group {
  margin: 20px 0;
  text-align: left;
}
.input-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  color: #b9cbff;
}
.nick-input {
  width: 100%;
  padding: 12px;
  border-radius: 16px;
  border: none;
  background: #1e2a5e;
  color: white;
  font-size: 16px;
  box-sizing: border-box;
}
.modal-buttons {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-top: 10px;
}
.button_sert.cancel {
  background: linear-gradient(105deg, #4a2e2e 0%, #3a1f1f 100%);
  box-shadow: 0 4px 0 #2a1515;
}
.button_sert:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>