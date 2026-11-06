import React,{lazy,Suspense} from 'react';
export function Image({src,alt,fill,priority,unoptimized,loader,...props}:any){return <img {...props} src={typeof src==='string'?src:src?.src} alt={alt||''} style={fill?{width:'100%',height:'100%',objectFit:'contain',...props.style}:props.style}/>;}
export function dynamic(load:any,options:any={}){const Component=lazy(()=>load().then((module:any)=>module.default?module:{default:module}));return function Dynamic(props:any){const Loading=options.loading;return <Suspense fallback={Loading?<Loading/>:null}><Component {...props}/></Suspense>;};}
export function Head(){return null;}
