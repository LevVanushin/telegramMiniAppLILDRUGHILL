<template>
  <div class="container">
    <img src="./assets/mike.png" alt="" class="mike">
    
    <div v-if="loading" class="loading">Загрузка вопросов...</div>
    
    <quizCard 
      v-else-if="data.length > 0"
      class="quiz" 
      :title="data[0]?.question_text"
      :optionA="data[0]?.option_a"
      :optionB="data[0]?.option_b"
      :optionC="data[0]?.option_c"
      :optionD="data[0]?.option_d"
      :correctOption="data[0]?.correct_option"
    />
    
    <div v-else-if="errorMessage" class="error">{{ errorMessage }}</div>
    <div v-else-if="!loading" class="error">Нет данных</div>
  </div>
  <div class="shadow"></div>
</template>

<script setup>
import { supabase } from "./lib/supabase.js";
import quizCard from "./components/quizCard.vue";
import { onMounted, ref } from "vue";

const data = ref([]);
const loading = ref(true);
const errorMessage = ref('');

async function getData() {
  try {
    loading.value = true;
    
    // ПРОБЛЕМА БЫЛА ЗДЕСЬ - неправильное извлечение данных
    const response = await supabase
      .from('questions')
      .select('*')
      .order('id');
    
    // ВАЖНО! response содержит { data: [], error: null }
    // Нужно взять response.data, а не сам response
    console.log('Полный ответ от Supabase:', response);
    console.log('response.data:', response.data);
    console.log('response.error:', response.error);
    
    if (response.error) {
      throw new Error(response.error.message);
    }
    
    // ПРАВИЛЬНО: присваиваем response.data, а не response
    data.value = response.data || [];
    
    console.log('Количество вопросов:', data.value.length);
    console.log('Первый вопрос:', data.value[0]);
    
  } catch (error) {
    console.error('Ошибка:', error);
    errorMessage.value = error.message;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  getData();
});
</script>

<style>
.container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 170px;
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

.mike {
  position: relative;
  top: 100px;
  width: 250px;
  height: 250px;
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
  margin: 50% auto;
  align-self: center;
}
</style>