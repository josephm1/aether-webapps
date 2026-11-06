import {readQuestionUiDraft,clearQuestionUiDraft} from './question-draft.mjs';
import React,{createContext,useContext,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {useStickToBottomContext} from 'use-stick-to-bottom';
import {QuestionDock} from '../../components/question-dock';
import {PracticeDock} from '../../components/practice-dock';
import {ReadingThinkingField} from '../../components/reading-thinking';
import {QueuedSteersBody} from '../../components/queued-steers';
import {ConversationScrollButton} from '../../components/ai-elements/conversation';
import {UsageControls} from './usage-controls';
const AnswerTarget=createContext<HTMLElement|null>(null);
export function QuestionFooter({children}:{children:React.ReactNode}){const target=useContext(AnswerTarget);return target?createPortal(children,target):<>{children}</>;}
export function SessionHeader({children,onMouseDown}:any){return <header className="lh-session-heading" onMouseDown={onMouseDown}>{children}</header>;}
export function SessionDock(props:any){
 const {pending,practice,composer,onReserve,chatId}=props,{scrollRef}=useStickToBottomContext();
 const footer=useRef<HTMLDivElement>(null),[slot,setSlot]=useState<HTMLElement|null>(null),[answerTarget,setAnswerTarget]=useState<HTMLDivElement|null>(null),[reveal,setReveal]=useState(false);
 useLayoutEffect(()=>{setSlot(scrollRef.current?.querySelector('[data-inline-question-slot]')||null);},[scrollRef,chatId]);
 useLayoutEffect(()=>{setReveal(false);},[pending?.key]);
 useLayoutEffect(()=>{const node=footer.current;if(!node)return;const measure=()=>onReserve(node.getBoundingClientRect().height+12);measure();const observer=new ResizeObserver(measure);observer.observe(node);return()=>observer.disconnect();},[onReserve]);
 const previous=useRef(pending?.toolCallId);
 useLayoutEffect(()=>{if(previous.current&&previous.current!==pending?.toolCallId)clearQuestionUiDraft(previous.current);previous.current=pending?.toolCallId;},[pending?.toolCallId]);
 const revealed=!props.requiresReveal||reveal;
 const question=pending?<AnswerTarget.Provider value={answerTarget}><section className="lh-inline-question" aria-label="Teacher question">{props.requiresReveal&&!reveal?<><p>Ready to check your understanding?</p><button type="button" className="lh-tonal-button" onClick={()=>setReveal(true)}>Show question</button><ReadingThinkingField value={props.readingThinking} onChange={props.onReadingThinking} claim={false}/></>:null}{revealed&&<QuestionDock key={pending.key} toolName={pending.tool} toolCallId={pending.toolCallId} input={pending.input} expanded={revealed} onExpand={()=>setReveal(true)} phase={props.phase} onSubmit={props.onSubmitAnswer} initialDraft={props.initialQuestionDraft||readQuestionUiDraft(pending.toolCallId,pending.input)} onSaveDraft={props.onSaveQuestionDraft} dictationClaim={false} compactionRunning={props.compactionRunning}/>}</section></AnswerTarget.Provider>:practice?<section className="lh-inline-question" aria-label="Practice problem"><PracticeDock key={practice.toolCallId} problemCallId={practice.toolCallId} input={practice.input} expanded onExpand={()=>{}} onSubmit={props.onSubmitThinking} compactionRunning={props.compactionRunning}/></section>:null;
 return <>{slot&&question&&createPortal(question,slot)}<div className="lh-session-dock" ref={footer}><div className="lh-home-composer"><QueuedSteersBody steers={props.queuedSteers}/><div className="lh-session-composer-surface">{pending&&revealed?<div ref={setAnswerTarget} className="lh-answer-composer"/>:pending?<button className="lh-question-jump" onClick={()=>{slot?.scrollIntoView({block:'end'});setReveal(true);}}>Answer the question ↑</button>:practice?<p className="lh-composer-status">Write your response in the problem above.</p>:composer}<UsageControls turns={props.turns} contextTokens={props.contextTokens} chatId={chatId} onModelChange={props.onModelChange} nativeMessages={props.nativeMessages}/></div><ConversationScrollButton className="lh-scroll-latest"/></div></div></>;
}
