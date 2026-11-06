import {createInterface} from 'node:readline';
import {appendFileSync} from 'node:fs';
const send=value=>process.stdout.write(JSON.stringify(value)+'\n');
for await(const line of createInterface({input:process.stdin})){
 const m=JSON.parse(line),p=m.params??{};
 if(process.env.LH_FAKE_RECORD)appendFileSync(process.env.LH_FAKE_RECORD,JSON.stringify(m)+'\n');
 if(m.id==null)continue;
 let result={};
 if(m.method==='account/read')result={account:{type:process.env.LH_FAKE_MODE==='api-key'?'apiKey':'chatgpt'}};
 if(m.method==='config/read')result={config:{mcp_servers:{external:{command:'never-run'}}}};
 if(m.method==='thread/start')result={thread:{id:'test-thread'}};
 send({id:m.id,result});
 if(m.method==='turn/start'){
  if(process.env.LH_FAKE_MODE==='wait')continue;
  if(p.input.some(i=>i.text?.includes('callmock'))){send({id:900,method:'item/tool/call',params:{callId:'call-test',tool:'record_choice',arguments:{choice:'dinner'},namespace:null}});continue;}
  send({method:'item/agentMessage/delta',params:{itemId:'message',delta:'READY'}});
  send({method:'thread/tokenUsage/updated',params:{tokenUsage:{last:{inputTokens:10,cachedInputTokens:3,outputTokens:2,totalTokens:12}}}});
  send({method:'turn/completed',params:{turn:{status:'completed'}}});
 }
}
