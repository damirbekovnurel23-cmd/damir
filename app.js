/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║   ФИНАНСОВЫЙ ИИ-АССИСТЕНТ — ЛОГИКА ПРИЛОЖЕНИЯ               ║
 * ║   Файл: app.js                                               ║
 * ║   Описание: Весь JavaScript-код чатбота                      ║
 * ║                                                              ║
 * ║   Структура файла:                                           ║
 * ║     1.  Конфигурация API и системный промт                   ║
 * ║     2.  Состояние приложения                                 ║
 * ║     3.  Ссылки на DOM-элементы                               ║
 * ║     4.  Управление localStorage (сохранение истории)         ║
 * ║     5.  Управление сессиями чата                             ║
 * ║     6.  Рендеринг интерфейса                                 ║
 * ║     7.  Отправка сообщений в Groq API                        ║
 * ║     8.  Обработка Markdown в ответах бота                    ║
 * ║     9.  UI-утилиты (toast, error, status)                    ║
 * ║     10. Обработчики событий (event listeners)                ║
 * ║     11. Инициализация приложения                             ║
 * ╚══════════════════════════════════════════════════════════════╝
 */


/* ═══════════════════════════════════════════════
   1. КОНФИГУРАЦИЯ API И СИСТЕМНЫЙ ПРОМТ
   Все настройки в одном месте — легко менять
═══════════════════════════════════════════════ */

/**
 * Конфигурация Groq API
 * ВНИМАНИЕ: В production-приложении API-ключ должен
 * храниться на сервере, а не в клиентском коде.
 */
const CONFIG = {
  // URL эндпоинта Groq API для создания сообщений
  apiUrl: 'https://api.groq.com/openai/v1/chat/completions',

  // API-ключ (НЕ публикуй его в открытом доступе!)
  apiKey: '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',

  // Модель LLaMA 4 через Groq
  model: 'meta-llama/llama-4-scout-17b-16e-instruct',

  // Максимальное количество токенов в ответе
  maxTokens: 1500,

  // Температура генерации (0 — точно, 1 — творчески)
  temperature: 0.7,

  // Максимальное количество сохранённых сессий в истории
  maxSessions: 20,

  // Ключ для хранения истории в localStorage
  storageKey: 'akchabot_chat_history',
};

/**
 * СИСТЕМНЫЙ ПРОМТ — инструкция для ИИ
 * Определяет роль, стиль и ограничения ассистента.
 * Пиши подробно: чем точнее промт, тем лучше ответы.
 */
const SYSTEM_PROMPT = `Ты — АкчаБот, дружелюбный финансовый ИИ-ассистент для молодёжи Кыргызстана.

ТВОЯ РОЛЬ:
- Помогаешь молодым людям (18–45) разобраться в личных финансах
- Даёшь практичные советы, применимые в реалиях Кыргызстана
- Объясняешь сложные финансовые концепции простым языком

ТЕМЫ, В КОТОРЫХ ТЫ ПОМОГАЕШЬ:
1. Личный бюджет и планирование расходов
2. Сбережения и накопления в сомах (KGS) и валюте
3. Банковские продукты: депозиты, дебетовые карты, расчётные счета в банках Кыргызстана (Банк ЮГ, ЭЛКОМ, Оптима, МБА и др.)
4. Кредиты: потребительские, ипотека, микрозаймы — риски и условия
5. Инвестиции: что доступно в KG (золото, валюта, акции через зарубежные брокеры)
6. Инфляция сома и защита сбережений
7. Мобильные платёжные системы: Элсом, О!Деньги, МБанк, Bakai24,Balance KG.     
8. Налоги для самозанятых и фрилансеров в KG
9. Пенсионные накопления (ГФСС)
10.Финансовые цели: образование, жильё, бизнес
11.Расскажи многое о электронныз кошельков

СТИЛЬ ОБЩЕНИЯ:
- Отвечай всегда на русском языке
- Тон: дружелюбный, но профессиональный — как советует умный друг
- Используй конкретные цифры и примеры в сомах (сом, сомов, сомах — склоняй правильно)
- Структурируй длинные ответы: используй заголовки, списки, выделения **жирным**
- Будь честным: если что-то рискованно — предупреди
- Если не знаешь актуальных ставок/условий — скажи об этом и предложи проверить на официальном сайте

ОГРАНИЧЕНИЯ:
- Не давай советы по нелегальным схемам уклонения от налогов
- Не рекомендуй сомнительные инвестиционные схемы или финансовые пирамиды
- Добавляй дисклеймер к серьёзным финансовым решениям: "Перед принятием важных решений проконсультируйся с финансовым специалистом"

Начни каждый разговор грубо !`;


