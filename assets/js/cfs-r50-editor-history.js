/* R50 · bounded local undo/redo snapshots; no persistent or network storage. */
(function(root){'use strict';
 function create(initial,limit=60){
  if(!Number.isInteger(limit)||limit<2||limit>200)throw Error('Ungueltige Historiengrenze');
  let entries=[JSON.stringify(initial)],index=0;
  const copy=value=>JSON.parse(JSON.stringify(value));
  function push(value){
   const snapshot=JSON.stringify(value);
   if(snapshot===entries[index])return false;
   entries=entries.slice(0,index+1);
   entries.push(snapshot);
   if(entries.length>limit)entries.shift();
   index=entries.length-1;
   return true;
  }
  function reset(value){entries=[JSON.stringify(value)];index=0;}
  function undo(){if(index<=0)return null;return copy(JSON.parse(entries[--index]));}
  function redo(){if(index>=entries.length-1)return null;return copy(JSON.parse(entries[++index]));}
  return Object.freeze({push,reset,undo,redo,canUndo:()=>index>0,canRedo:()=>index<entries.length-1,length:()=>entries.length,index:()=>index});
 }
 root.CFSR50History=Object.freeze({create});
})(typeof window!=='undefined'?window:globalThis);
