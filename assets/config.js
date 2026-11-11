/* Настройки сайта — меняются здесь, в одном месте.
   FORM_ENDPOINT — функция в Яндекс Облаке: сохраняет заявку в хранилище в России и присылает её в телеграм.
   Токен бота хранится только в настройках функции, на сайте его нет.
   Если функция недоступна, форма откроет готовое письмо на EMAIL. */
window.SITE_CONFIG = {
  FORM_ENDPOINT: 'https://functions.yandexcloud.net/d4ek9tmkm4q0mug12708',
  EMAIL: 'sonyagranina.work@gmail.com'
};
