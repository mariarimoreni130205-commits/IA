// The second half of the file is the exact first half in reverse. Returning
// changes to the matching frame and then plays forward through that half.
export function mirrorTime(time,end,fps=24){return Math.max(0,Math.min(2*end,2*end-time-1/fps));}
export function forwardTime(time,end,fps=24){return time<=end?time:mirrorTime(time,end,fps);}
export function progress(time,start,end){return Math.max(0,Math.min(1,(time-start)/(end-start)));}
