<template>
  <div :style="styles.page">
    <!-- LOADING -->
    <div v-if="step === 'loading'" :style="styles.card">
      <p>Проверяем подписку...</p>
    </div>

    <!-- SUBSCRIBE SCREEN -->
    <div v-else-if="step === 'subscribe'" :style="styles.card">
      <h1 :style="styles.title">ЕГЭ ПО LILDRUGHILL</h1>
      
      <p :style="styles.text">
        Для прохождения экзамена подпишитесь на канал
      </p>

      <a
        href="https://t.me/lildrughillarmy"
        target="_blank"
        style="text-decoration: none"
      >
        <button :style="styles.primaryBtn">
          Подписаться
        </button>
      </a>

      <button
        @click="checkSubscription(userId)"
        :style="styles.secondaryBtn"
      >
        Я подписался
      </button>

      <p v-if="error" :style="styles.error">
        {{ error }}
      </p>
    </div>

    <!-- EXAM -->
    <div v-else :style="styles.card">
      <div :style="styles.topBar">
        <span>
          Вопрос {{ exam.current + 1 }}/{{ exam.questions.length }}
        </span>

        <span>
          {{ Math.floor(exam.timeLeft / 60) }}:
          {{ String(exam.timeLeft % 60).padStart(2, "0") }}
        </span>
      </div>

      <p v-if="!q">Загрузка...</p>
      
      <template v-else>
        <p :style="styles.question">{{ q.question }}</p>

        <!-- MCQ -->
        <template v-if="q.type === 'mcq'">
          <button
            v-for="(opt, i) in q.options"
            :key="i"
            @click="exam.answerQuestion(opt)"
            :style="styles.optionBtn"
          >
            {{ opt }}
          </button>
        </template>

        <!-- TEXT -->
        <input
          v-if="q.type === 'text'"
          @input="(e) => exam.answerQuestion(e.target.value)"
          :style="styles.input"
          placeholder="Введите ответ"
        />

        <button
          @click="handleNext"
          :style="styles.primaryBtn"
        >
          Далее
        </button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useExam } from './exam/useExam'

const tg = window.Telegram?.WebApp
const tgUser = tg?.initDataUnsafe?.user

const userId = computed(() => tgUser?.id || 'test-user')

const exam = useExam(userId.value)

const step = ref('loading')
const error = ref('')

const q = computed(() => exam.questions?.[exam.current])

const checkSubscription = async (userId) => {
  try {
    error.value = ''

    const res = await fetch(`/api/check-sub?userId=${userId}`)
    const data = await res.json()

    if (data.subscribed) {
      step.value = 'exam'
    } else {
      error.value = 'Вы не подписаны на канал'
    }
  } catch (e) {
    console.log(e)
    error.value = 'Ошибка проверки подписки'
  }
}

const handleNext = () => {
  if (exam.current < exam.questions.length - 1) {
    exam.setCurrent(exam.current + 1)
  } else {
    exam.finishExam()
  }
}

onMounted(() => {
  if (!tgUser) {
    step.value = 'subscribe'
    return
  }

  checkSubscription(tgUser.id)
})

const styles = {
  page: {
    fontFamily: 'Inter, sans-serif',
    background: '#8a858500',
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '16px'
  },

  card: {
    width: '100%',
    maxWidth: '420px',
    background: 'white',
    borderRadius: '20px',
    padding: '20px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.08)'
  },

  title: {
    fontSize: '24px',
    color: '#1e88e5',
    marginBottom: '10px'
  },

  text: {
    color: '#555',
    marginBottom: '16px'
  },

  error: {
    color: 'red',
    marginTop: '12px',
    textAlign: 'center'
  },

  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '16px',
    fontWeight: '600',
    color: '#1e88e5'
  },

  question: {
    fontSize: '18px',
    marginBottom: '16px'
  },

  primaryBtn: {
    width: '100%',
    padding: '14px',
    borderRadius: '12px',
    border: 'none',
    background: '#1e88e5',
    color: 'white',
    fontWeight: '600',
    marginTop: '12px'
  },

  secondaryBtn: {
    width: '100%',
    padding: '14px',
    borderRadius: '12px',
    border: '1px solid #1e88e5',
    background: 'white',
    color: '#1e88e5',
    marginTop: '10px'
  },

  optionBtn: {
    width: '100%',
    padding: '12px',
    marginTop: '8px',
    borderRadius: '10px',
    border: '1px solid #e5e7eb',
    background: '#fff',
    textAlign: 'left'
  },

  input: {
    width: '100%',
    padding: '12px',
    borderRadius: '10px',
    border: '1px solid #ddd',
    marginTop: '10px'
  }
}
</script>