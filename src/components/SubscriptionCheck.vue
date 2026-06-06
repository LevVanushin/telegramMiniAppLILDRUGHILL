<!-- src/components/SubscriptionCheck.vue -->
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
        Подписаться
      </button>
      
      <button @click="checkSubscription" class="option-button check-btn" :disabled="checking">
        {{ checking ? 'Проверяем...' : 'Проверить подписку' }}
      </button>
    </div>

    <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
    <p v-if="successMessage" class="success-message">{{ successMessage }}</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { supabase } from '../lib/supabase.js';

const emit = defineEmits(['verified']);

const CHANNEL_USERNAME = 'lildrughillarmy';
const CHANNEL_LINK = 'https://t.me/lildrughillarmy';

const checking = ref(false);
const errorMessage = ref('');
const successMessage = ref('');
const botToken = ref('');

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
        successMessage.value = 'Подписка подтверждена! Перенаправляем...';
        setTimeout(() => {
          emit('verified');
        }, 1500);
      } else {
        errorMessage.value = 'Вы не подписаны на канал. Подпишитесь и нажмите "Проверить подписку"';
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

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Geologica:wght,CRSV@100..900,0&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,100..900;1,100..900&display=swap');

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

.army {
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

.main-title {
  font-size: 24px;
  font-weight: 800;
  font-family: "Geologica", sans-serif;
  line-height: 1.25;
  letter-spacing: 2px;
  margin: 0 0 12px 0;
  text-transform: uppercase;
  color: white;
}

.subtitle {
  position: relative;
  font-size: 17px;
  font-weight: 700;
  font-family: "Roboto", sans-serif;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #8d9bee;
  margin: 0 0 28px 0;
  border-left: 3px solid #5d81e1;
  padding-left: 10px;
}

.description {
  color: #b9cbff;
  margin-bottom: 28px;
  line-height: 1.5;
  font-size: 18px;
  font-family: 'Roboto', sans-serif;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

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
  text-decoration: none;
  width: 100%;
}



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

.option-button:active {
  transform: translateY(4px);
  box-shadow: 0 2px 0 #0b0f24;
  transition: 0.05s;
}

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

.check-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  color: #ff6b6b;
  margin-top: 20px;
  font-size: 14px;
  font-weight: 600;
  font-family: "Roboto" Times, serif;
  text-align: center;
}

.success-message {
  color: #5df2b0;
  margin-top: 20px;
  font-size: 14px;
  font-weight: 600;
  font-family: "Roboto", sans-serif;  text-align: center;
}

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
  .description {
    font-size: 13px;
  }
}

@media (max-width: 400px) {
  .main-title {
    font-size: 18px;
  }
}
</style>