/** Existing native brand geometry, retained until its connected entry redesign. No navigation or state writes.
 * Coordinates supplied by the caller must be measured in the same coordinate space.
 * This is a reference adapter, not a replacement for existing native entry hooks.
 */
export type Box = Readonly<{x:number;y:number;width:number;height:number}>;
export type PartFrame = Readonly<{opacity:number;dx:number;dy:number;sx:number;sy:number;cx:number;cy:number}>;
export const INTRO_DURATION_MS=4380;
export const BRAND_PARTS=[[96.64952,157.7662,85.75324,25.1105],[118.91685,95.22816,40.74465,60.16967],[0,0,73.90841,75.32996],[207.03856,0,72.96145,75.32996],[94.75478,259.15366,39.3231,31.74294],[1.42137,85.75319,179.08589,205.14331],[116.54833,85.75319,161.08244,180.0336]] as const;
const progress=(t:number,a:number,b:number)=>{'worklet';return Math.max(0,Math.min(1,(t-a)/(b-a)));};
const ease=(p:number)=>{'worklet';return 1-Math.pow(1-p,3);};
const lerp=(a:number,b:number,p:number)=>{'worklet';return a+(b-a)*p;};
export function brandFrame(timeMs:number,phone:Box,logo:Box,reducedMotion=false){
 'worklet';
 if(!Number.isFinite(timeMs)||![phone.x,phone.y,phone.width,phone.height,logo.x,logo.y,logo.width,logo.height].every(Number.isFinite)||phone.width<=0||phone.height<=0||logo.width<=0||logo.height<=0)throw new RangeError('Brand geometry must be finite and measured before animation.');
 const t=reducedMotion?INTRO_DURATION_MS:Math.max(0,timeMs),k=logo.width/320;
 const localCx=39+(phone.x+phone.width/2-logo.x)/k,localCy=174+(phone.y+phone.height*.445-logo.y)/k;
 const s0=Math.min(phone.width*.61,238)/(280*k),p=ease(progress(t,1920,2690));
 const parts:PartFrame[]=BRAND_PARTS.map((meta,i)=>{
  let opacity=1,dx=0,dy=0,sx=1,sy=1;
  if(i===2||i===3){const q=ease(progress(t,80,650));opacity=q;dx=(i===2?-52:52)*(1-q);sx=sy=lerp(.92,1,q);}
  if(i===5||i===6){const q=ease(progress(t,40,760));opacity=q;dx=(i===5?-62:62)*(1-q);sx=sy=lerp(.95,1,q);}
  if(i===4){const q=ease(progress(t,630,900));opacity=q;dy=5*(1-q);}
  if(i===1){const q=ease(progress(t,760,1120));opacity=q;dy=-22*(1-q);sx=sy=lerp(.55,1,q);}
  if(i===0){const q=ease(progress(t,930,1240));opacity=q;sx=lerp(.35,1,q);}
  if(i===2){const close=ease(progress(t,1450,1550)),open=ease(progress(t,1620,1750));sy*=1-.9*close*(1-open);}
  return {opacity,dx,dy,sx,sy,cx:meta[2]/2,cy:meta[3]/2};
 });
 const slogan=ease(progress(t,3210,3500)),background=ease(progress(t,3590,4200)),choices=ease(progress(t,3980,4340));
 return {timeMs:t,done:t>=INTRO_DURATION_MS,mark:{x:lerp(localCx-140*s0,42.806,p),y:lerp(localCy-145.45*s0,175.496,p),scale:lerp(s0,.34,p)},parts,wordClipWidth:225*ease(progress(t,2700,3200)),wordOpacity:t<2700?0:1,slogan:{opacity:slogan,y:6*(1-slogan)},background:{greenPercent:-101*(1-background),orangePercent:101*(1-background)},choices:{opacity:choices,y:7*(1-choices),enabled:t>=INTRO_DURATION_MS}};
}
