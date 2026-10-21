import {createInterface} from 'node:readline/promises';
import {createFeedbackServer} from './server.mjs';

async function main(){
  const token=process.env.TELEGRAM_BOT_TOKEN;
  if(!/^\d+:[a-zA-Z0-9_-]+$/.test(token||''))throw Error('Токен не распознан. Вставьте полный токен, полученный от BotFather.');
  let updates;
  try{
    const response=await fetch('https://api.telegram.org/bot'+token+'/getUpdates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({limit:100,timeout:0}),signal:AbortSignal.timeout(12000)});
    updates=await response.json();
    if(!response.ok||updates.ok!==true)throw Error();
  }catch{throw Error('Не удалось получить сообщения бота. Проверьте токен, интернет и отсутствие другого обработчика сообщений у этого бота.');}
  const chats=new Map();
  for(const update of updates.result||[]){const chat=update.message?.chat;if(chat?.type==='private'&&chat.id)chats.set(String(chat.id),chat);}
  if(!chats.size)throw Error('Не найден личный чат. Откройте именно этого бота, ещё раз отправьте /start и повторите запуск.');
  const choices=[...chats.values()];let chat=choices[0];
  if(choices.length>1){
    console.log('Кому доставлять отзывы?');
    choices.forEach((item,index)=>console.log((index+1)+'. '+(item.username?'@'+item.username:item.first_name||'Личный чат')+' (ID '+item.id+')'));
    const input=createInterface({input:process.stdin,output:process.stdout});let number;
    try{number=Number(await input.question('Введите номер своего чата: '));}finally{input.close();}
    if(!Number.isInteger(number)||number<1||number>choices.length)throw Error('Неверный номер чата. Повторите запуск.');
    chat=choices[number-1];
  }
  const port=Number(process.env.LOCAL_PORT||3000);
  if(!Number.isInteger(port)||port<1024||port>65535)throw Error('LOCAL_PORT должен быть числом от 1024 до 65535.');
  const origin='http://127.0.0.1:'+port;
  const env={TELEGRAM_BOT_TOKEN:token,TELEGRAM_CHAT_ID:String(chat.id),PUBLIC_ORIGIN:origin};
  const server=createFeedbackServer({env});
  await new Promise((resolve,reject)=>{server.once('error',error=>reject(Error(error.code==='EADDRINUSE'?'Порт '+port+' уже занят. Закройте предыдущий локальный запуск и повторите.':'Не удалось запустить локальный сервер.')));server.listen(port,'127.0.0.1',resolve);});
  console.log('\nПолучатель отзывов: '+(chat.username?'@'+chat.username:chat.first_name||'личный чат')+' (ID '+chat.id+')');
  console.log('Откройте в браузере: '+origin);
  console.log('Выберите 4 или 5 звёзд, введите тестовый отзыв и нажмите «Отправить отзыв».');
  console.log('Проверьте новое сообщение в личном чате с вашим ботом.');
  console.log('Токен не записан в файлы. Для остановки сервера нажмите Ctrl+C.\n');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
