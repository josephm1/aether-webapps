import {download} from './db.mjs';
export async function saveSessionMarkdown(chatId){
 try{
  const response=await fetch('/api/chats/'+encodeURIComponent(chatId)+'/markdown');
  if(!response.ok)throw new Error('Session export failed; the session was retained.');
  const name=response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1]||'session.md';
  await download(name,await response.blob(),'text/markdown');
 }catch(error){alert(error.message);}
}