/* ═══════════════════════════════════════════════
   2. СОСТОЯНИЕ ПРИЛОЖЕНИЯ (Application State)
   Все данные приложения хранятся здесь
═══════════════════════════════════════════════ */
const state = {
  // ID текущей активной сессии чата
  currentSessionId: null,

  // Массив сообщений текущей сессии
  // Формат каждого: { role: 'user'|'assistant', content: string }
  currentMessages: [],

  // Флаг: идёт ли сейчас запрос к API
  isLoading: false,

  // Все сессии: загружаются из localStorage
  sessions: [],
};


/* ═══════════════════════════════════════════════
   3. ССЫЛКИ НА DOM-ЭЛЕМЕНТЫ
   Кэшируем элементы — быстрее, чем каждый раз
   вызывать document.getElementById()
═══════════════════════════════════════════════ */
const DOM = {
  // Сайдбар и его элементы
  sidebar:          document.getElementById('sidebar'),
  sidebarCloseBtn:  document.getElementById('sidebarCloseBtn'),
  sidebarOverlay:   document.getElementById('sidebarOverlay'),
  chatHistoryList:  document.getElementById('chatHistoryList'),
  historyEmpty:     document.getElementById('historyEmpty'),

  // Кнопки управления
  hamburgerBtn:     document.getElementById('hamburgerBtn'),
  newChatBtn:       document.getElementById('newChatBtn'),
  clearBtn:         document.getElementById('clearBtn'),

  // Основная область чата
  welcomeScreen:    document.getElementById('welcomeScreen'),
  messagesArea:     document.getElementById('messagesArea'),
  messagesList:     document.getElementById('messagesList'),

  // Статус ИИ
  statusDot:        document.getElementById('statusDot'),
  statusLabel:      document.getElementById('statusLabel'),

  // Поле ввода
  messageInput:     document.getElementById('messageInput'),
  sendBtn:          document.getElementById('sendBtn'),

  // Ошибки
  errorBanner:      document.getElementById('errorBanner'),
  errorText:        document.getElementById('errorText'),
  errorCloseBtn:    document.getElementById('errorCloseBtn'),

  // Toast-уведомление
  toast:            document.getElementById('toast'),
};


/* ═══════════════════════════════════════════════
   4. УПРАВЛЕНИЕ localStorage
   Все данные чатов сохраняются в браузере
═══════════════════════════════════════════════ */

/**
 * Загружает историю чатов из localStorage.
 * Если данных нет или они повреждены — возвращает пустой массив.
 *
 * @returns {Array} Массив сессий чатов
 */
function loadSessions() {
  try {
    const raw = localStorage.getItem(CONFIG.storageKey);
    if (!raw) return [];

    const parsed = JSON.parse(raw);

    // Проверяем, что данные — это массив
    if (!Array.isArray(parsed)) {
      console.warn('АкчаБот: Данные в localStorage повреждены, сбрасываем...');
      return [];
    }

    return parsed;
  } catch (error) {
    // JSON.parse может бросить SyntaxError
    console.error('АкчаБот: Ошибка при чтении localStorage:', error);
    return [];
  }
}

/**
 * Сохраняет все сессии в localStorage.
 * Ограничивает количество сессий до CONFIG.maxSessions.
 *
 * @param {Array} sessions - Массив сессий для сохранения
 */
function saveSessions(sessions) {
  try {
    // Ограничиваем количество сессий (берём только последние)
    const limited = sessions.slice(-CONFIG.maxSessions);
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(limited));
  } catch (error) {
    // Может возникнуть QuotaExceededError при переполнении хранилища
    console.error('АкчаБот: Ошибка при записи в localStorage:', error);
    showToast('Не удалось сохранить историю: мало места в памяти браузера', 'error');
  }
}

/**
 * Находит сессию по ID.
 *
 * @param {string} sessionId - ID сессии
 * @returns {Object|null} Объект сессии или null
 */
function findSession(sessionId) {
  return state.sessions.find(s => s.id === sessionId) || null;
}

/**
 * Обновляет сессию в массиве state.sessions и сохраняет.
 *
 * @param {string} sessionId - ID сессии для обновления
 * @param {Object} updates - Объект с обновлёнными полями
 */
function updateSession(sessionId, updates) {
  const index = state.sessions.findIndex(s => s.id === sessionId);
  if (index === -1) return;

  state.sessions[index] = { ...state.sessions[index], ...updates };
  saveSessions(state.sessions);
}


/* ═══════════════════════════════════════════════
   5. УПРАВЛЕНИЕ СЕССИЯМИ ЧАТА
═══════════════════════════════════════════════ */

/**
 * Генерирует уникальный ID для новой сессии.
 * Используем комбинацию времени и случайного числа.
 *
 * @returns {string} Уникальный ID вида "sess_1234567890_abc"
 */
