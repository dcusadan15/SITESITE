import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
const publicFiles=new Set(['index.html','style.css','app.js','routing.js']);
export function createFeedbackServer({env=process.env,fetchImpl=fetch,now=Date.now,publicDirectory=path.join(path.dirname(fileURLToPath(import.meta.url)),'public')}={}) {
  const attempts=new Map();const deliveries=new Map();
  const windowMs=10*60*1000;
  const configured=()=>/^\d+:[a-zA-Z0-9_-]+$/.test(env.TELEGRAM_BOT_TOKEN||'') && /^-?\d+$/.test(env.TELEGRAM_CHAT_ID||'');
  function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));}
  const server=http.createServer(async(req,res)=>{
    try {
      const url=new URL(req.url,'http://localhost');
      if(url.pathname==='/api/feedback') {
        if(req.method!=='POST'){res.setHeader('Allow','POST');return json(res,405,{error:'Используйте отправку из формы сайта.'});}
        const origin=env.PUBLIC_ORIGIN || 'http://'+req.headers.host;
        if(!req.headers.origin || req.headers.origin!==origin)return json(res,403,{error:'Отправка разрешена только с сайта.'});
        if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))return json(res,415,{error:'Неверный формат сообщения.'});
        if(!configured())return json(res,503,{error:'Отправка ещё не подключена: владельцу нужно настроить бота на сервере.'});
        if(Number(req.headers['content-length'])>12000){req.resume();return json(res,413,{error:'Сообщение слишком длинное.'});}
        const chunks=[];let size=0,tooLarge=false;
        for await(const chunk of req){size+=chunk.length;if(size>12000)tooLarge=true;else chunks.push(chunk);}
        if(tooLarge)return json(res,413,{error:'Сообщение слишком длинное.'});
        let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return json(res,400,{error:'Не удалось прочитать сообщение.'});}
        if(!data||typeof data!=='object'||!Number.isInteger(data.rating)||data.rating<1||data.rating>5||typeof data.text!=='string'||!data.text.trim()||data.text.length>2000||typeof data.requestId!=='string'||!/^[a-zA-Z0-9-]{8,100}$/.test(data.requestId))return json(res,400,{error:'Укажите оценку и текст отзыва длиной до 2000 символов.'});
        const stamp=now();for(const [key,value] of attempts)if(value.until<=stamp)attempts.delete(key);for(const [key,value] of deliveries)if(value.until<=stamp)deliveries.delete(key);
        const sender=req.socket.remoteAddress || 'unknown';const key=sender+':'+data.requestId;
        const fingerprint=JSON.stringify([data.rating,data.text.trim()]);
        const previous=deliveries.get(key);
        if(previous){
          if(previous.fingerprint!==fingerprint)return json(res,409,{error:'Обновите форму перед отправкой изменённого отзыва.'});
          if(previous.state==='sent')return json(res,200,{ok:true});
          return json(res,previous.state==='pending'?409:502,{error:previous.state==='pending'?'Сообщение уже отправляется. Дождитесь результата.':'Не удалось подтвердить доставку. Не отправляйте этот отзыв повторно сразу.'});
        }
        const quota=attempts.get(sender)||{count:0,until:stamp+windowMs};
        if(quota.count>=5)return json(res,429,{error:'Слишком много попыток. Попробуйте через несколько минут.'});
        quota.count++;attempts.set(sender,quota);deliveries.set(key,{state:'pending',until:stamp+windowMs,fingerprint});
        const text='Новый отзыв с сайта\nОценка: '+data.rating+' из 5\n\n'+data.text.trim();
        let response,payload;
        try {
          response=await fetchImpl('https://api.telegram.org/bot'+env.TELEGRAM_BOT_TOKEN+'/sendMessage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:env.TELEGRAM_CHAT_ID,text,link_preview_options:{is_disabled:true}}),signal:AbortSignal.timeout(12000)});
          payload=await response.json();
        } catch {
          deliveries.set(key,{state:'unknown',until:stamp+windowMs,fingerprint});
          return json(res,502,{error:'Не удалось подтвердить доставку. Не отправляйте этот отзыв повторно сразу.'});
        }
        if(!response.ok || payload?.ok!==true || !Number.isInteger(payload?.result?.message_id)){
          deliveries.delete(key);
          return json(res,502,{error:'Telegram не принял сообщение. Попробуйте позднее или сообщите владельцу сайта.'});
        }
        deliveries.set(key,{state:'sent',until:stamp+windowMs,fingerprint});
        return json(res,200,{ok:true});
      }
      if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');return json(res,405,{error:'Метод не поддерживается.'});}
      const name=url.pathname==='/'?'index.html':url.pathname.slice(1);
      if(!publicFiles.has(name))return json(res,404,{error:'Страница не найдена.'});
      try{const bytes=await readFile(path.join(publicDirectory,name));res.writeHead(200,{'Content-Type':mime[path.extname(name)],'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:bytes);}catch{return json(res,404,{error:'Файл сайта не найден.'});}
    } catch {if(!res.headersSent)json(res,500,{error:'Не удалось обработать запрос. Попробуйте позднее.'});else res.end();}
  });
  server.requestTimeout=30000;server.headersTimeout=15000;
  return server;
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const port=Number(process.env.PORT||3000);const host=process.env.HOST||'127.0.0.1';
  createFeedbackServer().listen(port,host,()=>console.log('Сайт запущен: http://'+host+':'+port));
}
