(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const defaults = {name: 'Отзыв о посещении', address: '', yandex: '', gis: 'https://2gis.ru/khabarovsk/firm/70000001057348627', platform: 'gis', route1:'gis', route2:'gis', route3:'gis', route4:'telegram', route5:'telegram'};
  const params = new URLSearchParams(location.search);
  const hasGuestConfig = Object.keys(defaults).some(key => params.has(key));
  let stored = {};
  if (!hasGuestConfig) { try { stored = JSON.parse(localStorage.getItem('mesto.settings') || '{}'); } catch {} }
  let config = Object.fromEntries(Object.keys(defaults).map(key => [key, hasGuestConfig ? (params.has(key) ? params.get(key) : defaults[key]) : (typeof stored?.[key] === 'string' ? stored[key] : defaults[key])]));
  config.name = defaults.name; config.address = '';
  for (let i=1;i<=5;i++) {
    const key='route'+i;
    const explicit=hasGuestConfig ? params.has(key) : typeof stored?.[key] === 'string';
    if (!explicit) config[key]=i<=3 ? (config.platform==='yandex' ? 'yandex' : 'gis') : 'telegram';
  }
  let rating = 0;
  let sending=false,requestId='';
  function newRequestId(){return typeof globalThis.crypto?.randomUUID==='function'?globalThis.crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);}
  const descriptions = ['', 'Совсем не понравилось', 'Есть над чем поработать', 'В целом неплохо', 'Нам понравилось', 'Всё было замечательно!'];
  const {validPlatform, destination} = MestoRouting;
  const targetLabels={gis:'2ГИС',yandex:'Яндекс',telegram:'Сообщение владельцу'};
  function applyConfig() {
    document.title = 'Ваш отзыв — как всё прошло?';
    document.querySelectorAll('.star').forEach((star,i)=>{
      const label=targetLabels[config['route'+(i+1)]] || 'Не настроено';
      star.setAttribute('data-destination',label);
      star.setAttribute('aria-label',(i+1)+' из 5: '+descriptions[i+1]+'. Перейти: '+label);
    });
    let available=0;
    for (const platform of ['yandex','gis']) {
      const link=$('public-'+platform);
      const valid=!!config[platform] && validPlatform(config[platform],platform);
      link.hidden=!valid;
      if (valid) {link.href=config[platform];available++;} else link.removeAttribute('href');
    }
    $('public-reviews').hidden=!available;
  }
  function redirect(value) {
    if(sending)return;
    rating = value; paint(value);
    $('rating-description').textContent = descriptions[value];
    const result = destination(value, config);
    if(result.kind==='telegram'){
      $('telegram-feedback').hidden=false;
      $('feedback-rating').textContent='Ваша оценка: '+value+' из 5';
      $('feedback-status').textContent='';$('feedback-text').disabled=false;$('feedback-submit').disabled=false;
      $('route-status').hidden=true;requestId=newRequestId();$('feedback-text').focus();return;
    }
    $('telegram-feedback').hidden=true;
    $('route-status').hidden = false;
    $('route-status').textContent = result.error || ('Открываем ' + result.label + '…');
    if (!result.error) window.location.assign(result.url);
  }
  $('feedback-text').addEventListener('input',()=>{requestId=newRequestId();$('feedback-status').textContent='';});
  $('feedback-form').addEventListener('submit',async event=>{
    event.preventDefault();if(sending)return;
    const text=$('feedback-text').value.trim();
    if(!text){$('feedback-status').textContent='Напишите текст отзыва.';$('feedback-text').focus();return;}
    if(text.length>2000){$('feedback-status').textContent='Максимальная длина отзыва — 2000 символов.';return;}
    if(location.protocol==='file:'){$('feedback-status').textContent='Отправка из файла недоступна. Откройте размещённый сайт с подключённым ботом.';return;}
    sending=true;$('feedback-submit').disabled=true;$('feedback-text').disabled=true;
    document.querySelectorAll('.star').forEach(star=>star.disabled=true);
    $('feedback-status').textContent='Отправляем сообщение…';
    try{
      const response=await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rating,text,requestId:requestId||(requestId=newRequestId())}),signal:AbortSignal.timeout(18000)});
      let data;try{data=await response.json();}catch{throw Error('Сервер отправки недоступен. Сообщение не отправлено.');}
      if(!response.ok||data.ok!==true)throw Error(typeof data.error==='string'?data.error:'Сообщение не отправлено. Попробуйте позднее.');
      $('feedback-status').textContent='Спасибо! Ваш отзыв отправлен владельцу в Telegram.';
      $('feedback-text').value='';
    }catch(error){$('feedback-status').textContent=error instanceof Error&&!['TypeError','AbortError','TimeoutError'].includes(error.name)?error.message:'Не удалось подтвердить отправку. Проверьте соединение и не отправляйте отзыв повторно сразу.';$('feedback-submit').disabled=false;$('feedback-text').disabled=false;}
    finally{sending=false;document.querySelectorAll('.star').forEach(star=>star.disabled=false);}
  });
  function paint(value) { document.querySelectorAll('.star').forEach((el,i) => {el.classList.toggle('selected', i < value);el.setAttribute('aria-pressed',String(i + 1 === rating));el.tabIndex = i + 1 === (rating || 1) ? 0 : -1;}); }
  $('stars').setAttribute('role','group'); $('stars').setAttribute('aria-label','Оценка посещения');
  for (let i = 1; i <= 5; i++) {
    const star = document.createElement('button');star.type = 'button';star.className = 'star';star.setAttribute('aria-label', i + ' из 5: ' + descriptions[i]);star.setAttribute('aria-pressed','false');star.innerHTML = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="m24 4 6.08 12.32 13.6 1.98-9.84 9.59 2.32 13.55L24 35.04l-12.16 6.4 2.32-13.55-9.84-9.59 13.6-1.98Z"/></svg>';
    const choose = () => redirect(i);
    star.addEventListener('click',choose);star.addEventListener('mouseenter',()=>paint(i));star.addEventListener('mouseleave',()=>paint(rating));
    star.addEventListener('keydown',event=>{if (['ArrowRight','ArrowUp','ArrowLeft','ArrowDown','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?1:event.key==='End'?5:Math.max(1,Math.min(5,i+(['ArrowRight','ArrowUp'].includes(event.key)?1:-1)));const target=$('stars').children[next-1];target.focus();paint(next);}});
    $('stars').append(star);
  }
  async function copy(text, status, message) {
    try {await navigator.clipboard.writeText(text);status.textContent=message;} catch {status.textContent='Автоматическое копирование недоступно. Скопируйте текст из поля ниже.';const field=document.createElement('textarea');field.value=text;field.readOnly=true;field.className='copy-fallback';status.append(field);field.focus();field.select();}
  }
  function openSettings(){ for(let i=1;i<=5;i++)$('route-'+i).value=config['route'+i]; $('yandex-url').value=config.yandex;$('gis-url').value=config.gis;$('settings-error').textContent='';$('share-status').textContent='';$('settings-dialog').showModal();}
  $('settings-open').addEventListener('click',openSettings);$('settings-close').addEventListener('click',()=>$('settings-dialog').close());
  function readSettings(){
    const next={name:defaults.name,address:'',yandex:$('yandex-url').value.trim(),gis:$('gis-url').value.trim(),platform:config.platform};
    for(let i=1;i<=5;i++) {
      const route=$('route-'+i).value;
      if(!Object.hasOwn(targetLabels,route)){$('settings-error').textContent='Выберите направление для каждой звезды.';return null;}
      next['route'+i]=route;
    }
    if(!validPlatform(next.yandex,'yandex')||!validPlatform(next.gis,'gis')){$('settings-error').textContent='Используйте HTTPS-ссылки на Яндекс Карты и 2ГИС.';return null;}
    for(let i=1;i<=5;i++){
      const route=next['route'+i];
      if(route!=='telegram'&&!next[route]){$('settings-error').textContent='Для оценки '+i+' добавьте ссылку на '+targetLabels[route]+'.';return null;}
    }
    $('settings-error').textContent='';return next;
  }
  $('settings-form').addEventListener('submit',e=>{e.preventDefault();const next=readSettings();if(!next)return;config=next;let saved=true;try{localStorage.setItem('mesto.settings',JSON.stringify(config));}catch{saved=false;}applyConfig();$('route-status').hidden=true;if(saved){$('share-status').textContent='Настройки сохранены в этом браузере. Скопируйте ссылку для гостей.';}else{$('share-status').textContent='Браузер не разрешил сохранение. Скопируйте ссылку, чтобы сохранить настройки.';}});
  $('share').addEventListener('click',()=>{const next=readSettings();if(!next)return;if(location.protocol==='file:'){$('share-status').textContent='Чтобы создать ссылку для гостей, сначала разместите сайт на хостинге.';return;}const url=new URL(location.pathname,location.origin);for(const [key,value] of Object.entries(next))url.searchParams.set(key,value);copy(url.href,$('share-status'),'Ссылка скопирована. Её можно отправить гостям или использовать для QR-кода.');});
  document.querySelector('.brand').href = location.pathname + location.search;
  paint(0);
  applyConfig();
})();