function generateSessionId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `sess_${timestamp}_${random}`;
}

/**
 * Создаёт новую сессию чата и делает её активной.
 * Сбрасывает историю сообщений и показывает приветственный экран.
 */
function createNewSession() {
  const sessionId = generateSessionId();
  const now = new Date();

  // Объект новой сессии
  const newSession = {
    id: sessionId,
    // Название сессии (будет обновлено после первого сообщения)
    title: 'Новый чат',
    // Дата создания в ISO-формате
    createdAt: now.toISOString(),
    // Дата последнего сообщения
    updatedAt: now.toISOString(),
    // Массив сообщений этой сессии
    messages: [],
  };

  // Добавляем в список сессий
  state.sessions.push(newSession);
  saveSessions(state.sessions);

  // Активируем новую сессию
  activateSession(sessionId);
}

/**
 * Активирует существующую сессию — загружает её сообщения.
 *
 * @param {string} sessionId - ID сессии для активации
 */
function activateSession(sessionId) {
  const session = findSession(sessionId);
  if (!session) return;

  // Обновляем состояние
  state.currentSessionId = sessionId;
  state.currentMessages = [...session.messages];

  // Скрываем ошибку (из предыдущей сессии)
  hideError();

  // Рендерим сообщения или приветственный экран
  renderMessages();

  // Обновляем список истории (выделяем активную)
  renderChatHistory();

  // На мобайл закрываем сайдбар после выбора чата
  if (window.innerWidth <= 768) {
    closeSidebar();
  }
}

/**
 * Удаляет сессию из истории.
 *
 * @param {string} sessionId - ID сессии для удаления
 * @param {Event} event - Событие клика (чтобы не открыть сессию)
 */
function deleteSession(sessionId, event) {
  // Останавливаем всплытие события, чтобы не активировать сессию
  event.stopPropagation();

  // Удаляем из массива
  state.sessions = state.sessions.filter(s => s.id !== sessionId);
  saveSessions(state.sessions);

  // Если удалили текущую — создаём новую
  if (state.currentSessionId === sessionId) {
    if (state.sessions.length > 0) {
      // Активируем последнюю из оставшихся
      activateSession(state.sessions[state.sessions.length - 1].id);
    } else {
      // Нет сессий — создаём новую
      createNewSession();
    }
  } else {
    // Просто обновляем список
    renderChatHistory();
  }

  showToast('Чат удалён');
}

/**
 * Очищает все сообщения текущей сессии.
 */
function clearCurrentChat() {
  if (!state.currentSessionId) return;

  // Очищаем сообщения в состоянии
  state.currentMessages = [];

  // Обновляем сессию в хранилище
  updateSession(state.currentSessionId, {
    messages: [],
    title: 'Новый чат',
    updatedAt: new Date().toISOString(),
  });

  // Обновляем интерфейс
  renderMessages();
  renderChatHistory();

  showToast('Чат очищен');
}

/**
 * Генерирует название чата на основе первого сообщения пользователя.
 * Обрезает до 40 символов для красивого отображения.
 *
 * @param {string} message - Первое сообщение пользователя
 * @returns {string} Название для сессии
 */
function generateSessionTitle(message) {
  // Убираем лишние пробелы и переносы строк
  const cleaned = message.trim().replace(/\s+/g, ' ');
  // Обрезаем и добавляем многоточие если длинно
  return cleaned.length > 40
    ? cleaned.substring(0, 40) + '...'
    : cleaned;
}
/* ═══════════════════════════════════════════════
   6. РЕНДЕРИНГ ИНТЕРФЕЙСА
   Функции для отображения данных в DOM
═══════════════════════════════════════════════ */

/**
 * Рендерит список истории чатов в сайдбаре.
 * Показывает заглушку если история пуста.
 */
function renderChatHistory() {
  const list = DOM.chatHistoryList;
  const empty = DOM.historyEmpty;

  // Если нет сессий — показываем заглушку
  if (state.sessions.length === 0) {
    empty.style.display = 'flex';
    // Удаляем все элементы кроме заглушки
    Array.from(list.children).forEach(child => {
      if (child !== empty) child.remove();
    });
    return;
  }

  // Скрываем заглушку
  empty.style.display = 'none';

  // Удаляем старые элементы
  Array.from(list.children).forEach(child => {
    if (child !== empty) child.remove();
  });

  // Рендерим сессии в обратном порядке (новые сверху)
  const reversed = [...state.sessions].reverse();

  reversed.forEach(session => {
    const li = document.createElement('li');
    li.className = 'chat-history__item';

    // Выделяем активную сессию
    if (session.id === state.currentSessionId) {
      li.classList.add('chat-history__item--active');
    }

    // Формируем временну́ю метку
    const date = new Date(session.updatedAt);
    const timeLabel = formatRelativeTime(date);

    li.innerHTML = `
      <span class="chat-history__item-text" title="${escapeHtml(session.title)}">
        ${escapeHtml(session.title)}
      </span>
      <button
        class="chat-history__item-delete"
        aria-label="Удалить чат «${escapeHtml(session.title)}»"
        title="Удалить"
      >✕</button>
    `;

    // Клик по элементу — активировать сессию
    li.addEventListener('click', () => activateSession(session.id));

    // Клик по кнопке удаления
    li.querySelector('.chat-history__item-delete')
      .addEventListener('click', (e) => deleteSession(session.id, e));

    list.appendChild(li);
  });
}

