import fetch from 'node-fetch';
import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';

const token = '8159210925:AAEEqIJX-OgRUMmF2jVH1x9wyB-YFgkWyzo';
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

let previousProducts = {};
let userStates = {}; // Для отслеживания состояния пользователей

// Обработчик команды /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  const keyboard = categories.map((category) => [category]);

  bot.sendMessage(chatId, 'Выберите категорию товара или воспользуйтесь функциями:', {
    reply_markup: {
      keyboard: keyboard,
      resize_keyboard: true,
      one_time_keyboard: false,
    },
  });
});

// Обработчик текстовых сообщений
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Проверяем состояние пользователя (поиск товара)
  if (userStates[chatId]?.state === 'searching') {
    handleSearch(chatId, text);
    userStates[chatId] = {}; // Сбрасываем состояние после поиска
    return;
  }

  if (!categories.includes(text)) {
    bot.sendMessage(chatId, 'Пожалуйста, выберите категорию из списка.');
    return;
  }

  let products = await fetchProducts(chatId);
  if (!products) return;

  if (text === '📉 Изменение цен') {
    handlePriceChanges(chatId, products);
    return;
  }

  if (text === '📄 Выгрузить в HTML') {
    handleHtmlExport(chatId, products);
    return;
  }

  if (text === '🔍 Найти товар') {
    bot.sendMessage(chatId, 'Введите название товара, который вы хотите найти:');
    userStates[chatId] = { state: 'searching' };
    return;
  }

  let message = formatProductsMessage(text, products);
  bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });

  previousProducts = products;
});

// Функция для получения продуктов из API
async function fetchProducts(chatId) {
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching products:', error);
    bot.sendMessage(chatId, 'Произошла ошибка при получении данных. Попробуйте позже.');
    return null;
  }
}

// Форматирование сообщений с продуктами
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

// Функция для поиска товаров
async function handleSearch(chatId, query) {
  try {
    const products = await fetchProducts(chatId);
    if (!products) return;

    const searchResults = [];

    for (const [category, items] of Object.entries(products)) {
      const matchingItems = items.filter((item) =>
        item.name.toLowerCase().includes(query.toLowerCase())
      );

      if (matchingItems.length > 0) {
        searchResults.push({
          category: category,
          items: matchingItems,
        });
      }
    }

    if (searchResults.length === 0) {
      bot.sendMessage(chatId, `По вашему запросу "${query}" ничего не найдено.`);
      return;
    }

    let message = `Результаты поиска по запросу "${query}":\n\n`;
    searchResults.forEach((result) => {
      message += `*${result.category}*:\n${result.items
        .map((item) => `- ${item.name}: ${item.price}`)
        .join('\n')}\n\n`;
    });

    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error during search:', error);
    bot.sendMessage(chatId, 'Произошла ошибка при поиске. Попробуйте позже.');
  }
}

// Функция для выгрузки всех товаров в таблице HTML
async function handleHtmlExport(chatId, products) {
  let htmlContent = `
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Список товаров</title>
      </head>
      <body>
        <h1>Список всех товаров</h1>
        <table border="1" cellpadding="5" cellspacing="0">
          <tr>
            <th>Категория</th>
            <th>Товар</th>
            <th>Цена</th>
          </tr>`;

  for (const [category, items] of Object.entries(products)) {
    items.forEach((item) => {
      htmlContent += `
        <tr>
          <td>${category}</td>
          <td>${item.name}</td>
          <td>${item.price}</td>
        </tr>`;
    });
  }

  htmlContent += '</table></body></html>';

  const filePath = `products_list_${Date.now()}.html`;

  try {
    fs.writeFileSync(filePath, htmlContent);

    await bot.sendDocument(chatId, filePath, {}, {
      filename: 'Список_товаров.html',
      contentType: 'text/html',
    });

    fs.unlinkSync(filePath);
  } catch (error) {
    console.error('Error handling file:', error);
    bot.sendMessage(chatId, 'Произошла ошибка при обработке файла.');
  }
}

// Функция для отображения изменений цен
async function handlePriceChanges(chatId, currentProducts) {
  if (!previousProducts || Object.keys(previousProducts).length === 0) {
    bot.sendMessage(chatId, 'Данные о предыдущих ценах отсутствуют. Попробуйте позже.');
    previousProducts = currentProducts;
    return;
  }

  let changesDetected = false;
  let htmlContent = `
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Изменения цен</title>
      </head>
      <body>
        <h1>Изменения цен</h1>
        <table border="1" cellpadding="5" cellspacing="0">
          <tr>
            <th>Категория</th>
            <th>Товар</th>
            <th>Старая цена</th>
            <th>Новая цена</th>
          </tr>`;

  for (const [category, items] of Object.entries(currentProducts)) {
    items.forEach((currentItem) => {
      const prevItem = previousProducts[category]?.find(item => item.name === currentItem.name);
      if (prevItem && prevItem.price !== currentItem.price) {
        changesDetected = true;
        htmlContent += `
          <tr>
            <td>${category}</td>
            <td>${currentItem.name}</td>
            <td>${prevItem.price}</td>
            <td>${currentItem.price}</td>
          </tr>`;
      }
    });
  }

  htmlContent += '</table></body></html>';

  if (!changesDetected) {
    bot.sendMessage(chatId, 'Цены не изменились.');
    return;
  }

  const filePath = `price_changes_${Date.now()}.html`;
  try {
    fs.writeFileSync(filePath, htmlContent);
    await bot.sendDocument(chatId, filePath, {}, {
      filename: 'Изменения_цен.html',
      contentType: 'text/html',
    });
    fs.unlinkSync(filePath);
  } catch (error) {
    console.error('Error handling file:', error);
    bot.sendMessage(chatId, 'Произошла ошибка при обработке файла.');
  }

  previousProducts = currentProducts;
}
