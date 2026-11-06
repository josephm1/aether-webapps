import {HostedModelTransport} from './model-client.mjs';
import {db,settings} from './store.mjs';
export const transport=new HostedModelTransport('aether-learnharness');
export function selection(info){return {provider:info.model.provider,id:info.model.id,thinkingLevel:info.thinkingLevel,...(info.selectionId?{selectionId:info.selectionId}:{})};}
export async function acceptSelection(info){
 if(!info?.supported)throw new Error(info?.reason||'Aether model access is unavailable.');
 const record=await settings()||{version:1},pin={model:{provider:info.model.provider,id:info.model.id},thinkingLevel:info.thinkingLevel};
 await db.put('settings','record',{...record,models:{strong:pin,cheap:pin,vision:pin}});
 for(const section of ['keys','models'])window.dispatchEvent(new CustomEvent('lh:settings-saved',{detail:{section}}));
}
export async function modelCatalog(){
 const info=await transport.capabilities();
 if(!info.supported)return {models:[],defaults:null,rolePins:{},slots:{strong:null,cheap:null,vision:null},providers:[],aether:info};
 const m=info.model,pin={model:{provider:m.provider,id:m.id},thinkingLevel:info.thinkingLevel};
 const model={...m,supportedLevels:[info.thinkingLevel],contextWindow:m.contextWindow??null,maxTokens:m.maxTokens??null,cost:null};
 return {models:[model],defaults:pin,rolePins:Object.fromEntries(['researcher','demoBuilder','visualMaker','pdfReader','extractor','auditor'].map(r=>[r,pin])),slots:{strong:pin,cheap:pin,vision:pin},providers:[{id:m.provider,envVar:'',keyPresent:true}],aether:info};
}