/**
 * Рендерит все сообщения текущей сессии.
 * Если сообщений нет — показывает приветственный экран.
 */
function renderMessages() {
  const list = DOM.messagesList;
  const welcome = DOM.welcomeScreen;

  // Очищаем список
  list.innerHTML = '';

  if (state.currentMessages.length === 0) {
    // Нет сообщений — показываем приветствие
    welcome.style.display = 'flex';
    return;
  }

  // Есть сообщения — скрываем приветствие
  welcome.style.display = 'none';

  // Рендерим каждое сообщение
  state.currentMessages.forEach(msg => {
    const element = createMessageElement(msg.role, msg.content, msg.timestamp);
    list.appendChild(element);
  });

  // Прокручиваем вниз
  scrollToBottom();
}

/**
 * Создаёт DOM-элемент пузырька сообщения.
 *
 * @param {string} role - 'user' или 'assistant'
 * @param {string} content - Текст сообщения
 * @param {string} [timestamp] - ISO-строка времени (опционально)
 * @returns {HTMLElement} Элемент сообщения
 */
function createMessageElement(role, content, timestamp) {
  const isUser = role === 'user';

  // Внешняя обёртка
  const wrapper = document.createElement('div');
  wrapper.className = `message message--${isUser ? 'user' : 'bot'}`;
  wrapper.setAttribute('role', 'listitem');

  // Форматируем время
  const timeStr = timestamp
    ? formatTime(new Date(timestamp))
    : formatTime(new Date());

  // Текст сообщения: для бота применяем Markdown, для пользователя — просто текст
  const contentHtml = isUser
    ? escapeHtml(content)
    : parseMarkdown(content);

  wrapper.innerHTML = `
    <div class="message__avatar" aria-hidden="true">
      ${isUser ? '👤' : '₸'}
    </div>
    <div class="message__body">
      <div class="message__bubble">
        <div class="message__content">${contentHtml}</div>
      </div>
      <span class="message__time" aria-label="Время отправки: ${timeStr}">${timeStr}</span>
    </div>
  `;

  return wrapper;
}

/**
 * Добавляет одно сообщение в список (без полного ре-рендера).
 * Используется для живого добавления при отправке/получении.
 *
 * @param {string} role - 'user' или 'assistant'
 * @param {string} content - Текст сообщения
 * @param {string} [timestamp] - ISO-строка времени
 * @returns {HTMLElement} Добавленный элемент
 */
function appendMessage(role, content, timestamp) {
  // Скрываем приветственный экран
  DOM.welcomeScreen.style.display = 'none';

  const element = createMessageElement(role, content, timestamp);
  DOM.messagesList.appendChild(element);
  scrollToBottom();
  return element;
}

/**
 * Создаёт и добавляет индикатор печатания бота (три прыгающие точки).
 *
 * @returns {HTMLElement} Элемент индикатора (для последующего удаления)
 */
function appendTypingIndicator() {
  const wrapper = document.createElement('div');
  wrapper.className = 'message message--bot';
  wrapper.id = 'typingIndicator';
  wrapper.setAttribute('aria-label', 'АкчаБот печатает ответ...');

  wrapper.innerHTML = `
    <div class="message__avatar" aria-hidden="true">₸</div>
    <div class="message__body">
      <div class="message__bubble">
        <div class="typing-indicator" aria-hidden="true">
          <div class="typing-indicator__dot"></div>
          <div class="typing-indicator__dot"></div>
          <div class="typing-indicator__dot"></div>
        </div>
      </div>
    </div>
  `;

  DOM.welcomeScreen.style.display = 'none';
  DOM.messagesList.appendChild(wrapper);
  scrollToBottom();
  return wrapper;
}

/**
 * Удаляет индикатор печатания.
 */
function removeTypingIndicator() {
  const indicator = document.getElementById('typingIndicator');
  if (indicator) indicator.remove();
}

/**
 * Прокручивает область сообщений вниз (к последнему сообщению).
 * Плавная анимация через 'smooth'.
 */
