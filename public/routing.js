(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MestoRouting = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const hosts = {
    yandex: ['yandex.ru','yandex.com','yandex.by','yandex.kz','yandex.uz','ya.ru'],
    gis: ['2gis.ru','2gis.com','2gis.kz','2gis.kg','2gis.uz']
  };
  function validPlatform(value, platform) {
    if (!value) return true;
    try { const url = new URL(value); return !!hosts[platform] && url.protocol === 'https:' && !url.username && !url.password && !url.port && hosts[platform].some(host => url.hostname === host || url.hostname.endsWith('.' + host)); } catch { return false; }
  }
  function telegramUsername(value) {
    if (typeof value !== 'string') return '';
    let username = value.trim();
    if (/^https:\/\//i.test(username)) {
      try { const url = new URL(username); if (!['t.me','telegram.me'].includes(url.hostname) || url.username || url.password || url.port || url.search || url.hash) return ''; username = url.pathname.replace(/^\/|\/$/g,''); } catch { return ''; }
    }
    username = username.replace(/^@/,'');
    return /^[a-z][a-z0-9_]{4,31}$/i.test(username) && !['share','proxy','login','socks','joinchat','contact','addstickers','addemoji','setlanguage','boost','invoice','confirmphone','addlist','addtheme','addstyle','giftcode','resolve','addbot','addattachment'].includes(username.toLowerCase()) ? username : '';
  }
  function destination(rating, config) {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return {error:'Выберите оценку от 1 до 5.'};
    const route = Object.hasOwn(config,'route' + rating) ? config['route' + rating] : (rating <= 3 ? (config.platform === 'yandex' ? 'yandex' : 'gis') : 'telegram');
    if (route === 'gis' || route === 'yandex') {
      const platform = route;
      const label = platform === 'yandex' ? 'Яндекс Карты' : '2ГИС';
      const value = config[platform];
      if (!value || !validPlatform(value, platform)) return {error:'Переход пока недоступен. Добавьте ссылку на ' + label + ' в настройках.'};
      return {url:new URL(value).href,label};
    }
    if (route !== 'telegram') return {error:'Для этой звезды указано неизвестное направление. Проверьте настройки.'};
    return {kind:'telegram',label:'Сообщение владельцу'};
  }
  return {validPlatform,telegramUsername,destination};
});
