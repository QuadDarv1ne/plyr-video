# TODO — Российские видеохостинги

## Rutube (Приоритет: Высокий)
- [ ] Создать `src/js/plugins/rutube.js` — провайдер с postMessage API
- [ ] Обновить `src/js/config/types.js` — добавить `rutube` и URL regex
- [ ] Обновить `src/js/config/defaults.js` — настройки rutube + URL
- [ ] Обновить `src/js/media.js` — добавить ветку `this.isRutube`
- [ ] Обновить `src/js/plyr.js` — геттер `isRutube`, destroy, source
- [ ] Тестирование с реальными Rutube видео
- [ ] Поддержка качества (1080/720/480/360/240/144)
- [ ] Поддержка субтитров
- [ ] Поддержка скорости воспроизведения

## Yandex Cloud Video (Приоритет: Средний)
- [ ] Получить полную документацию по iframe SDK
- [ ] Создать `src/js/plugins/yandex-video.js`
- [ ] Зарегистрировать в types.js, defaults.js, media.js, plyr.js
- [ ] Протестировать с реальным видео из Yandex Cloud

## VK Video (Приоритет: По возможности)
- [ ] Найти/получить документацию по VK Video iframe API
- [ ] Создать `src/js/plugins/vk-video.js`
- [ ] Зарегистрировать в конфигурации
- [ ] Протестировать

## Другие российские хостинги (Приоритет: Низкий)
- [ ] Mail.ru Video — исследовать API
- [ ] Coub — исследовать API
- [ ] SMOTRESHKA, PEPER.TV и др. — по запросу
