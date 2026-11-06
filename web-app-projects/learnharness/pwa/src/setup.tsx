import React,{useEffect,useRef} from 'react';
export function SetupDialog({open,onClose}: {open:boolean;onClose:()=>void;onDone:(value:unknown)=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const node=dialog.current;if(!node)return;if(open&&!node.open)node.showModal();else if(!open&&node.open)node.close();},[open]);
 return <dialog ref={dialog} aria-labelledby="aether-model-title" className="pwa-storage" onCancel={event=>{event.preventDefault();onClose();}}><h2 id="aether-model-title">Aether model selection</h2><p>Choose or repair your provider and model in Aether’s model controls, then return. All app roles use that selection and reasoning effort.</p><button onClick={onClose}>Return to app</button></dialog>;
}
