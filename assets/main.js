/* активный пункт меню по адресу страницы */
(function(){
  var page=(location.pathname.split('/').pop()||'index.html');
  document.querySelectorAll('.nav-links a').forEach(function(a){
    a.classList.toggle('active',a.getAttribute('href')===page);
  });
})();

var burger=document.querySelector('.nav-burger'),links=document.querySelector('.nav-links');
if(burger&&links){burger.addEventListener('click',function(){
  burger.classList.toggle('open');links.classList.toggle('open');});}

/* градиентные пятна реагируют на курсор */
document.addEventListener('mousemove',function(e){
  var x=(e.clientX/window.innerWidth-.5),y=(e.clientY/window.innerHeight-.5);
  document.querySelectorAll('.orb').forEach(function(o,i){
    var k=(i+1)*16;
    o.style.transform='translate('+(x*k)+'px,'+(y*k)+'px)';
  });
});


/* ---- форма ---- */
var form=document.querySelector('#contact-form');
var agree=document.getElementById('agree');
var submitBtn=document.getElementById('submitBtn');
if(agree&&submitBtn){
  agree.addEventListener('change',function(){submitBtn.disabled=!agree.checked;});
}



/* ---- лайтбокс слайдов ---- */
(function(){
  var lb=document.getElementById('lightbox');
  if(!lb)return;
  var img=lb.querySelector('img');
  document.querySelectorAll('.slide').forEach(function(s){
    s.addEventListener('click',function(){
      var src_img=s.querySelector('img');
      img.src=src_img.src;
      img.alt=src_img.alt;
      lb.classList.add('open');
      document.body.style.overflow='hidden';
    });
  });
  function close(){lb.classList.remove('open');document.body.style.overflow='';}
  lb.addEventListener('click',close);
  document.addEventListener('keydown',function(e){if(e.key==='Escape')close();});
})();

/* ---- бриф ---- */
(function(){
  var root=document.getElementById('page-brief');
  if(!root)return;
  root.querySelectorAll('[data-brief]').forEach(function(cb){
    cb.addEventListener('change',function(){
      var b=root.querySelector('[data-bblock="'+cb.dataset.brief+'"]');
      if(b)b.hidden=!cb.checked;
    });
  });
  var ag=document.getElementById('b-agree'),bt=document.getElementById('briefBtn');
  if(ag&&bt)ag.addEventListener('change',function(){bt.disabled=!ag.checked;});
})();

