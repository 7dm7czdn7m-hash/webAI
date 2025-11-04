# Tutor Heavy

Production-сборка «Tutor Heavy» — веб-приложение на Next.js 14 App Router, которое объединяет несколько reasoning-моделей (Gemini 2.5 Flash, DeepSeek R1, Qwen3 Max и опционально Grok/OpenRouter), запускает их параллельно и выбирает итоговый ответ через верификацию math.js.

## Возможности

- Ввод текста и изображений с OCR на базе `tesseract.js`.
- До пяти параллельных прогонов моделей с разными температурами и seed.
- Проверка ответов: числовая валидация (`math.js`), анализ единиц СИ, сигналы уверенности.
- Арбитр с консенсусом 2/3 либо выбором лучшего score.
- История запусков в IndexedDB.
- Гибкое подключение облачных провайдеров через `/api/llm` (Cloudflare Workers).

## Запуск

```bash
npm install
npm run dev
```

## Тесты

```bash
npm test
```

## Деплой

Проект рассчитан на Cloudflare Pages + Workers. Укажите домен в `PUBLIC_APP_URL` и добавьте ключи API в настройках Pages.

### Переменные окружения

Скопируйте `.env.example` и задайте ключи:

```
DEEPSEEK_API_KEY=...
QWEN_API_KEY=...
GOOGLE_API_KEY=...
OPENROUTER_API_KEY=...
XAI_API_KEY=...
PUBLIC_APP_URL=https://<домен>
```

Без ключей выполняются только прогон Gemini (если ключ указан) и доступные провайдеры; для полностью облачного режима убедитесь, что заданы хотя бы три источника.
