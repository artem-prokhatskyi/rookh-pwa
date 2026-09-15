# Швидка перевірка

Найшвидший спосіб перевірити все руками — **Налаштування → Прототип → Додати демо-дані**
(36 звичок, ~6 300 записів, покриття всіх сценаріїв маніфесту), а потім пройтись екранами.
Скрипти нижче роблять те саме програмно.

Відкрийте додаток, відкрийте консоль браузера (Safari: Розробка → ваш пристрій)
і вставте скрипти нижче. Обидва нічого не псують: створені для перевірки звички
видаляються наприкінці, у IndexedDB не потрапляють.

## 1. Двигун цілей — перевірка значень

```js
const s = await import('./js/state.js'), eng = await import('./js/engine.js'), u = await import('./js/util.js');
const fails = [], eq = (n,a,b) => { if (JSON.stringify(a)!==JSON.stringify(b)) fails.push(`${n}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`); };
const T = eng.TODAY();
const mk = (over, logs) => { const h = s.newHabit(over); h.logs = (logs||[]).map((l,i)=>({id:'x'+i,habitId:h.id,ts:u.parseK(l.d).setHours(10,i),date:l.d,value:l.v??null,note:'',photoId:null,retro:false,edited:false,early:null,deleted:!!l.del})); s.indexHabit(h); return h; };
const G = (o={}) => Object.assign({kind:'min',n:1,period:'day',everyN:3,intervalH:8,tolH:1,second:null}, o);
const SC = { days:null, start:u.addDays(T,-30), end:null };

let h = mk({type:'check', goal:G({n:2}), schedule:SC}, [{d:T}]);
eq('1 незакрито', eng.progress(h,T).done, false);
h = mk({type:'check', goal:G({n:2}), schedule:SC}, [{d:T},{d:T}]);
eq('2 закрито', eng.progress(h,T).done, true);
h = mk({type:'check', goal:G({kind:'max',n:1,period:'week'}), schedule:SC}, [{d:T},{d:T}]);
eq('3 максимум перевищено', eng.progress(h,T).over, true);
h = mk({type:'qty', unit:'мл', goal:G({n:2000}), schedule:SC}, [{d:T,v:250},{d:T,v:500}]);
eq('4 сума', eng.progress(h,T).sum, 750);
h = mk({type:'time', goal:G({n:240,second:{n:5}}), schedule:SC}, [{d:T,v:60},{d:T,v:60},{d:T,v:60}]);
eq('5 дві умови', Math.round(eng.progress(h,T).pct*100), 60);
h = mk({type:'check', goal:G(), schedule:SC}, [{d:T,del:true}]);
eq('6 видалений лог', eng.progress(h,T).done, false);
h = mk({type:'check', goal:G({period:'everyN',everyN:3}), schedule:{days:null,start:u.addDays(T,-6),end:null}}, []);
eq('7 період everyN', eng.periodOf(h,u.addDays(T,-1)).start, u.addDays(T,-3));
h = mk({type:'check', goal:G(), schedule:{days:[u.dow(T)],start:u.addDays(T,-10),end:null}}, []);
eq('8 розклад', [eng.isScheduled(h,T), eng.isScheduled(h,u.addDays(T,1))], [true,false]);
h.paused = {since:u.addDays(T,-1),until:u.addDays(T,2)};
eq('9 пауза', eng.isScheduled(h,T), false);
h.paused = null; h.schedule.days = null; h.time.retro = 3;
eq('10 ретро', [eng.canRetro(h,u.addDays(T,-3)), eng.canRetro(h,u.addDays(T,-4))], [true,false]);
h = mk({type:'check', goal:G({period:'interval'}), schedule:SC}, []);
const now = Date.now();
h.logs = [{id:'i',habitId:h.id,ts:now-3*36e5,date:T,value:null,note:'',photoId:null,retro:false,edited:false,early:null,deleted:false}]; s.indexHabit(h);
eq('11 інтервал', [eng.intervalState(h,now).phase, eng.intervalState(h,now+4.5*36e5).phase, eng.intervalState(h,now+7*36e5).phase], ['early','ready','late']);
h.time.window = {from:'22:00',to:'02:00'};
eq('12 вікно через північ', eng.inWindow(h,new Date(2026,0,1,1,0)), true);
const de = s.settings.dayEnd; s.settings.dayEnd='04:00'; s.bump();
eq('13 межа доби', eng.logicalTodayAt(new Date(2026,8,15,1,30)), '2026-09-14');
s.settings.dayEnd = de; s.bump();
console.log(fails.length ? fails : 'усі перевірки пройдено');
```

