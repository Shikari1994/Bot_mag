import fetch from 'node-fetch';
import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();


// Конфигурация
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });
const apiUrl = 'https://my-json-server.typicode.com/Shikari1994/products-api/products';

const categories = [
  'Весь прайс',
  '📱 Смартфоны',
  '🎮 Игровые приставки',
  '⌚ Часы',
  '💨 Фены',
  '📟 Планшеты',
  '💻 Ноутбуки',
  '🖱️ Аксессуары Apple',
  '📉 Изменение цен',
  '🔍 Найти товар',
  '📄 Выгрузить в HTML',
];

const categoryMapping = {
  '📱 Смартфоны': 'Смартфоны',
  '🎮 Игровые приставки': 'Игровые приставки',
  '⌚ Часы': 'Часы',
  '💨 Фены': 'Фены',
  '📟 Планшеты': 'Планшеты',
  '💻 Ноутбуки': 'Ноутбуки',
  '🖱️ Аксессуары Apple': 'Аксессуары Apple',
};

// Состояние пользователей и предыдущие данные
const userStates = {}; // Для отслеживания действий пользователей
let previousProducts = {}; // Для сравнения изменений цен

// ====== Обработчики команд ======

// Стартовая команда
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const keyboard = categories.map((category) => [category]);

  bot.sendMessage(chatId, 'Выберите категорию товара или воспользуйтесь функциями:', {
    reply_markup: {
      keyboard,
      resize_keyboard: true,
      one_time_keyboard: false,
    },
  });
});

// Обработка текстовых сообщений
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!categories.includes(text)) {
    return bot.sendMessage(chatId, 'Пожалуйста, выберите категорию из списка.');
  }

  const products = await fetchProducts(chatId);
  if (!products) return;

  switch (text) {
    case '📉 Изменение цен':
      return handlePriceChanges(chatId, products);
    case '📄 Выгрузить в HTML':
      return handleHtmlExport(chatId, products);
    case '🔍 Найти товар':
      userStates[chatId] = { state: 'searching' };
      return bot.sendMessage(chatId, 'Введите название товара, который вы хотите найти:');
    default:
      const message = formatProductsMessage(text, products);
      return bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  }
});

// ====== Основные функции ======

// Получение данных о продуктах
async function fetchProducts(chatId) {
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Ошибка получения данных:', error.message);
    bot.sendMessage(chatId, 'Не удалось загрузить данные. Пожалуйста, попробуйте позже.');
    return null;
  }
}

// Форматирование сообщения с продуктами
function formatProductsMessage(category, products) {
  if (category === 'Весь прайс') {
    return Object.entries(products)
      .map(([cat, items]) => `*${cat}*:\n${items.map(item => `- ${item.name}: ${item.price}`).join('\n')}`)
      .join('\n\n');
  }

  const apiCategory = categoryMapping[category];
  const categoryProducts = products[apiCategory];

  if (!categoryProducts || categoryProducts.length === 0) {
    return `Товары для категории "${category}" не найдены.`;
  }

  return `*${apiCategory}*:\n${categoryProducts.map(item => `- ${item.name}: ${item.price}`).join('\n')}`;
}

// Экспорт в HTML
function handleHtmlExport(chatId, products) {
  const htmlContent = generateHtml(products, 'Список всех товаров', ['Категория', 'Товар', 'Цена']);
  sendHtmlFile(chatId, htmlContent, 'products_list.html', 'Список_товаров.html');
}

// Изменения цен
function handlePriceChanges(chatId, currentProducts) {
  if (!previousProducts || Object.keys(previousProducts).length === 0) {
    bot.sendMessage(chatId, 'Данные о предыдущих ценах отсутствуют. Попробуйте позже.');
    previousProducts = currentProducts;
    return;
  }

  const changesHtml = generateHtmlWithChanges(previousProducts, currentProducts);
  if (!changesHtml) {
    return bot.sendMessage(chatId, 'Изменения цен не найдены.');
  }

  sendHtmlFile(chatId, changesHtml, 'price_changes.html', 'Изменения_цен.html');
  previousProducts = currentProducts;
}

// ====== Вспомогательные функции ======

// Генерация HTML
function generateHtml(products, title, headers) {
  const rows = Object.entries(products).flatMap(([category, items]) =>
    items.map(item => `<tr><td>${category}</td><td>${item.name}</td><td>${item.price}</td></tr>`)
  );

  return `
    <html>
      <head><meta charset="UTF-8"><title>${title}</title></head>
      <body>
        <h1>${title}</h1>
        <table border="1" cellpadding="5" cellspacing="0">
          <tr>${headers.map(header => `<th>${header}</th>`).join('')}</tr>
          ${rows.join('')}
        </table>
      </body>
    </html>`;
}

// Генерация HTML с изменениями цен
function generateHtmlWithChanges(prevProducts, currProducts) {
  const rows = [];
  let hasChanges = false;

  for (const [category, items] of Object.entries(currProducts)) {
    items.forEach(item => {
      const prevItem = prevProducts[category]?.find(p => p.name === item.name);
      if (prevItem && prevItem.price !== item.price) {
        hasChanges = true;
        rows.push(`<tr><td>${category}</td><td>${item.name}</td><td>${prevItem.price}</td><td>${item.price}</td></tr>`);
      }
    });
  }

  if (!hasChanges) return null;

  return `
    <html>
      <head><meta charset="UTF-8"><title>Изменения цен</title></head>
      <body>
        <h1>Изменения цен</h1>
        <table border="1" cellpadding="5" cellspacing="0">
          <tr><th>Категория</th><th>Товар</th><th>Старая цена</th><th>Новая цена</th></tr>
          ${rows.join('')}
        </table>
      </body>
    </html>`;
}

// Отправка HTML файла
function sendHtmlFile(chatId, content, filePath, fileName) {
  try {
    fs.writeFileSync(filePath, content);
    bot.sendDocument(chatId, filePath, {}, { filename: fileName, contentType: 'text/html' });
    fs.unlinkSync(filePath);
  } catch (error) {
    console.error('Ошибка отправки файла:', error.message);
    bot.sendMessage(chatId, 'Произошла ошибка при отправке файла.');
  }
}
