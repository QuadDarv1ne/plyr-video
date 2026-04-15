# TODO — Российские видеохостинги

## Улучшения качества кода
- [x] Добавить try/catch в postMessage обработчики всех провайдеров
- [ ] Улучшить обработку ошибок сети (fetch) при загрузке метаданных
  - VK: `getTitle()` использует недокументированный endpoint `vk.ru/al_video.php` — может сломаться
  - Mail.ru: `getTitle()` — заглушка, не реализовано
  - Все fetch-запросы без таймаутов и retry-логики
- [x] Добавить валидацию videoId перед созданием iframe
- [ ] Унифицировать формат postMessage команд между всеми провайдерами
  - Rutube/Yandex: `{ type, data }` → `player:play`
  - VK: `{ method, params }` → `{method:'play'}`
  - Mail.ru: сырая строка `'play'`
  - Невозможно переиспользовать логику обработки сообщений
- [ ] Добавить таймаут инициализации (fallback если плеер не отвечает)
  - Ни у одного провайдера нет timeout на first message от iframe
- [x] Убрать неиспользуемые импорты (loadImage, format в rutube.js)
- [ ] Покрыть провайдеры unit-тестами
  - Тестов нет вообще (.test/.spec файлы отсутствуют)
  - Приоритет: rutube > yandex > vk > mailru

## Rutube (Приоритет: Высокий) ✅
- [x] Создать `src/js/plugins/rutube.js` — провайдер с postMessage API
- [x] Обновить `src/js/config/types.js` — добавить `rutube` и URL regex
- [x] Обновить `src/js/config/defaults.js` — настройки rutube + URL
- [x] Обновить `src/js/media.js` — добавить ветку `this.isRutube`
- [x] Обновить `src/js/plyr.js` — геттер `isRutube`, destroy, source
- [x] Поддержка качества (1080/720/480/360/240/144)
- [x] Поддержка субтитров
- [x] Поддержка скорости воспроизведения
- [ ] Тестирование с реальными Rutube видео
  - В demo используется placeholder ID `1e5c8c87e8d0d8d8e8d0d8d8e8d0d8d8`
- [x] Добавлен в demo страницу
- [!] Origin validation: `event.origin.includes('rutube.ru')` — слишком слабая проверка, может совпасть с `not-rutube.ru.fake.com`

## Yandex Cloud Video (Приоритет: Средний) ✅
- [x] Получить полную документацию по iframe SDK
- [x] Создать `src/js/plugins/yandex-video.js`
- [x] Зарегистрировать в types.js, defaults.js, media.js, plyr.js
- [x] Добавлен в demo страницу
- [ ] Протестировать с реальным видео из Yandex Cloud
  - В demo используется placeholder `your-video-id`
- [!] Та же слабая origin validation, что и у Rutube

## VK Video (Приоритет: По возможности) ✅
- [x] Найти/получить документацию по VK Video iframe API
- [x] Создать `src/js/plugins/vk-video.js`
- [x] Зарегистрировать в конфигурации
- [x] Добавлен в demo страницу
- [ ] Протестировать
- [!] `playbackRate` getter/setter — заглушка, API не поддерживает
- [!] Captions не поддерживаются
- [!] `getTitle()` — недокументированный endpoint, может сломаться

## Mail.ru Video (Приоритет: Низкий)
- [x] Mail.ru Video — провайдер создан, базовая поддержка
  - API недокументирован, реализован методом обратной инженерии
  - `handleStringEvent()` использует naive string matching — `data.includes('play')` может сработать на `display`
  - Нет поддержки quality, captions, speed
  - `getTitle()` — заглушка
- [x] Coub — платформа закрыта (2024), не поддерживается
- [ ] SMOTRESHKA, PEPER.TV и др. — по запросу

## Технические заметки
- Дублирование кода между 4 новыми провайдерами (rutube, yandex, vk, mailru):
  - `assurePlaybackState()`, `parseId()`, iframe creation, property definition, message handler
  - Стоит вынести в shared base/factory
- Все новые провайдеры используют одинаковый паттерн destroy() — удаление window message listener
- Нет тестового покрытия ни для одного провайдера
- Build: gulp build (ESM, Rollup, Babel), lint: eslint + stylelint + remark
