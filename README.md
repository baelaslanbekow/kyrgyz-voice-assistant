# Марлис — Kyrgyz Voice Assistant

Голосовой AI-ассистент на кыргызском языке. Пользователь говорит в микрофон — приложение распознаёт речь, отвечает через LLM и сохраняет контекст диалога.

[![Live Demo](https://img.shields.io/badge/Demo-Render-22C55E)](https://marlis-voice-assistant.onrender.com)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/baelaslanbekow/kyrgyz-voice-assistant)
![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![Groq](https://img.shields.io/badge/Groq-Whisper%20%2B%20Llama-f37021)
![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-ready-5A0FC8?logo=pwa&logoColor=white)

<p align="center">
  <img src="frontend/logo.png" alt="Марлис" width="120">
</p>

**Live:** [marlis-voice-assistant.onrender.com](https://marlis-voice-assistant.onrender.com) · **Профиль:** [github.com/baelaslanbekow](https://github.com/baelaslanbekow)

## О проекте

**Марлис** — full-stack pet-проект: веб-приложение с голосовым вводом для кыргызского языка.

**Задача:** общение с AI на кыргызском голосом, без клавиатуры.

**Решение:** Whisper (STT) + Llama 3.3 (чат) через Groq API, FastAPI backend, PWA frontend.

## Возможности

- Голосовой ввод через браузер (MediaRecorder API)
- Транскрипция кыргызской речи (Whisper Large V3, `language=ky`)
- Ответы AI с учётом последних 5 сообщений
- История диалогов в SQLite
- Дневной лимит запросов (70/день)
- Тёмная / светлая тема
- PWA + Service Worker
- Адаптивный UI (mobile-first)
- Docker + деплой на Render

## Стек

| Слой | Технологии |
|------|------------|
| Backend | FastAPI, SQLAlchemy 2, Groq SDK, SQLite |
| Frontend | Vanilla JS, Canvas API, GSAP, CSS |
| AI | Groq Whisper Large V3, Llama 3.3 70B |
| Инфра | Docker, Render, Uvicorn |

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

## Деплой на Render (1 клик)

1. Нажми кнопку **Deploy to Render** выше
2. Подключи GitHub-аккаунт
3. Добавь переменную `GROQ_API_KEY` в Environment
4. Нажми **Apply** — сервис поднимется автоматически

Или вручную:

```bash
git clone https://github.com/baelaslanbekow/kyrgyz-voice-assistant.git
cd kyrgyz-voice-assistant
docker build -t marlis .
docker run -p 8000:8000 -e GROQ_API_KEY=your_key marlis
```

## Локальный запуск

```bash
git clone https://github.com/baelaslanbekow/kyrgyz-voice-assistant.git
cd kyrgyz-voice-assistant/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # добавь GROQ_API_KEY
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Ключ Groq: [console.groq.com](https://console.groq.com)

## API

| Метод | Endpoint | Описание |
|-------|----------|----------|
| `POST` | `/transcribe` | Аудио → текст (multipart `audio`) |
| `POST` | `/chat?query=...` | Запрос к AI с контекстом |
| `GET` | `/history` | Последние 10 диалогов |
| `POST` | `/clear_history` | Очистить историю |
| `POST` | `/synthesize?text=...` | TTS stub |

## Структура

```
kyrgyz-voice-assistant/
├── backend/          # FastAPI + SQLite
├── frontend/         # PWA UI
├── Dockerfile
├── render.yaml       # Render Blueprint
└── README.md
```

## Для резюме

```
Марлис — Kyrgyz Voice Assistant
Голосовой AI на кыргызском (Whisper + Llama 3.3, FastAPI, PWA, Docker)
https://github.com/baelaslanbekow/kyrgyz-voice-assistant
https://marlis-voice-assistant.onrender.com
```

## Roadmap

- [ ] Kani TTS для озвучки ответов
- [ ] Авторизация пользователей
- [x] Docker
- [x] Деплой на Render

## Автор

**Bael Aslanbekow** — [GitHub Profile](https://github.com/baelaslanbekow)