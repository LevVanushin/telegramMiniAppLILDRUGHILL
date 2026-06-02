import { Markup, Telegraf } from 'telegraf';
import { supabase } from './supabase.js';
import { inlineKeyboard } from 'telegraf/markup';

const { data } = await supabase.from('telegramData').select('botToken').single();

if (!data || !data.botToken) {
  console.error('Токен не найден');
  process.exit(1);
}

const bot = new Telegraf(data.botToken);

bot.start((ctx) => {ctx.reply(`ЕГЭ по реперу LILDRUGHILL 

Состоит из 2 частей: 

• 1 часть: 16 тестовых вопросов. v

• 2 часть: письменная часть, ответ на вопрос. Объем ответа не важен.

Проверяться будет в ручную. 

Обязательным условием прохождения экзамена является подписка на наш телеграмм!

Удачи! 
  `,  Markup.inlineKeyboard([
  [Markup.button.webApp("Начать прохождение", 'https://telegram-mini-app-lildrughill-x5j8.vercel.app/?mode=fullscreen')]
]))}

);

bot.on('web_app_data', (ctx) => {
  const data = JSON.parse(ctx.webAppData.data.json());
  console.log('Получено:', data);
  console.log('Пользователь:', ctx.from.id);
  
  ctx.reply('Викторина открыта!');
});
bot.command('quiz', (ctx) => ctx.reply('Ссылка на викторину'));

bot.launch();  