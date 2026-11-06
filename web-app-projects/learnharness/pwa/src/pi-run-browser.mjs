import {Agent} from '@earendil-works/pi-agent-core';
import {APP_IDENTITY,piEngineFor} from './models-browser.mjs';
import {usageWasAdmitted} from '../../src/agent/subscription-request-cycle.ts';
export const subagentEngine=(role,override)=>override??piEngineFor(role);
export async function runSubagent(tools,opts){
 const engine=subagentEngine(opts.role,opts.engine);let turns=0,step=0,error,aborted=false;
 const agent=new Agent({identity:APP_IDENTITY,sessionId:crypto.randomUUID(),initialState:{systemPrompt:opts.systemPrompt,model:engine.model,thinkingLevel:engine.level,tools,messages:opts.messages||[]},streamFn:engine.streamFn,finishTurn:turn=>{turns++;if(turns>=(opts.maxTurns||8)||opts.shouldStop?.(turn.message,turn.toolResults))return {action:'end'};}});
 const abort=()=>agent.abort(),timeout=setTimeout(abort,180000);opts.abortSignal?.addEventListener('abort',abort,{once:true});
 const off=agent.subscribe(event=>{if(event.type==='message_end'&&event.message.role==='assistant'){const m=event.message;if(m.stopReason==='aborted')aborted=true;if(m.stopReason!=='aborted'&&usageWasAdmitted(m.usage)){step++;opts.onUsage?.(m.usage);opts.onAssistantMessage?.(m,step);}if(m.stopReason==='error')error=m.errorMessage||'Aether model request failed.';}if(event.type==='tool_execution_start')opts.onToolStart?.(event.toolName,event.args);});
 try{if(opts.prompt!==undefined)await agent.prompt({role:'user',content:opts.prompt,timestamp:Date.now()});else await agent.continue();}
 finally{clearTimeout(timeout);off();opts.abortSignal?.removeEventListener('abort',abort);}
 if(aborted||opts.abortSignal?.aborted)throw new DOMException('App agent aborted','AbortError');if(error)throw new Error(error);
 const messages=agent.state.messages.filter(m=>m.role!=='system').slice(opts.messages?.length||0),last=messages.filter(m=>m.role==='assistant').at(-1);
 return {newMessages:messages,text:last?.content.filter(c=>c.type==='text').map(c=>c.text).join('')||''};
}
