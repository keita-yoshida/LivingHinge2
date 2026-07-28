import { $ } from "../dom";



let toastTimer: ReturnType<typeof setTimeout> | null = null;
export function toast(msg:string):void{
  const t=$("toast");
  t.textContent=msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.remove("show"),2400);
}