/* ---- калькулятор ---- */
(function(){
  var root=document.getElementById('page-pricing');
  if(!root)return;
  var fmt=function(n){return n.toLocaleString('ru-RU').replace(/,/g,' ')+' ₽';};
  var svcInputs=root.querySelectorAll('[data-svc]');
  var linesEl=document.getElementById('calcLines');
  var sumEl=document.getElementById('calcSum');
  var presQty=document.getElementById('presQty'), presQtyVal=document.getElementById('presQtyVal');
  var aiQty=document.getElementById('aiQty'), aiQtyVal=document.getElementById('aiQtyVal');
  var names={site:'Сайт',logo:'Логотип и айдентика',pres:'Презентация',text:'Тексты и пиар',ai:'ИИ и процессы'};

  function plural(n,forms){
    var n10=n%10,n100=n%100;
    if(n10===1&&n100!==11)return forms[0];
    if(n10>=2&&n10<=4&&(n100<10||n100>=20))return forms[1];
    return forms[2];
  }

  function active(svc){
    var el=root.querySelector('[data-svc="'+svc+'"]');
    return el&&el.checked;
  }

  function recalc(){
    var lines=[],total=0,custom=false;

    ['site','logo','pres','text','ai'].forEach(function(svc){
      var block=root.querySelector('[data-block="'+svc+'"]');
      if(block)block.hidden=!active(svc);
    });

    if(active('site')){
      var r=root.querySelector('input[name="site"]:checked');
      var v=parseInt(r.value,10);
      if(r.dataset.custom){custom=true;lines.push(['Сайт',null]);}
      else{total+=v;lines.push([r.closest('.opt').querySelector('.t').childNodes[0].textContent.trim(),v]);}
    }
    if(active('logo')){
      var lr=root.querySelector('input[name="logo"]:checked');
      var lv=parseInt(lr.value,10);total+=lv;
      lines.push([lr.closest('.opt').querySelector('.t').childNodes[0].textContent.trim(),lv]);
    }
    if(active('pres')){
      var pr=root.querySelector('input[name="pres"]:checked');
      var q=parseInt(presQty.value,10);
      var pv=parseInt(pr.value,10)*q;total+=pv;
      lines.push(['Презентация, '+q+' '+plural(q,['слайд','слайда','слайдов']),pv]);
    }
    if(active('text')){
      root.querySelectorAll('[data-add="text"]:checked').forEach(function(a){
        var av=parseInt(a.value,10);total+=av;
        lines.push([a.closest('.opt').querySelector('.t').childNodes[0].textContent.trim(),av]);
      });
    }
    if(active('ai')){
      var h=parseInt(aiQty.value,10);
      var hv=h*3000;total+=hv;
      lines.push(['Консультации, '+h+' '+plural(h,['час','часа','часов']),hv]);
      root.querySelectorAll('[data-add="ai"]:checked').forEach(function(a){
        var av=parseInt(a.value,10);total+=av;
        lines.push([a.closest('.opt').querySelector('.t').childNodes[0].textContent.trim(),av]);
      });
    }

    var urgent=document.getElementById('urgent').checked;
    var english=document.getElementById('english').checked;
    var mult=1;
    if(urgent)mult+=0.3;
    if(english)mult+=0.2;
    if(mult!==1&&total>0){
      var extra=Math.round(total*(mult-1)/500)*500;
      if(urgent&&english)lines.push(['Срочно и на английском',extra]);
      else if(urgent)lines.push(['Срочная работа',extra]);
      else lines.push(['Материалы на английском',extra]);
      total+=extra;
    }

    linesEl.innerHTML = lines.length
      ? lines.map(function(l){
          return '<li><span>'+l[0]+'</span><b>'+(l[1]===null?'обсуждаем':fmt(l[1]))+'</b></li>';
        }).join('')
      : '<li class="empty-line">Выберите направления слева, и расчет появится здесь.</li>';

    sumEl.textContent = total>0 ? (custom?'от '+fmt(total):fmt(total)) : (custom?'обсуждаем':'0 ₽');
  }

  if(presQty)presQty.addEventListener('input',function(){
    var q=parseInt(presQty.value,10);
    presQtyVal.textContent=q+' '+plural(q,['слайд','слайда','слайдов']);
    recalc();});
  if(aiQty)aiQty.addEventListener('input',function(){
    var h=parseInt(aiQty.value,10);
    aiQtyVal.textContent=h+' '+plural(h,['час','часа','часов']);
    recalc();});
  root.addEventListener('change',recalc);
  recalc();
})();

/* ---- отправка форм ---- */
(function(){
  function collect(form){
    var out=[],seen={};
    form.querySelectorAll('input,select,textarea').forEach(function(el){
      if(!el.name||el.type==='hidden'&&el.name!=='Страница')return;
      if((el.type==='checkbox'||el.type==='radio')&&!el.checked)return;
      var v=(el.value||'').trim(); if(!v)return;
      var key=el.name;
      if(seen[key]!==undefined){out[seen[key]][1]+=', '+v;}
      else{seen[key]=out.length;out.push([key,v]);}
    });
    return out;
  }
  function send(form,kind){
    var btn=form.querySelector('[type="submit"]');
    var ok=form.querySelector('.form-success');
    var trap=form.querySelector('input[name="website"]');
    if(trap&&trap.value)return;               /* ловушка для спам-ботов */
    var fields=collect(form);
    var cfg=window.SITE_CONFIG||{};
    function done(){ if(ok){ok.style.display='block';ok.scrollIntoView({behavior:'smooth',block:'center'});} form.reset(); if(btn)btn.disabled=true; }
    if(cfg.FORM_ENDPOINT){
      if(btn)btn.disabled=true;
      fetch(cfg.FORM_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({kind:kind,page:location.href,fields:fields})})
      .then(function(r){ if(!r.ok)throw new Error(r.status); done(); })
      .catch(function(){ if(btn)btn.disabled=false; mail(); });
    } else { mail(); done(); }
    function mail(){
      var body=fields.map(function(f){return f[0]+': '+f[1];}).join('\n');
      location.href='mailto:'+(cfg.EMAIL||'')+'?subject='+encodeURIComponent(kind==='brief'?'Бриф с сайта':'Заявка с сайта')+'&body='+encodeURIComponent(body);
    }
  }
  [['contact-form','contact'],['brief-form','brief']].forEach(function(p){
    var f=document.getElementById(p[0]); if(!f)return;
    f.addEventListener('submit',function(e){e.preventDefault();send(f,p[1]);});
  });
})();
