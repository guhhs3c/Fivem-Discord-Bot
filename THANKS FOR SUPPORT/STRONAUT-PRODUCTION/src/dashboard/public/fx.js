/* STRONAUT visual FX layer — purely cosmetic, no logic/data changes */
(function(){
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  // 1. scroll reveal for cards/sections, including dynamically-rendered ones
  var SEL='.card,.stat,.stat-card,.server-card,.command,.cta,.section,.health-row,.quick-action,.sectionhead,.code,.console,.notice,.page-header';
  var io='IntersectionObserver' in window?new IntersectionObserver(function(es){
    es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('fx-in');io.unobserve(e.target)}})
  },{threshold:.08}):null;
  function arm(root){
    (root.querySelectorAll?root.querySelectorAll(SEL):[]).forEach(function(el,i){
      if(el.__fx)return;el.__fx=1;
      if(!io||reduce){el.classList.add('fx-in');return}
      el.classList.add('fx-reveal');el.style.setProperty('--fx-d',Math.min(i%9,8)*55+'ms');io.observe(el)
    })
  }
  // 2. count-up for numeric values
  function count(el){
    if(el.__cnt||reduce)return;var t=el.textContent.trim();
    var m=t.match(/^(\D*)([\d.,]+)(\D*)$/);if(!m)return;
    var n=parseFloat(m[2].replace(/,/g,''));if(!isFinite(n)||n<=0||n>1e9)return;
    el.__cnt=1;var dec=(m[2].split('.')[1]||'').length,start=performance.now(),dur=900;
    (function f(now){var p=Math.min(1,(now-start)/dur),e=1-Math.pow(1-p,3),v=n*e;
      el.textContent=m[1]+(dec?v.toFixed(dec):Math.round(v).toLocaleString())+m[3];
      if(p<1)requestAnimationFrame(f);else el.textContent=t})(start)
  }
  function scan(root){arm(root);
    if(root.querySelectorAll)root.querySelectorAll('.stat-card .value,.stat b').forEach(function(e){
      if(e.textContent.trim()&&!/Checking|—/.test(e.textContent))count(e)})}
  // 3. cursor glow + tilt on cards
  document.addEventListener('pointermove',function(e){
    var c=e.target.closest&&e.target.closest('.card,.stat,.stat-card,.server-card,.command,.quick-action');
    if(c){var r=c.getBoundingClientRect();c.style.setProperty('--mx',(e.clientX-r.left)+'px');c.style.setProperty('--my',(e.clientY-r.top)+'px')}
    document.documentElement.style.setProperty('--gx',e.clientX+'px');document.documentElement.style.setProperty('--gy',e.clientY+'px')
  },{passive:true});
  // 4. ripple on buttons
  document.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('.btn,.fake-btn,.login-btn,.filter,.invite,.nav-item,.quick-action');
    if(!b||reduce)return;var r=b.getBoundingClientRect(),s=document.createElement('span');
    var d=Math.max(r.width,r.height);s.className='fx-ripple';
    s.style.cssText='width:'+d+'px;height:'+d+'px;left:'+(e.clientX-r.left-d/2)+'px;top:'+(e.clientY-r.top-d/2)+'px';
    if(getComputedStyle(b).position==='static')b.style.position='relative';b.style.overflow='hidden';
    b.appendChild(s);setTimeout(function(){s.remove()},650)
  });
  function init(){
    var g=document.createElement('div');g.className='fx-glow';document.body.appendChild(g);
    var o=document.createElement('div');o.className='fx-orbs';o.innerHTML='<i></i><i></i><i></i>';document.body.appendChild(o);
    scan(document);
    new MutationObserver(function(ms){ms.forEach(function(m){m.addedNodes.forEach(function(n){if(n.nodeType===1){scan(n);if(n.matches&&n.matches(SEL))arm({querySelectorAll:function(){return[n]}})}})})}).observe(document.body,{childList:true,subtree:true})
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init()
})();
