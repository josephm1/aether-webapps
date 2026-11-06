import {sha256} from '@noble/hashes/sha256';
import {bytesToHex} from '@noble/hashes/utils';
export const randomUUID=()=>crypto.randomUUID();
export function createHash(algorithm){if(algorithm!=='sha256')throw new Error('Only baseline SHA-256 is supported in this browser adapter.');const hash=sha256.create();return {update(value){hash.update(typeof value==='string'?new TextEncoder().encode(value):value);return this;},digest(format){const bytes=hash.digest();if(format==='hex')return bytesToHex(bytes);if(format)throw new Error('Unsupported digest encoding.');return bytes;}};}
