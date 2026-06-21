# Марлис — Kyrgyz Voice Assistant

Голосовой AI-ассистент на кыргызском языке. Пользователь говорит в микрофон — приложение распознаёт речь, отвечает через LLM и сохраняет контекст диалога.

![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![Groq](https://img.shields.io/badge/Groq-Whisper%20%2B%20Llama-f37021)
![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-ready-5A0FC8?logo=pwa&logoColor=white)

<p align="center">
  <img src="frontend/logo.png" alt="Марлис" width="120">
</p>

## О проекте

**Марлис** — full-stack pet-проект: веб-приложение с голосовым вводом для кыргызского языка. Сделан как рабочий MVP с продуманным UI, лимитами использования и историей диалогов.

**Задача:** дать пользователю возможность общаться с AI на кыргызском голосом, без клавиатуры.

**Решение:** Whisper (STT) + Llama 3.3 (чат) через Groq API, свой backend на FastAPI и PWA-фронтенд.

## Возможности

- Голосовой ввод через браузер (MediaRecorder API)
- Транскрипция кыргызской речи (Whisper Large V3, `language=ky`)
- Ответы AI с учётом последних 5 сообщений
- История диалогов в SQLite
- Дневной лимит запросов (70/день)
- Тёмная / светлая тема
- PWA + Service Worker для офлайн-кэша статики
- Адаптивный UI (mobile-first)

## Стек

| Слой | Технологии |
|------|------------|
| Backend | FastAPI, SQLAlchemy 2, Groq SDK, SQLite |
| Frontend | Vanilla JS, Canvas API, GSAP, CSS |
| AI | Groq Whisper Large V3, Llama 3.3 70B |
| Инфра | Uvicorn, PWA |

## Архитектура

```mermaid
flowchart LR
    A[Браузер / PWA] -->|audio/webm| B[/transcribe]
    B --> C[Groq Whisper]
    C -->|текст| D[/chat]
    D --> E[Groq Llama 3.3]
    D --> F[(SQLite)]
    E -->|ответ| A
    A -->|GET| G[/history]
```

## Быстрый старт

### 1. Клонировать репозиторий

```bash
git clone https://github.com/baelaslanbekow/kyrgyz-voice-assistant.git
cd kyrgyz-voice-assistant
```

### 2. Настроить окружение

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

В `.env` указать ключ Groq:

```env
GROQ_API_KEY=your_key_here
```

Ключ: [console.groq.com](https://console.groq.com)

### 3. Запустить

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Открыть: [http://localhost:8000](http://localhost:8000)

## API

| Метод | Endpoint | Описание |
|-------|----------|----------|
| `POST` | `/transcribe` | Аудио → текст (multipart `audio`) |
| `POST` | `/chat?query=...` | Запрос к AI с контекстом |
| `GET` | `/history` | Последние 10 диалогов |
| `POST` | `/clear_history` | Очистить историю |
| `POST` | `/synthesize?text=...` | TTS stub (заглушка) |

## Структура проекта

```
kyrgyz-voice-assistant/
├── backend/
│   ├── main.py              # FastAPI, роуты, Groq
│   ├── database.py          # SQLAlchemy модели
│   ├── requirements.txt
│   └── kanitts/             # Kani TTS (интеграция TTS)
├── frontend/
│   ├── index.html
│   ├── app.js               # запись, визуализация, API
│   ├── style.css
│   ├── sw.js                # service worker
│   └── manifest.json
└── README.md
```

## Что показывает проект (для портфолио)

- Full-stack разработка: API + UI в одном репозитории
- Работа с внешними AI API (STT + LLM)
- Хранение состояния и контекста диалога в БД
- Ограничение rate limit на уровне backend
- PWA и нативный UX в браузере (запись, анимации, адаптив)
- Чистая структура без лишних зависимостей на фронте

## Roadmap

- [ ] Интеграция Kani TTS для озвучки ответов
- [ ] Авторизация пользователей
- [ ] Деплой (Railway / Render / VPS)
- [ ] Docker

## Автор

**Bael Aslanbekow** — [GitHub](https://github.com/baelaslanbekow)

---

*Pet-проект. Открыт для code review и предложений.*