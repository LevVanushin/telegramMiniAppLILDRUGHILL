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
        <p class="score">Баллы: {{ progress.finalScore * 5 }} из {{ data.length * 5 }}</p>
        <p class="thankyou-message">Благодарим за прохождение. Желаем удачи всем на реальных экзаменах!</p>
        <button v-if="(progress.finalScore * 5) >= 60" class="button_sert" @click="openDiplomaModal">Получить диплом</button>
        <div v-if="sertNick" class="results">
          <p>Введи ник:</p>
          <input type="input">
        </div>
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
        <div class="input-group">
          <label>Введите ваш ник в Telegram:</label>
          <input 
            type="text" 
            v-model="nickname" 
            placeholder="например: Михаил Струев"
            class="nick-input"
          />
        </div>
        <div class="modal-buttons">
          <button class="button_sert" @click="submitDiploma" :disabled="!nickname || isSending || remainingAttempts <= 0">
            {{ isSending ? 'Отправляем...' : `Отправить (осталось: ${remainingAttempts})` }}
          </button>
          <button class="button_sert cancel" @click="cancelDiploma">Отмена</button>
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
import html2canvas from "html2canvas";

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
const sertNick = ref(false);

function sert() {
  sertNick.value = true;
  return;
}

// Модальное окно диплома
const showDiplomaModal = ref(false);
const nickname = ref('');
const isSending = ref(false);
const remainingAttempts = ref(5); // Максимум 5 попыток
let cancelRequest = false; // Флаг отмены

// ====== Глобальная переменная — данные сессии из Supabase ======
const supabaseSessionData = ref(null);
window.supabaseSessionData = supabaseSessionData;

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
    return parseInt(id);
  }
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
  supabaseSessionData.value = null;
  console.log('🔄 Реактивное состояние сброшено');

  if (telegramId) {
    try {
      const { error } = await supabase
        .from('user_sessions')
        .delete()
        .eq('telegram_id', telegramId);
      if (error) throw error;
      console.log('🗑️ Истёкшая сессия удалена из Supabase');
    } catch (err) {
      console.warn('Ошибка удаления сессии из Supabase:', err);
    }
  }
}

