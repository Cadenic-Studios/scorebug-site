/**
 * CARRYING THE CAMPAIGN ACROSS THE ORIGIN BOUNDARY.
 *
 * getscorebug.app and app.getscorebug.app are separate origins, so anything
 * the marketing site remembers in localStorage is invisible to the web app.
 * A visitor who arrives on `getscorebug.app/?s=ads&c=vancouver` and then taps
 * "Open the app" lands on a URL with no campaign on it, and the signup that
 * follows is recorded as direct traffic. Every paid click would be credited to
 * nobody, which is indistinguishable from the ads not working.
 *
 * So the campaign rides the URL. This rewrites every link into the app, in the
 * browser, once, on load.
 *
 * ── WHY A SCRIPT AND NOT A PROP ─────────────────────────────────────────────
 *
 * This site is statically rendered and cached. A page built at deploy time
 * cannot know which advert a visitor clicked, so the links in the HTML are
 * necessarily campaign-free and something in the browser has to fix them. One
 * script that finds them by hostname covers every link on every page,
 * including ones nobody has written yet — which is the difference between a
 * rule that holds and a rule somebody has to remember at each new call site.
 *
 * ── WHAT IT WILL NOT DO ─────────────────────────────────────────────────────
 *
 * Only `s`, `c` and the three utm_ parameters, only onto app.getscorebug.app,
 * and never over a parameter the link already carries. It cannot be used to
 * attach arbitrary query strings to arbitrary destinations, because a script
 * that copies whatever is in the address bar onto whatever links it finds is a
 * way to smuggle values into somebody else's site.
 */
/* The readyState guard is why this is correct wherever it sits in the
   document. `defer` is ignored on an INLINE script — it applies only to
   scripts with a src — so without the guard this would run the moment the
   parser reached it, which is before the links it exists to rewrite. The
   guard lives inside the emitted string; this comment does not, because a
   backtick in a comment inside a template literal ends the template literal,
   which is how this file spent ten minutes as a syntax error. */
export const CAMPAIGN_BOOT_SCRIPT = `(function(){
function run(){try{
var q=new URLSearchParams(location.search);
var keys=['s','c','utm_source','utm_campaign','utm_medium'];
var carry=[];
for(var i=0;i<keys.length;i++){var v=q.get(keys[i]);if(v)carry.push([keys[i],v.slice(0,60)]);}
if(!carry.length)return;
var links=document.querySelectorAll('a[href]');
for(var j=0;j<links.length;j++){
  var a=links[j],u;
  try{u=new URL(a.href,location.href);}catch(e){continue;}
  if(u.hostname!=='app.getscorebug.app')continue;
  for(var k=0;k<carry.length;k++){if(!u.searchParams.has(carry[k][0]))u.searchParams.set(carry[k][0],carry[k][1]);}
  a.href=u.toString();
}
}catch(e){}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
})();`;
