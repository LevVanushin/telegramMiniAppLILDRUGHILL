<template>
  <div class="container">
    <img src="./assets/mike.png" alt="" class="mike">
    
    <div v-if="loading" class="loading">Загрузка вопросов...</div>
    <quizCard 
      v-else-if="data.length > 0"
      class="quiz" 
      :title="data[0].question_text"
      :options=[data[0].option_a,data[0].option_b,data[0].option_c,data[0].option_d]
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
// const information = ref({
//   currentQuestion: true,
//   finallyQuestion: false,
// });



async function getData() {
  try {
    loading.value = true;
    
    const response = await supabase
      .from('questions')
      .select('*')
      .order('id');
    
    console.log('Полный ответ от Supabase:', response);
    console.log('response.data:', response.data);
    console.log('response.error:', response.error);
  
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
   if (window.Telegram?.WebApp) {
    window.Telegram.WebApp.expand();
    window.Telegram.WebApp.ready();
  }
});
</script>

<style>
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