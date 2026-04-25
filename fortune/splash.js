// v49 polish pack — splash + fade-in + safe SW ready
(function(){
  function ready(){
    document.body.classList.add('app-ready');
    const sp = document.getElementById('app-splash');
    if (sp) setTimeout(()=> sp.remove(), 500);
  }
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(ready, 150);
  });
})();