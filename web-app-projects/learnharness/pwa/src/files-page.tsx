import React,{useEffect,useRef} from 'react';
import {mountFiles} from './files.mjs';
export default function FilesPage(){const ref=useRef<HTMLDivElement>(null);useEffect(()=>mountFiles(ref.current!),[]);return <div ref={ref} style={{height:'100%',overflow:'auto'}}/>;}