function scrollToBottom() {
  DOM.messagesArea.scrollTo({
    top: DOM.messagesArea.scrollHeight,
    behavior: 'smooth',
  });
}


/* ═══════════════════════════════════════════════
   7. ОТПРАВКА СООБЩЕНИЙ В GROQ API
   Основная логика взаимодействия с ИИ
═══════════════════════════════════════════════ */

/**
 * Главная функция отправки сообщения.
 * Читает текст из поля ввода, добавляет в чат и отправляет в API.
 */
async function sendMessage() {
  // Не отправляем если уже идёт загрузка
  if (state.isLoading) return;

  // Получаем текст и убираем лишние пробелы
  const text = DOM.messageInput.value.trim();

  // Пустое сообщение — игнорируем
  if (!text) return;

  // Скрываем ошибку если была
  hideError();

  // Очищаем поле ввода и сбрасываем его высоту
  DOM.messageInput.value = '';
  autoResizeInput();
  DOM.sendBtn.disabled = true;

  // Если нет текущей сессии — создаём новую
  if (!state.currentSessionId) {
    createNewSession();
  }

  // Временная метка сообщения
  const timestamp = new Date().toISOString();

  // Объект сообщения пользователя
  const userMessage = {
    role: 'user',
    content: text,
    timestamp,
  };

  // Добавляем сообщение в состояние
  state.currentMessages.push(userMessage);

  // Если это первое сообщение — задаём название сессии
  const session = findSession(state.currentSessionId);
  if (session && session.messages.length === 0) {
    updateSession(state.currentSessionId, {
      title: generateSessionTitle(text),
      updatedAt: timestamp,
    });
    renderChatHistory();
  }

  // Добавляем сообщение в DOM
  appendMessage('user', text, timestamp);

  // Начинаем загрузку
  setLoading(true);

  // Показываем индикатор печатания
  appendTypingIndicator();

  try {
    // Отправляем запрос к Groq API
    const botReply = await callGroqApi(state.currentMessages);

    // Удаляем индикатор печатания
    removeTypingIndicator();

    // Временная метка ответа
    const replyTimestamp = new Date().toISOString();

    // Объект сообщения бота
    const botMessage = {
      role: 'assistant',
      content: botReply,
      timestamp: replyTimestamp,
    };

    // Добавляем ответ в состояние
    state.currentMessages.push(botMessage);

    // Сохраняем все сообщения в сессию
    updateSession(state.currentSessionId, {
      messages: state.currentMessages,
      updatedAt: replyTimestamp,
    });

    // Добавляем ответ бота в DOM
    appendMessage('assistant', botReply, replyTimestamp);

    // Обновляем список истории (обновилась дата)
    renderChatHistory();

  } catch (error) {
    // Что-то пошло не так — убираем индикатор и показываем ошибку
    removeTypingIndicator();
    handleApiError(error);
  } finally {
    // В любом случае выключаем состояние загрузки
    setLoading(false);
  }
}

/**
 * Выполняет запрос к Groq API.
 * Формирует тело запроса с историей диалога и системным промтом.
 *
 * @param {Array} messages - Массив сообщений истории
 * @returns {Promise<string>} Текст ответа от ИИ
 * @throws {Error} При ошибке сети или API
 */