// ====== Работа с сессией ======
function createSessionObject() {
  return {
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
}

let progress;

function loadProgressFromSession(session) {
  progress = session.quizProgress;

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
      quizCompleted.value = false;
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
    const { data: existing, error: fetchError } = await supabase
      .from('user_sessions')
      .select('session_id, created_at')
      .eq('telegram_id', telegramId)
      .maybeSingle();

    if (fetchError) throw fetchError;

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

  if (!telegramId) {
    console.warn('⚠️ Telegram ID не найден, сессия не загружена');
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
    if (!response.error && response.data) {
      supabaseSessionData.value = response.data;
    }
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('Supabase timeout/error, сессия не загружена');
  }

  if (supabaseSessionData.value) {
    const expiresAt = parseSupabaseDate(supabaseSessionData.value.expires_at);

    if (isNaN(expiresAt)) {
      console.warn('⚠️ Не удалось распарсить expires_at:', supabaseSessionData.value.expires_at);
      await clearExpiredSession(telegramId);
      return;
    }

    if (Date.now() > expiresAt) {
      console.warn('⏰ Сессия из Supabase истекла — сбрасываем всё и стартуем заново');
      await clearExpiredSession(telegramId);
      return;
    }

    const session = {
      id: supabaseSessionData.value.session_id,
      createdAt: parseSupabaseDate(supabaseSessionData.value.created_at),
      expiresAt: expiresAt,
      quizProgress: supabaseSessionData.value.quiz_progress
    };
    loadProgressFromSession(session);
    console.log('✅ Данные загружены из Supabase');
    return;
  }

  console.log('ℹ️ Сессия в Supabase не найдена, стартуем заново');
}

// ====== Логика викторины ======
function handleAnswer(selectedText) {
  if (!currentQuestion.value) {
    quizFinished.value = true;
    return;
  }

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
    quizCompleted.value = false;
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

// Модальное окно диплома
function openDiplomaModal() {
  nickname.value = '';
  showDiplomaModal.value = true;
  cancelRequest = false; // Сбрасываем флаг отмены при открытии
}

function closeDiplomaModal() {
  showDiplomaModal.value = false;
}

// Отмена отправки
function cancelDiploma() {
  cancelRequest = true;
  closeDiplomaModal();
}

// Функция отправки диплома через прямой вызов API бота
const BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN; // Твой токен

async function submitDiploma() {
  if (!nickname.value.trim()) return;
  if (isSending.value) return;
  if (remainingAttempts.value <= 0) {
    alert('Вы исчерпали лимит попыток (5).');
    return;
  }

  const finalScore =(progress?.finalScore * 5) ||  (score.value * 5);
  const total = data.value.length * 5;
  const userName = nickname.value.trim();
  const telegramId = getTelegramId();

  if (!telegramId) {
    alert('Не удалось определить ваш Telegram ID');
    return;
  }

  isSending.value = true;
  cancelRequest = false;

  // Создаём контейнер для диплома
  const diplomaDiv = document.createElement('div');
  diplomaDiv.style.position = 'absolute';
  diplomaDiv.style.left = '-9999px';
  diplomaDiv.style.top = '0';
  diplomaDiv.style.width = '900px';
  diplomaDiv.style.height = '700px';
  diplomaDiv.style.backgroundImage = 'url(/diplom.jpg)';
  diplomaDiv.style.backgroundSize = 'cover';
  diplomaDiv.style.backgroundPosition = 'center';
  diplomaDiv.style.color = 'white';
  diplomaDiv.style.fontFamily = 'Georgia, serif';
  diplomaDiv.style.textAlign = 'center';

  diplomaDiv.innerHTML = `
    <div style="position: absolute; top: 320px; left: 0; right: 0;">
      <h2 style="font-size: 30px; font-weight: 600; font-family: Georgia, 'Times New Roman', Times, serif; margin: 0; color: white;">${userName}</h2>
    </div>
    <div style="position: absolute; bottom: 85px; left: 130px;">
      <p style="font-size: 20px; text-align:left; font-family: Georgia, 'Times New Roman', Times, serif; font-weight: 500">${new Date().toLocaleDateString()}</p>
    </div>
  `;


  document.body.appendChild(diplomaDiv);


  try {
    // Проверяем, не отменено ли
    if (cancelRequest) {
      document.body.removeChild(diplomaDiv);
      return;
    }
    
    const canvas = await html2canvas(diplomaDiv, {
      scale: 2,
      backgroundColor: null,
      useCORS: true,
      allowTaint: false
    });
    
    // Проверяем, не отменено ли
    if (cancelRequest) {
      document.body.removeChild(diplomaDiv);
      return;
    }
    
    document.body.removeChild(diplomaDiv);
    
    // Конвертируем canvas в Blob
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    
    // Проверяем, не отменено ли
    if (cancelRequest) return;
    
    // Создаём FormData для отправки файла
    const formData = new FormData();
    formData.append('chat_id', telegramId);
    formData.append('photo', blob, `diplom_${userName}.png`);
    formData.append('caption', `🎓 *Диплом для ${userName}*\nРезультат: ${finalScore} из ${total} баллов`);
    formData.append('parse_mode', 'Markdown');
    
    // Отправляем фото через Telegram Bot API
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      body: formData
    });
    
    // Проверяем, не отменено ли
    if (cancelRequest) return;
    
    const result = await response.json();
    
    if (result.ok) {
      remainingAttempts.value--;
      alert(`✅ Диплом отправлен в Telegram! Осталось попыток: ${remainingAttempts.value}`);
    } else {
      console.error('Ошибка:', result);
      alert('❌ Ошибка при отправке диплома. Попробуйте позже.');
    }
    
    closeDiplomaModal();
  } catch (err) {
    if (!cancelRequest) {
      console.error('Ошибка:', err);
      alert('Ошибка при создании или отправке диплома');
    }
    document.body.removeChild(diplomaDiv);
  } finally {
    isSending.value = false;
  }
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
  padding: 0px 30px 130px 30px;
}

.button_sert {
  width: 100%;
  text-align: center;
  font-family: Georgia, 'Times New Roman', Times, serif;
  align-self: center;
  background: linear-gradient(105deg, #1e2a5e 0%, #30396b 100%);
  border: none;
  padding: 20px 0px;
  border-radius: 15px;
  font-size: 16px;
  font-weight: 600;
  color: #f0f3ff;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.2, 0.9, 0.4, 1.1);
  box-shadow: 0 6px 0 #182043;
  align-items: center;
}

.button_sert.cancel {
  background: linear-gradient(105deg, #4a2e2e 0%, #3a1f1f 100%);
  box-shadow: 0 4px 0 #2a1515;
}

.loading, .error {
  text-align: center;
  padding: 20px;
  font-size: 18px;
}

.error { color: red; }

.results {
  background: linear-gradient(to bottom, #234082 0%, #172147 100%);
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
  width: 220px;
  height: 220px;
  transition: .2s ease-in-out;
  animation: fadeSlideDown 0.5s ease-out both;
}

.mike:hover {
  width: 300px;
  height: 300px;
}

.shadow {
  position: absolute;
  width: 100%;
  height: 100vh;
  top: 0px;
  opacity: 80%;
  background: linear-gradient(to bottom, #234082 10%, rgb(255, 255, 255) 90%);
  filter: blur(10px);
  z-index: -5;
}

.quiz {
  align-self: center;
  animation: questionSlideIn 0.35s ease-out both;
  margin-bottom: 30px;
}

.subscription-check {
  animation: fadeScaleUp 0.5s ease-out 0.2s both;
}

/* Стили для модального окна */
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

.button_sert:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media(max-width: 330px) {
  .container { padding: 5px; }
}
</style>
