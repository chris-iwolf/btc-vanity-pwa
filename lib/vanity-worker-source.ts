// Web Worker source as a string. The elliptic library is fetched in the main
// thread and prepended to this source so the full bundle is self-contained —
// this means generation keeps working while offline (PWA).
export const VANITY_WORKER_SRC = `
'use strict';

// ─── SHA-256 ───────────────────────────────────────────────────────────────
function sha256(input) {
  const msg = Array.from(input instanceof Uint8Array ? input : new Uint8Array(input));
  const ml = msg.length;
  const rotr = (x,n) => ((x>>>n)|(x<<(32-n)))>>>0;
  const K = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
  ];
  let h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a,
      h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19;
  msg.push(0x80);
  while (msg.length%64!==56) msg.push(0);
  const bl=ml*8;
  msg.push(0,0,0,0,(bl>>>24)&0xff,(bl>>>16)&0xff,(bl>>>8)&0xff,bl&0xff);
  for (let i=0;i<msg.length;i+=64) {
    const W=[];
    for (let j=0;j<16;j++)
      W[j]=((msg[i+j*4]<<24)|(msg[i+j*4+1]<<16)|(msg[i+j*4+2]<<8)|msg[i+j*4+3])>>>0;
    for (let j=16;j<64;j++) {
      const s0=rotr(W[j-15],7)^rotr(W[j-15],18)^(W[j-15]>>>3);
      const s1=rotr(W[j-2],17)^rotr(W[j-2],19)^(W[j-2]>>>10);
      W[j]=(W[j-16]+s0+W[j-7]+s1)>>>0;
    }
    let a=h0,b=h1,c=h2,d=h3,e=h4,f=h5,g=h6,h=h7;
    for (let j=0;j<64;j++) {
      const S1=rotr(e,6)^rotr(e,11)^rotr(e,25);
      const ch=((e&f)^(~e&g))>>>0;
      const t1=(h+S1+ch+K[j]+W[j])>>>0;
      const S0=rotr(a,2)^rotr(a,13)^rotr(a,22);
      const maj=((a&b)^(a&c)^(b&c))>>>0;
      const t2=(S0+maj)>>>0;
      h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
    }
    h0=(h0+a)>>>0;h1=(h1+b)>>>0;h2=(h2+c)>>>0;h3=(h3+d)>>>0;
    h4=(h4+e)>>>0;h5=(h5+f)>>>0;h6=(h6+g)>>>0;h7=(h7+h)>>>0;
  }
  const out=new Uint8Array(32);
  [h0,h1,h2,h3,h4,h5,h6,h7].forEach((v,i)=>{
    out[i*4]=(v>>>24)&0xff;out[i*4+1]=(v>>>16)&0xff;out[i*4+2]=(v>>>8)&0xff;out[i*4+3]=v&0xff;
  });
  return out;
}

// ─── RIPEMD-160 ────────────────────────────────────────────────────────────
function ripemd160(input) {
  const msg=Array.from(input instanceof Uint8Array?input:new Uint8Array(input));
  const ml=msg.length;
  const rol=(x,n)=>((x<<n)|(x>>>(32-n)))>>>0;
  const add=(...a)=>a.reduce((s,v)=>(s+v)>>>0,0);
  const f=(j,x,y,z)=>{
    if(j<16)return(x^y^z)>>>0;
    if(j<32)return((x&y)|(~x&z))>>>0;
    if(j<48)return((x|~y)^z)>>>0;
    if(j<64)return((x&z)|(y&~z))>>>0;
    return(x^(y|~z))>>>0;
  };
  const RL=[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,7,4,13,1,10,6,15,3,12,0,9,5,2,14,11,8,3,10,14,4,9,15,8,1,2,7,0,6,13,11,5,12,1,9,11,10,0,8,12,4,13,3,7,15,14,5,6,2,4,0,5,9,7,12,2,10,14,1,3,8,11,6,15,13];
  const RR=[5,14,7,0,9,2,11,4,13,6,15,8,1,10,3,12,6,11,3,7,0,13,5,10,14,15,8,12,4,9,1,2,15,5,1,3,7,14,6,9,11,8,12,2,10,0,4,13,8,6,4,1,3,11,15,0,5,12,2,13,9,7,10,14,12,15,10,4,1,5,8,7,6,2,13,14,0,3,9,11];
  const SL=[11,14,15,12,5,8,7,9,11,13,14,15,6,7,9,8,7,6,8,13,11,9,7,15,7,12,15,9,11,7,13,12,11,13,6,7,14,9,13,15,14,8,13,6,5,12,7,5,11,12,14,15,14,15,9,8,9,14,5,6,8,6,5,12,9,15,5,11,6,8,13,12,5,12,13,14,11,8,5,6];
  const SR=[8,9,9,11,13,15,15,5,7,7,8,11,14,14,12,6,9,13,15,7,12,8,9,11,7,7,12,7,6,15,13,11,9,7,15,11,8,6,6,14,12,13,5,14,13,13,7,5,15,5,8,11,14,14,6,14,6,9,12,9,12,5,15,8,8,5,12,9,12,5,14,6,8,13,6,5,15,13,11,11];
  const KL=[0,0x5A827999,0x6ED9EBA1,0x8F1BBCDC,0xA953FD4E];
  const KR=[0x50A28BE6,0x5C4DD124,0x6D703EF3,0x7A6D76E9,0];
  let h0=0x67452301,h1=0xEFCDAB89,h2=0x98BADCFE,h3=0x10325476,h4=0xC3D2E1F0;
  msg.push(0x80);
  while(msg.length%64!==56)msg.push(0);
  const blen=ml*8;
  for(let i=0;i<4;i++)msg.push((blen>>>(i*8))&0xff);
  msg.push(0,0,0,0);
  for(let i=0;i<msg.length;i+=64){
    const X=new Int32Array(16);
    for(let j=0;j<16;j++)
      X[j]=msg[i+j*4]|(msg[i+j*4+1]<<8)|(msg[i+j*4+2]<<16)|(msg[i+j*4+3]<<24);
    let al=h0,bl=h1,cl=h2,dl=h3,el=h4;
    let ar=h0,br=h1,cr=h2,dr=h3,er=h4;
    for(let j=0;j<80;j++){
      const r=Math.floor(j/16);
      let T=add(al,f(j,bl,cl,dl),X[RL[j]],KL[r]);
      T=add(rol(T,SL[j]),el);al=el;el=dl;dl=rol(cl,10);cl=bl;bl=T;
      T=add(ar,f(79-j,br,cr,dr),X[RR[j]],KR[r]);
      T=add(rol(T,SR[j]),er);ar=er;er=dr;dr=rol(cr,10);cr=br;br=T;
    }
    const T=add(h1,cl,dr);
    h1=add(h2,dl,er);h2=add(h3,el,ar);h3=add(h4,al,br);h4=add(h0,bl,cr);h0=T;
  }
  const out=new Uint8Array(20);
  [h0,h1,h2,h3,h4].forEach((v,i)=>{
    out[i*4]=v&0xff;out[i*4+1]=(v>>>8)&0xff;out[i*4+2]=(v>>>16)&0xff;out[i*4+3]=(v>>>24)&0xff;
  });
  return out;
}

function hash160(data){return ripemd160(sha256(data));}

// ─── Base58Check ───────────────────────────────────────────────────────────
const B58A='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58Enc(bytes){
  let n=BigInt('0x'+[...bytes].map(b=>b.toString(16).padStart(2,'0')).join(''));
  let s='';
  while(n>0n){s=B58A[Number(n%58n)]+s;n/=58n;}
  for(const b of bytes){if(b===0)s='1'+s;else break;}
  return s;
}
function base58check(payload){
  const cs=sha256(sha256(payload)).slice(0,4);
  return base58Enc(new Uint8Array([...payload,...cs]));
}

// ─── Bech32 / Bech32m ──────────────────────────────────────────────────────
const B32C='qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const B32G=[0x3b6a57b2,0x26508e6d,0x1ea119fa,0x3d4233dd,0x2a1462b3];
function b32Polymod(v){
  let c=1;
  for(const d of v){
    const b=c>>25;c=((c&0x1ffffff)<<5)^d;
    for(let i=0;i<5;i++)if((b>>i)&1)c^=B32G[i];
  }
  return c;
}
function b32HrpExpand(hrp){
  const r=[];
  for(const c of hrp)r.push(c.charCodeAt(0)>>5);
  r.push(0);
  for(const c of hrp)r.push(c.charCodeAt(0)&31);
  return r;
}
function convertBits(data,from,to,pad){
  let acc=0,bits=0;const out=[],maxv=(1<<to)-1;
  for(const v of data){acc=(acc<<from)|v;bits+=from;while(bits>=to){bits-=to;out.push((acc>>bits)&maxv);}}
  if(pad&&bits>0)out.push((acc<<(to-bits))&maxv);
  return out;
}
// isM=false -> bech32 (witver 0 / SegWit); isM=true -> bech32m (witver 1 / Taproot)
function bech32Encode(hrp, witver, prog, isM){
  const data=[witver, ...convertBits(prog,8,5,true)];
  const combined=[...b32HrpExpand(hrp), ...data, 0,0,0,0,0,0];
  const CONST = isM ? 0x2bc830a3 : 1;
  const poly=(b32Polymod(combined)^CONST)>>>0;
  const cs=[];
  for(let i=0;i<6;i++) cs.push((poly>>(5*(5-i)))&31);
  return hrp+'1'+[...data,...cs].map(d=>B32C[d]).join('');
}

// ─── Taproot helpers (BIP340 / BIP341 / BIP86) ─────────────────────────────
function taggedHash(tag, msg){
  const te = new TextEncoder();
  const tagHash = sha256(te.encode(tag));
  const combined = new Uint8Array(64 + msg.length);
  combined.set(tagHash, 0);
  combined.set(tagHash, 32);
  combined.set(msg, 64);
  return sha256(combined);
}
function toHex(b){return [...b].map(v=>v.toString(16).padStart(2,'0')).join('');}
function bytesToBigInt(b){return BigInt('0x'+toHex(b));}
function bigIntTo32Bytes(n){
  const hex=n.toString(16).padStart(64,'0');
  const out=new Uint8Array(32);
  for(let i=0;i<32;i++) out[i]=parseInt(hex.substr(i*2,2),16);
  return out;
}
const SECP_N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');

// ─── Key / address derivation ──────────────────────────────────────────────
function toWIF(pk){return base58check(new Uint8Array([0x80,...pk,0x01]));}

function deriveAddress(privKey, addrType){
  const kp = ec.keyFromPrivate(privKey);

  if (addrType === 'taproot') {
    // BIP86: internal key P = d*G with even Y; tweak with no script path:
    // t = taggedHash("TapTweak", P.x); output key Q = P + t*G.
    let internalPriv = privKey;
    let pub = kp.getPublic();
    if (pub.getY().isOdd()) {
      const d = bytesToBigInt(privKey);
      internalPriv = bigIntTo32Bytes((SECP_N - d) % SECP_N);
      pub = ec.keyFromPrivate(internalPriv).getPublic();
    }
    const xOnly = new Uint8Array(pub.getX().toArray('be', 32));
    const t = taggedHash('TapTweak', xOnly);
    const qPrivBI = (bytesToBigInt(internalPriv) + bytesToBigInt(t)) % SECP_N;
    const qPub = ec.keyFromPrivate(bigIntTo32Bytes(qPrivBI)).getPublic();
    const qX = new Uint8Array(qPub.getX().toArray('be', 32));
    return {
      address: bech32Encode('bc', 1, qX, true),
      privHex: toHex(internalPriv),
      wif: toWIF(internalPriv),
    };
  }

  const pubBytes = new Uint8Array(kp.getPublic(true, 'array'));
  const h = hash160(pubBytes);
  if (addrType === 'legacy') {
    return {
      address: base58check(new Uint8Array([0x00, ...h])),
      privHex: toHex(privKey),
      wif: toWIF(privKey),
    };
  }
  // Native SegWit (witver 0, bech32)
  return {
    address: bech32Encode('bc', 0, h, false),
    privHex: toHex(privKey),
    wif: toWIF(privKey),
  };
}

// ─── Main loop ─────────────────────────────────────────────────────────────
const ec = new elliptic.ec('secp256k1');

self.onmessage = function(e){
  const { prefix, suffix, caseSensitive, addrType } = e.data;
  let attempts = 0;
  function matches(addr){
    if(!caseSensitive){
      const a = addr.toLowerCase();
      return (!prefix || a.startsWith(prefix.toLowerCase())) && (!suffix || a.endsWith(suffix.toLowerCase()));
    }
    return (!prefix || addr.startsWith(prefix)) && (!suffix || addr.endsWith(suffix));
  }
  while(true){
    const pk = new Uint8Array(32);
    crypto.getRandomValues(pk);
    if (pk[0]===0 && pk[1]===0) continue;
    const out = deriveAddress(pk, addrType);
    attempts++;
    if (matches(out.address)) {
      self.postMessage({ type:'result', address: out.address, privKey: out.privHex, wif: out.wif, attempts });
      attempts = 0; // keep running for additional matches
    }
    if (attempts >= 800) {
      self.postMessage({ type:'progress', attempts });
      attempts = 0;
    }
  }
};
`