## 2. Комбінаторний прогін екранів

Створює звички на всі комбінації «тип цілі × період × тип значення» плюс вікна,
паузи, вимоги нотатки/фото — і рендерить для кожної всі екрани й листи.

```js
const s = await import('./js/state.js'), eng = await import('./js/engine.js'), u = await import('./js/util.js');
const H = await import('./js/render/habit.js'), T = await import('./js/render/today.js'), S = await import('./js/render/stats.js');
const E = await import('./js/render/editor.js'), SH = await import('./js/render/sheets.js'), R = await import('./js/render/index.js');
const made = [], errs = [], t = (n,f) => { try { f(); } catch(e) { errs.push(n+' :: '+e.message); } };
let n = 0;
for (const kind of ['min','exact','max','none']) for (const period of ['day','week','month','everyN','interval']) for (const type of ['check','qty','time']) {
  if (period === 'interval' && (type !== 'check' || kind !== 'min')) continue;
  const h = s.newHabit({
    name:`T${n++} ${kind}/${period}/${type}`, type, unit: type==='qty'?'мл':'', presets: type==='check'?[]:[10,25],
    goal:{kind,n:type==='time'?30:(type==='qty'?500:2),period,everyN:3,intervalH:8,tolH:1,second:(type!=='check'&&kind==='min'&&period!=='interval')?{n:3}:null},
    schedule:{days:n%3===0?[0,2,4]:null,start:u.addDays(eng.TODAY(),-40),end:n%5===0?u.addDays(eng.TODAY(),10):null},
    time:{window:n%4===0?{from:'22:00',to:'00:00'}:null,retro:n%2?'yesterday':3},
    tags:['тест'], requireNote:n%7===0, requirePhoto:n%11===0,
    paused:n%9===0?{since:u.addDays(eng.TODAY(),-2),until:u.addDays(eng.TODAY(),3)}:null,
  });
  for (let i=0;i<25;i++) { if ((i*7+n)%3===0) continue; const d=u.addDays(eng.TODAY(),-i);
    h.logs.push({id:'tl'+n+'-'+i,habitId:h.id,ts:u.parseK(d).setHours(9+(i%8),15),date:d,value:type==='check'?null:(10+i),note:i%4?'':'нотатка',photoId:null,retro:i%6===0,edited:false,early:null,deleted:i%13===0}); }
  h.logs.sort((a,b)=>a.ts-b.ts); s.indexHabit(h); h.order = 1000+n; s.habits.push(h); made.push(h);
}
s.bump();
for (const h of made) {
  t('row '+h.name, () => eng.rowState(h)); t('page '+h.name, () => H.renderHabit(h));
  t('streak '+h.name, () => eng.streaks(h)); t('cells '+h.name, () => { for (let i=0;i<90;i++) eng.dayCell(h,u.addDays(eng.TODAY(),-i)); });
  s.ui.editor = {draft:s.cloneHabit(h),mode:'edit',pop:null,remIdx:null,dirty:false,focusName:false,endMode:null,recipe:null};
  t('editor '+h.name, () => E.renderEditor());
  for (const sub of ['schedule','time','reminders','extra','look']) t('sub '+sub, () => E.renderSub({id:'x',t:'sub',sub}));
  s.ui.editor = null;
  t('qty '+h.name, () => SH.renderSheet({id:'q',t:'qty',hid:h.id,value:5,showNote:true,photoId:null,date:u.addDays(eng.TODAY(),-1)}));
}
t('today', () => T.renderToday()); t('stats', () => S.renderStats());
made.forEach(h => { const i = s.habits.indexOf(h); if (i>=0) s.habits.splice(i,1); });
s.bump(); R.render();
console.log(errs.length ? errs : `прогін ${made.length} звичок — помилок немає`);
```