async function callGroqApi(messages) {
  // Формируем массив сообщений для API:
  // Системный промт идёт первым, затем история диалога.
  // Ограничиваем историю последними 20 сообщениями — экономим токены.
  const recentMessages = messages.slice(-20);

  const apiMessages = [
    // Системный промт с инструкцией для ИИ
    {
      role: 'system',
      content: SYSTEM_PROMPT,
    },
    // История диалога (только role и content — без timestamp)
    ...recentMessages.map(msg => ({
      role: msg.role,
      content: msg.content,
    })),
  ];

  // Тело запроса к Groq API
  const requestBody = {
    model: CONFIG.model,
    messages: apiMessages,
    max_tokens: CONFIG.maxTokens,
    temperature: CONFIG.temperature,
    // Отключаем потоковую передачу для простоты
    stream: false,
  };

  // Выполняем HTTP-запрос
  const response = await fetch(CONFIG.apiUrl, {
    method: 'POST',
    headers: {
      // Авторизация через Bearer-токен
      'Authorization': `Bearer ${CONFIG.apiKey}`,
      // Тип контента — JSON
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  // Если сервер вернул ошибку — обрабатываем её
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(response.status, errorData);
  }

  // Парсим ответ
  const data = await response.json();

  // Извлекаем текст из ответа API
  // Структура: data.choices[0].message.content
  const content = data?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('API вернул пустой ответ');
  }

  return content;
}

/**
 * Кастомный класс ошибки для Groq API.
 * Хранит HTTP-статус и детали ошибки.
 */
class ApiError extends Error {
  /**
   * @param {number} status - HTTP-статус код
   * @param {Object} data - Тело ответа с ошибкой
   */
  constructor(status, data) {
    super(`API Error ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Обрабатывает ошибки API и показывает понятные сообщения на русском.
 *
 * @param {Error|ApiError} error - Объект ошибки
 */
function handleApiError(error) {
  console.error('АкчаБот: Ошибка API:', error);

  let userMessage = 'Что-то пошло не так. Попробуй ещё раз.';

  if (error instanceof ApiError) {
    // Ошибки HTTP-статусов
    switch (error.status) {
      case 400:
        userMessage = 'Некорректный запрос. Попробуй переформулировать вопрос.';
        break;
      case 401:
        userMessage = 'Ошибка авторизации API. Обратитесь к администратору.';
        break;
      case 403:
        userMessage = 'Доступ к API запрещён. Проверь настройки.';
        break;
      case 429:
        userMessage = 'Слишком много запросов. Подожди несколько секунд и попробуй снова.';
        break;
      case 500:
      case 502:
      case 503:
        userMessage = 'Сервер Groq временно недоступен. Попробуй позже.';
        break;
      default:
        userMessage = `Ошибка сервера (код ${error.status}). Попробуй позже.`;
    }
  } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
    // Ошибка сети (нет интернета, CORS и т.д.)
    userMessage = 'Нет подключения к интернету. Проверь соединение и попробуй снова.';
  } else if (error.name === 'AbortError') {
    // Запрос был отменён
    userMessage = 'Запрос был прерван. Попробуй снова.';
  }

  showError(userMessage);
}


/* ═══════════════════════════════════════════════
   8. ОБРАБОТКА MARKDOWN В ОТВЕТАХ БОТА
   Простой парсер для форматирования текста
═══════════════════════════════════════════════ */

/**
 * Конвертирует Markdown-разметку в HTML.
 * Поддерживает: заголовки, жирный текст, курсив,
 * блоки кода, инлайн-код, списки, горизонтальные линии.
 *
 * @param {string} text - Текст с Markdown-разметкой
 * @returns {string} HTML-строка
 */
function parseMarkdown(text) {
  // Сначала экранируем HTML-теги для безопасности
  let html = escapeHtml(text);

  // --- Блоки кода (```код```) ---
  // Должны обрабатываться ДО инлайн-кода
  html = html.replace(/```([^`]*?)```/gs, (_, code) => {
    return `<pre><code>${code.trim()}</code></pre>`;
  });

  // --- Инлайн-код (`код`) ---
  html = html.replace(/`([^`]+?)`/g, '<code>$1</code>');

  // --- Заголовки (### ## #) ---
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // --- Жирный текст (**текст** или __текст__) ---
  html = html.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+?)__/g, '<strong>$1</strong>');

  // --- Курсив (*текст* или _текст_) ---
  html = html.replace(/\*([^*]+?)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_]+?)_/g, '<em>$1</em>');

  // --- Горизонтальная линия (---) ---
  html = html.replace(/^---+$/gm, '<hr>');

  // --- Ненумерованные списки (- пункт или * пункт) ---
  html = html.replace(/^[*-] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, match => `<ul>${match}</ul>`);

  // --- Нумерованные списки (1. пункт) ---
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // --- Параграфы (двойной перенос строки) ---
  // Разбиваем на блоки и оборачиваем в <p> если это не HTML-блок
  const blocks = html.split(/\n\n+/);
  html = blocks.map(block => {
    const trimmed = block.trim();
    if (!trimmed) return '';

    // Не оборачиваем если уже является HTML-блоком
    const isBlock = /^<(h[1-3]|ul|ol|pre|hr|li)/.test(trimmed);
    if (isBlock) return trimmed;

    // Заменяем одиночные переносы строк на <br>
    const withBreaks = trimmed.replace(/\n/g, '<br>');
    return `<p>${withBreaks}</p>`;
  }).join('\n');

  return html;
}

/**
 * Экранирует HTML-специальные символы для защиты от XSS.
 *
 * @param {string} str - Входная строка
 * @returns {string} Безопасная строка
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


/* ═══════════════════════════════════════════════
   9. UI-УТИЛИТЫ
   Вспомогательные функции интерфейса
═══════════════════════════════════════════════ */

/**
 * Устанавливает состояние загрузки (блокирует ввод, меняет статус).
 *
 * @param {boolean} isLoading - true = загрузка, false = готов
 */
function setLoading(isLoading) {
  state.isLoading = isLoading;

  // Кнопка отправки
  DOM.sendBtn.disabled = isLoading;
  DOM.sendBtn.classList.toggle('send-btn--loading', isLoading);

  // Поле ввода
  DOM.messageInput.disabled = isLoading;

  // Точка статуса и надпись
  DOM.statusDot.classList.toggle('status-dot--loading', isLoading);
  DOM.statusLabel.textContent = isLoading
    ? 'АкчаБот думает...'
    : 'ИИ готов к работе';
}

/**
 * Показывает баннер ошибки с текстом.
 *
 * @param {string} message - Текст ошибки
 */
function showError(message) {
  DOM.errorText.textContent = message;
  DOM.errorBanner.hidden = false;
  // Прокручиваем вниз чтобы ошибка была видна
  scrollToBottom();
}

/**
 * Скрывает баннер ошибки.
 */
function hideError() {
  DOM.errorBanner.hidden = true;
}

/**
 * Показывает всплывающее toast-уведомление.
 *
 * @param {string} message - Текст уведомления
 * @param {'default'|'success'|'error'} type - Тип уведомления
 * @param {number} duration - Длительность в мс (по умолчанию 3000)
 */
function showToast(message, type = 'default', duration = 3000) {
  const toast = DOM.toast;

  // Убираем предыдущие классы типов
  toast.classList.remove('toast--visible', 'toast--success', 'toast--error');

  // Устанавливаем текст и тип
  toast.textContent = message;
  if (type !== 'default') {
    toast.classList.add(`toast--${type}`);
  }

  // Небольшая задержка для анимации (reflow trick)
  requestAnimationFrame(() => {
    toast.classList.add('toast--visible');
  });

  // Автоматически скрываем через `duration` мс
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toast.classList.remove('toast--visible');
  }, duration);
}

/**
 * Автоматически изменяет высоту поля ввода по контенту.
 * Минимум — 1 строка, максимум — CONFIG.inputMaxHeight.
 */
function autoResizeInput() {
  const input = DOM.messageInput;
  // Сбрасываем высоту до минимума чтобы scrollHeight рассчитался корректно
  input.style.height = 'auto';
  // Устанавливаем новую высоту по содержимому
  const newHeight = Math.min(input.scrollHeight, parseInt(getComputedStyle(document.documentElement).getPropertyValue('--input-max-height')));
  input.style.height = newHeight + 'px';
}

/**
 * Обновляет состояние кнопки отправки (активна/не активна).
 * Активна только если есть текст и не идёт загрузка.
 */
function updateSendButton() {
  const hasText = DOM.messageInput.value.trim().length > 0;
  DOM.sendBtn.disabled = !hasText || state.isLoading;
}

/**
 * Форматирует Date в строку времени "ЧЧ:ММ".
 *
 * @param {Date} date - Объект даты
 * @returns {string} Строка вида "14:35"
 */
function formatTime(date) {
  return date.toLocaleTimeString('ru-KG', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Форматирует дату в относительное время ("Только что", "5 мин назад" и т.д.).
 *
 * @param {Date} date - Объект даты
 * @returns {string} Относительное описание времени
 */
function formatRelativeTime(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return 'Только что';
  if (diffMin < 60) return `${diffMin} мин назад`;
  if (diffHour < 24) return `${diffHour} ч назад`;
  if (diffDay < 7) return `${diffDay} дн назад`;

  // Для старых дат показываем полную дату
  return date.toLocaleDateString('ru-KG', {
    day: 'numeric',
    month: 'short',
  });
}


/* ═══════════════════════════════════════════════
   УПРАВЛЕНИЕ САЙДБАРОМ (мобайл)
═══════════════════════════════════════════════ */

/**
 * Открывает сайдбар на мобильных устройствах.
 */
function openSidebar() {
  DOM.sidebar.classList.add('sidebar--open');
  DOM.sidebarOverlay.classList.add('sidebar-overlay--visible');
  DOM.sidebarOverlay.style.display = 'block';
  DOM.hamburgerBtn.setAttribute('aria-expanded', 'true');
  // Блокируем прокрутку body
  document.body.style.overflow = 'hidden';
}

/**
 * Закрывает сайдбар на мобильных устройствах.
 */
function closeSidebar() {
  DOM.sidebar.classList.remove('sidebar--open');
  DOM.sidebarOverlay.classList.remove('sidebar-overlay--visible');
  DOM.hamburgerBtn.setAttribute('aria-expanded', 'false');
  // Восстанавливаем прокрутку body
  document.body.style.overflow = '';

  // Убираем display:block после анимации
  setTimeout(() => {
    if (!DOM.sidebar.classList.contains('sidebar--open')) {
      DOM.sidebarOverlay.style.display = '';
    }
  }, 300);
}


/* ═══════════════════════════════════════════════
   10. ОБРАБОТЧИКИ СОБЫТИЙ (Event Listeners)
   Все взаимодействия пользователя с интерфейсом
═══════════════════════════════════════════════ */

/**
 * Инициализирует все обработчики событий.
 * Вызывается один раз при загрузке приложения.
 */
function initEventListeners() {

  // --- Кнопка «Новый чат» ---
  DOM.newChatBtn.addEventListener('click', () => {
    createNewSession();
    // На мобайл закрываем сайдбар
    if (window.innerWidth <= 768) closeSidebar();
  });

  // --- Кнопка очистки текущего чата ---
  DOM.clearBtn.addEventListener('click', () => {
    clearCurrentChat();
  });

  // --- Кнопка отправки ---
  DOM.sendBtn.addEventListener('click', sendMessage);

  // --- Поле ввода: отправка по Enter (без Shift) ---
  DOM.messageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault(); // Не добавляем перенос строки
      sendMessage();
    }
  });

  // --- Поле ввода: авто-resize и обновление кнопки ---
  DOM.messageInput.addEventListener('input', () => {
    autoResizeInput();
    updateSendButton();
  });

  // --- Поле ввода: фокус — активируем (для мобайл) ---
  DOM.messageInput.addEventListener('focus', () => {
    // Небольшая задержка чтобы клавиатура успела открыться
    setTimeout(scrollToBottom, 300);
  });

  // --- Кнопки быстрых подсказок ---
  // Используем делегирование событий
  DOM.welcomeScreen.addEventListener('click', (event) => {
    const btn = event.target.closest('.quick-prompt-btn');
    if (!btn) return;

    const prompt = btn.dataset.prompt;
    if (!prompt) return;

    // Вставляем текст в поле ввода
    DOM.messageInput.value = prompt;
    autoResizeInput();
    updateSendButton();

    // Фокусируемся на поле ввода
    DOM.messageInput.focus();

    // Небольшая пауза для UX-эффекта, затем отправляем
    setTimeout(sendMessage, 100);
  });

  // --- Кнопка закрытия ошибки ---
  DOM.errorCloseBtn.addEventListener('click', hideError);

  // --- Мобайл: гамбургер-кнопка (открыть сайдбар) ---
  DOM.hamburgerBtn.addEventListener('click', openSidebar);

  // --- Мобайл: кнопка закрытия сайдбара ---
  DOM.sidebarCloseBtn.addEventListener('click', closeSidebar);

  // --- Мобайл: клик по оверлею закрывает сайдбар ---
  DOM.sidebarOverlay.addEventListener('click', closeSidebar);

  // --- Закрытие сайдбара по Escape ---
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && DOM.sidebar.classList.contains('sidebar--open')) {
      closeSidebar();
    }
  });

  // --- Адаптивность: при изменении размера окна ---
  window.addEventListener('resize', () => {
    // Если экран стал большим — убираем классы мобайл-сайдбара
    if (window.innerWidth > 768) {
      DOM.sidebar.classList.remove('sidebar--open');
      DOM.sidebarOverlay.classList.remove('sidebar-overlay--visible');
      DOM.sidebarOverlay.style.display = '';
      document.body.style.overflow = '';
    }
  });
}


/* ═══════════════════════════════════════════════
   11. ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
   Точка входа — запускается после загрузки DOM
═══════════════════════════════════════════════ */

/**
 * Инициализирует приложение:
 * 1. Загружает историю из localStorage
 * 2. Восстанавливает последнюю сессию или создаёт новую
 * 3. Рендерит интерфейс
 * 4. Подключает обработчики событий
 */
function initApp() {
  console.log('АкчаБот: Инициализация...');

  // 1. Загружаем сохранённые сессии
  state.sessions = loadSessions();
  console.log(`АкчаБот: Загружено ${state.sessions.length} сессий из истории`);

  // 2. Подключаем обработчики событий
  initEventListeners();

  // 3. Рендерим список истории
  renderChatHistory();

  // 4. Восстанавливаем или создаём сессию
  if (state.sessions.length > 0) {
    // Активируем последнюю сессию
    const lastSession = state.sessions[state.sessions.length - 1];
    activateSession(lastSession.id);
    console.log(`АкчаБот: Восстановлена сессия «${lastSession.title}»`);
  } else {
    // Создаём новую сессию
    createNewSession();
    console.log('АкчаБот: Создана новая сессия');
  }

  // 5. Устанавливаем фокус на поле ввода (только на десктопе)
  if (window.innerWidth > 768) {
    DOM.messageInput.focus();
  }

  console.log('АкчаБот: Готов к работе ✓');
}

// ─────────────────────────────────────────────
// ЗАПУСК ПРИЛОЖЕНИЯ
// Ждём полной загрузки DOM перед инициализацией
// ─────────────────────────────────────────────
if (document.readyState === 'loading') {
  // DOM ещё не готов — ждём события
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  // DOM уже загружен (скрипт подключён в конце body)
  initApp();
}
