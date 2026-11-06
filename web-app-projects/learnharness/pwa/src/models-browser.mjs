export const APP_IDENTITY=Object.freeze({userAgent:{custom:'learnharness/0.4.0-aether-pwa'},attribution:{name:'learnharness',url:'https://github.com/amosblomqvist/learnharness'}});
export function piEngineFor(role){throw new Error(`No Aether engine injected for ${role}. Check Apps → Advanced; no provider/model fallback exists.`);}
