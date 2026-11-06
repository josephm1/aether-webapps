const colors={primary:'primary',onPrimary:'on-primary',container:'container',onContainer:'on-container',background:'bg',surface:'surface',text:'text',muted:'muted',line:'line'};
function darkBackground(value){if(!/^#[0-9a-f]{6}$/i.test(value||''))return null;const n=parseInt(value.slice(1),16);return (((n>>16)&255)*.2126+((n>>8)&255)*.7152+(n&255)*.0722)<128;}
export function applyTheme(preference){
 const palette=globalThis.AetherAppInfo?.theme||{},hostDark=darkBackground(palette.background),dark=preference==='dark'||(preference==='system'&&(hostDark??matchMedia('(prefers-color-scheme:dark)').matches));
 const mode=preference==='eink'?'eink':dark?'dark':'light',root=document.documentElement;
 root.dataset.theme=mode;root.classList.toggle('dark',mode==='dark');
 for(const [key,token]of Object.entries(colors)){
  const value=palette[key];if(mode!=='eink'&&hostDark!==null&&hostDark===dark&&/^#[0-9a-f]{6}$/i.test(value||''))root.style.setProperty('--md-'+token,value);else root.style.removeProperty('--md-'+token);
 }
}
