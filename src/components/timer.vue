<template>
  
  <div class="timer">
    <p class="timer__time">{{ time }}</p>
  </div>

  <!-- <button @click="stop">Стоп</button> -->
  <!-- <button @click="start">Старт</button> -->
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

let timeLeft = 30 * 60
const time = ref('30:00')
let interval = null

const update = () => {
  if (timeLeft <= 0) return clearInterval(interval)
  timeLeft--
  const m = Math.floor(timeLeft / 60)
  const s = timeLeft % 60
  time.value = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function stop(){
  clearInterval(interval)
}


function start(){
  interval = setInterval(update, 1000)
}

</script>


<style scoped>

  .timer{

  }
</style>