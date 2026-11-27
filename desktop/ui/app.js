const undoButton=$('undoCompletion')
let lastCompletion=null, undoTimer
function clearCompletionUndo(){
 clearTimeout(undoTimer)
 lastCompletion=null
 undoButton.hidden=true
}
function setTaskDone(task,done){
 if(Boolean(task.done)===done)return
 task.done=done
 if(done){
  clearCompletionUndo()
  lastCompletion={id:task.id,expires:Date.now()+10000}
  undoButton.setAttribute('aria-label','撤回完成：'+task.name)
  undoButton.hidden=false
  undoTimer=setTimeout(clearCompletionUndo,10000)
 }else if(lastCompletion?.id===task.id)clearCompletionUndo()
}
undoButton.onclick=()=>{
 const recent=lastCompletion
 clearCompletionUndo()
 if(!recent || Date.now()>=recent.expires)return
 const task=db.items.find(t=>t.id===recent.id)
 if(task?.done){setTaskDone(task,false);save()}
}
function completionControl(task,calendar=false){
 const control=calendar?el('input','calendar-check'):el('button','complete-task',task.done?'已完成':'完成')
 control.setAttribute('aria-label',(task.done?'取消完成：':'完成：')+task.name)
 const toggle=()=>{setTaskDone(task,!task.done);save()}
 if(calendar){
  control.type='checkbox'
  control.checked=Boolean(task.done)
  control.onpointerdown=e=>e.stopPropagation()
  control.onclick=e=>e.stopPropagation()
  control.onchange=toggle
 }else{
  control.type='button'
  control.setAttribute('aria-pressed',String(Boolean(task.done)))
  control.onclick=toggle
 }
 return control
}
function render(){
 renderCategoryTags()
 const monthly=mode==='calendar', title=monthly?'日程日历':'任务总览'
 $('title').textContent=$('where').textContent=title
 $('calendar').className=monthly?'active':'';$('tasks').className=monthly?'':'active'
 $('month').textContent=monthly?cursor.getFullYear()+'年 '+(cursor.getMonth()+1)+'月':'全部任务'
 for(const id of ['prev','next','today'])$(id).hidden=!monthly
 const periods=document.getElementById("periods");periods.hidden=!monthly
 for(const btn of periods.children){btn.setAttribute('aria-pressed',String(period===btn.dataset.period))}
 const unit={day:'一天',threeDays:'三天',week:'一周',month:'一个月'}[period]
 $('prev').setAttribute('aria-label','向前'+unit);$('next').setAttribute('aria-label','向后'+unit)
 const items=db.items.filter(t=>effectiveState(t.cat)!=='hidden')
 const view=$('view')
 const previous=view.querySelector('.time-scroll')
 if(previous)timelineLeft=previous.scrollLeft
 view.replaceChildren();view.className=monthly?'grid':''
 if(!monthly){
  for(const t of items.slice().sort((a,b)=>a.date.localeCompare(b.date)||(a.start??-1)-(b.start??-1))){
   const row=el('div',effectiveState(t.cat)==='muted'?'row muted-row':'row')
   const name=el('button',t.done?'finished':'',t.name)
   name.onclick=()=>edit(t)
   const badge=el('span','category-badge',db.cats[t.cat])
   styleCategory(badge,t.cat)
   row.append(name,badge,el('small','',t.date+' '+range(t)),completionControl(t))
   view.append(row)
  }
  if(!items.length)view.append(el('p','','暂无任务'))
  return
 }
 if(period!=='month'){renderTimeline(view,items);return}
 for(const day of '一二三四五六日')view.append(el('div','weekday','周'+day))
 const offset=(new Date(cursor.getFullYear(),cursor.getMonth(),1).getDay()+6)%7,total=new Date(cursor.getFullYear(),cursor.getMonth()+1,0).getDate()
 for(let i=0;i<Math.ceil((offset+total)/7)*7;i++){const d=new Date(cursor.getFullYear(),cursor.getMonth(),1+i-offset),date=key(d),cell=el('div','cell'+(d.getMonth()!==cursor.getMonth()?' off':''));cell.append(el('span','num'+(date===key(now)?' current':''),d.getDate()))
 cell.onclick=()=>edit(null,date)
 cell.dataset.date=date
 for(const part of daySegments(items,date).sort((a,b)=>(a.start??-1)-(b.start??-1))){
  const b=eventButton(part.task,false,part.offset)
  bindTaskDrag(b,()=>{
   let selected=cell,target=null
   return {
    move(point){
     selected.classList.remove('over')
     const hit=document.elementFromPoint(point.clientX,point.clientY)?.closest('.cell')
     target=hit?chooseDay(selected,hit,point):null
     if(target){selected=target;selected.classList.add('over')}
    },
    finish(commit){
     selected.classList.remove('over')
     if(commit && target){part.task.date=shiftDate(target.dataset.date,-part.offset/1440);save()}
    }
   }
  })
  cell.append(b)
 }
 view.append(cell)}
}
function shiftDate(date,days){
 const d=new Date(date+'T12:00:00')
 d.setDate(d.getDate()+days)
 return key(d)
}
function daySegments(items,date){
 const yesterday=shiftDate(date,-1)
 const parts=[]
 for(const task of items){
  if(task.date===date)parts.push({task,offset:0,start:task.start,end:Math.min(task.end,1440)})
  else if(task.date===yesterday && task.end>1440)parts.push({task,offset:1440,start:0,end:task.end-1440})
 }
 return parts
}
function edit(t,date,minute=540){
 editing=t
 const start=t?.start??minute
 $('allDay').checked=t?t.start==null:false
 $('startTime').value=clock(start)
 $('endTime').value=clock(t?.end??(start+60))
 $('endTime').setCustomValidity('')
 updateTimeFields()
 $('nameField').value=t?.name||'';$('dateField').value=t?.date||date||key(now)
 $('catField').replaceChildren(...db.cats.map((name,i)=>new Option(name,i)))
 $('catField').value=t?.cat??(listLayout?currentTag:null)??0
 $('done').checked=t?.done||false;$('del').hidden=!t;$('editor').showModal()}
