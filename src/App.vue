<template>
  <div class="container">
    <img src="./assets/mike.png" alt="" class="mike">
    <quizCard class="quiz"/>

  </div>
  <div class="shadow"></div>
</template>
<script setup>
  import Header from "./components/header.vue"
  import Timer from "./components/timer.vue"
  import quizCard from "./components/quizCard.vue";
</script>
<style>

  .container{
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;

      gap: 170px;
  }

  .mike{
    position: relative;
    top: 100px;
    width: 250px;
    height: 250px;
  }
  .shadow{
    position: absolute;
    width: 100%;
    height: 100%;
    top: -20px;
    opacity: 80%;
    background: linear-gradient(to bottom, #234082 10%, rgb(255, 255, 255) 90%);
    filter: blur(10px); 

    z-index: -5;
  }

  .quiz{
    margin: 50% auto;
    align-self: center;
}
</style>
