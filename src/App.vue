<template>
  <div class="card-container">
    <div class="army-signature">
      <p class="army">lildrughill army</p>
      <p class="mikeCaption">MIKE</p>
    </div>

    <h1 class="main-title">Подпишись на канал</h1>
    <p class="subtitle">обязательное условие</p>
    <p class="description">Для прохождения викторины необходимо подписаться на наш Telegram канал</p>

    <div class="options-list">
      <button class="option-button subscribe-btn" @click="openTelegramLink">
        <span class="option-index">📱</span>
        Подписаться
      </button>
      
      <button @click="checkSubscription" class="option-button check-btn" :disabled="checking">
        <span class="option-index">✅</span>
        {{ checking ? 'Проверяем...' : 'Проверить подписку' }}
      </button>
    </div>

    <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
    <p v-if="successMessage" class="success-message">{{ successMessage }}</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { supabase } from './lib/supabase.js';

const emit = defineEmits(['verified']);

const CHANNEL_USERNAME = 'lildrughillarmy';
const CHANNEL_LINK = 'https://t.me/lildrughillarmy';

const checking = ref(false);
const errorMessage = ref('');
const successMessage = ref('');
const botToken = ref('');

// Загрузка токена при монтировании
onMounted(async () => {
  const { data } = await supabase
    .from('telegramData')
    .select('botToken')
    .single();
  
  if (data?.botToken) {
    botToken.value = data.botToken;
  } else {
    errorMessage.value = 'Ошибка: токен не загружен';
  }
});

function openTelegramLink() {
  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.openTelegramLink(CHANNEL_LINK);
  } else {
    window.open(CHANNEL_LINK, '_blank');
  }
}

async function checkSubscription() {
  if (!botToken.value) {
    errorMessage.value = 'Токен не загружен, попробуйте через секунду';
    return;
  }
  
  checking.value = true;
  errorMessage.value = '';
  successMessage.value = '';
  
  // Получаем user_id из URL
  const urlParams = new URLSearchParams(window.location.search);
  let userId = urlParams.get('user_id');
  
  if (!userId) {
    errorMessage.value = 'Не удалось определить пользователя. Перезапустите бота командой /start';
    checking.value = false;
    return;
  }
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken.value}/getChatMember`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: `@${CHANNEL_USERNAME}`,
        user_id: parseInt(userId)
      })
    });
    
    const data = await response.json();
    
    if (data.ok && data.result) {
      const status = data.result.status;
      if (status === 'creator' || status === 'administrator' || status === 'member' || status === 'restricted') {
        successMessage.value = '✅ Подписка подтверждена! Перенаправляем...';
        setTimeout(() => {
          emit('verified');
        }, 1500);
      } else {
        errorMessage.value = '❌ Вы не подписаны на канал. Подпишитесь и нажмите "Проверить подписку"';
      }
    } else {
      errorMessage.value = `Ошибка: ${data.description || 'Не удалось проверить'}`;
    }
  } catch (error) {
    errorMessage.value = 'Ошибка соединения. Попробуйте позже.';
  } finally {
    checking.value = false;
  }
}
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