$('form').onsubmit=e=>{e.preventDefault();const name=$('nameField').value.trim();if(!name){$('nameField').focus();return}const data={name,date:$('dateField').value,cat:+$('catField').value};if($('allDay').checked){data.start=null;data.end=null}
 else{
  data.start=minutes($('startTime').value)
  data.end=minutes($('endTime').value)
  if(data.end<=data.start)data.end+=1440
 }
 const task=editing || {id:crypto.randomUUID(),done:false}
 Object.assign(task,data)
 if(!editing)db.items.push(task)
 setTaskDone(task,$('done').checked)
 $('editor').close();save()}
$('del').onclick=()=>{if(confirm('删除这个任务？')){if(lastCompletion?.id===editing.id)clearCompletionUndo();db.items=db.items.filter(t=>t!==editing);$('editor').close();save()}}
$('cancel').onclick=()=>$('editor').close();$('newTask').onclick=()=>edit(null,mode==='calendar'?key(cursor):key(now))
for(const id of ['calendar','tasks'])$(id).onclick=()=>{mode=id;render()}
for(const button of $('periods').children)button.onclick=()=>setPeriod(button.dataset.period)
function setPeriod(value){
 period=value
 localStorage.setItem('dayfolio.view',value)
 render()
}
for(const [id,step] of [['prev',-1],['next',1]])$(id).onclick=()=>{
 if(period==='month'){
  const day=cursor.getDate()
  cursor.setDate(1)
  cursor.setMonth(cursor.getMonth()+step)
  cursor.setDate(Math.min(day,new Date(cursor.getFullYear(),cursor.getMonth()+1,0).getDate()))
 }else cursor.setDate(cursor.getDate()+step*timelineDays[period])
 render()
}
$('today').onclick=()=>{cursor=new Date();render()}
const visibilitySlider=$('mutedVisibility')
const storedVisibility=Number(localStorage.getItem('dayfolio.mutedVisibility')??30)
visibilitySlider.value=Number.isFinite(storedVisibility)?storedVisibility:30
function applyMutedVisibility(){
 const value=visibilitySlider.valueAsNumber
 document.documentElement.style.setProperty('--muted-opacity',String(0.05+0.95*value/100))
 $('visibilityValue').value=value+'%'
}
applyMutedVisibility()
visibilitySlider.oninput=()=>{
 applyMutedVisibility()
 localStorage.setItem('dayfolio.mutedVisibility',visibilitySlider.value)
}
$('openSettings').onclick=()=>{
 const category=db.cats.findIndex((_,i)=>effectiveState(i)==='muted')
 const sample=$('mutedSample')
 styleCategory(sample,Math.max(0,category))
 sample.classList.add('muted-category')
 $('displaySettings').showModal()
}
$('closeSettings').onclick=()=>$('displaySettings').close()
render()

function toggleNight(){
 nightFolded=!nightFolded
 localStorage.setItem('dayfolio.foldNight',String(nightFolded))
 render()
}

// Outside the folded band, one minute occupies one pixel.
function timeY(minute){
 if(!nightFolded || minute<=nightStart)return minute
 if(minute>=nightEnd)return nightStart+foldedHeight+minute-nightEnd
 return nightStart+(minute-nightStart)*foldedHeight/(nightEnd-nightStart)
}
function timeAt(y){
 if(!nightFolded || y<=nightStart)return y
 if(y>=nightStart+foldedHeight)return nightEnd+y-nightStart-foldedHeight
 return nightStart+(y-nightStart)*(nightEnd-nightStart)/foldedHeight
}
function positionTask(button,task){
 button.style.top=timeY(task.start)+'px'
 button.style.height=(timeY(task.end)-timeY(task.start))+'px'
}

function clock(minute){
 const value=minute%1440
 return String(Math.floor(value/60)).padStart(2,'0')+':'+String(value%60).padStart(2,'0')
}
function minutes(value){const [hour,minute]=value.split(':').map(Number);return hour*60+minute}
function range(t){return t.start==null?'全天':clock(t.start)+'–'+(t.end>1440?'次日 ':'')+(t.end===1440?'24:00':clock(t.end))}
function updateTimeFields(){
 const hide=$('allDay').checked
 $('times').hidden=hide
 for(const id of ['startTime','endTime'])$(id).disabled=hide
 $('nextDay').hidden=hide || !$('endTime').value || !$('startTime').value || $('endTime').value>$('startTime').value
}
$('allDay').onchange=updateTimeFields
for(const id of ['startTime','endTime'])$(id).oninput=updateTimeFields
function eventButton(t,timed=false,offset=0){
 const b=el('div','event'+(t.done?' finished':''))
 b.dataset.taskId=t.id
 styleCategory(b,t.cat)
 const open=el('button','event-open')
 open.type='button'
 open.setAttribute('aria-label',t.name+' '+range(t))
 if(timed)open.append(el('strong','',t.name),el('span','event-time',range(t)))
 else open.textContent=(offset?'续至 '+clock(t.end)+' ':t.start==null?'':clock(t.start)+' ')+t.name
 b.append(completionControl(t,true),open)
 b.onclick=e=>{e.stopPropagation();edit(t)}
 return b
}
