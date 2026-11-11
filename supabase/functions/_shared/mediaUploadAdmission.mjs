/**
 * Isolate-local bounded FIFO admission. Waiting requests hold no uploaded bytes.
 * Refusal returns null: callers preserve the established 429 operation code.
 * There is deliberately no guarantee of ordering across different Edge isolates.
 */
export function createMediaUploadAdmission({activeLimit,waitingLimit,waitMs}) {
  if(!Number.isInteger(activeLimit)||activeLimit<1||!Number.isInteger(waitingLimit)||waitingLimit<0
    ||!Number.isInteger(waitMs)||waitMs<1)throw new Error('INVALID_ADMISSION_LIMIT');
  let active=0;
  const pending=[];
  const release=()=>{
    active--;
    for(;;){
      const next=pending.shift();
      if(!next)return;
      if(next.grant()){active++;return;}
    }
  };
  function token(){
    let owned=true;
    return ()=>{if(!owned)return;owned=false;release();};
  }
  function acquire(signal){
    if(signal.aborted)return Promise.resolve(null);
    if(active<activeLimit&&!pending.length){active++;return Promise.resolve(token());}
    if(pending.length>=waitingLimit)return Promise.resolve(null);
    return new Promise(resolve=>{
      let done=false;
      const entry={grant(){if(done)return false;finish(token(),false);return true;}};
      const deadline=setTimeout(()=>finish(null,true),waitMs);
      const cancel=()=>finish(null,true);
      function finish(permit,remove){
        if(done)return;
        done=true;clearTimeout(deadline);signal.removeEventListener('abort',cancel);
        if(remove){const i=pending.indexOf(entry);if(i>=0)pending.splice(i,1);}
        resolve(permit);
      }
      pending.push(entry);
      signal.addEventListener('abort',cancel,{once:true});
      if(signal.aborted)cancel();
    });
  }
  return Object.freeze({acquire});
}
