const token=process.env.TELEGRAM_BOT_TOKEN;
if(!/^\d+:[a-zA-Z0-9_-]+$/.test(token||'')){console.error('Сначала заполните TELEGRAM_BOT_TOKEN в серверном файле .env.');process.exitCode=1;}
else {
  try {
    const response=await fetch('https://api.telegram.org/bot'+token+'/getUpdates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({limit:20,timeout:0}),signal:AbortSignal.timeout(10000)});
    const data=await response.json();
    if(!response.ok||!data.ok)throw Error();
    const chats=new Map();for(const update of data.result||[]){const chat=update.message?.chat;if(chat?.id)chats.set(String(chat.id),chat);}
    if(!chats.size)console.log('Нет сообщений. Откройте вашего бота в Telegram, нажмите «Запустить» и повторите команду.');
    else for(const [id,chat] of chats)console.log('TELEGRAM_CHAT_ID='+id+' ('+(chat.username?'@'+chat.username:chat.title||chat.first_name||chat.type)+')');
  }catch{console.error('Не удалось получить сообщения бота. Проверьте токен, доступ к Telegram и отсутствие другого обработчика updates.');process.exitCode=1;}
}
