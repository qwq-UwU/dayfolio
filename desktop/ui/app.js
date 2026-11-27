function taskListOrder(a,b){
 return Number(!!a.done)-Number(!!b.done) || (a.done && b.done ? (a.completedAt??0)-(b.completedAt??0) : 0)
  || a.date.localeCompare(b.date) || (a.start??-1)-(b.start??-1)
}
function setTaskDone(task,done){
 if(Boolean(task.done)===done)return
 task.done=done
 if(done){
  removeTaskFromOrder(task)
  task.completedAt=Date.now()
 }
 else delete task.completedAt
}
function completionControl(task,calendar=false){
 const control=el('button',calendar?'complete-dot calendar-check':'complete-dot')
 control.type='button'
 control.setAttribute('aria-label',(task.done?'已完成：':'完成：')+task.name)
 control.disabled=Boolean(task.done)
 control.onpointerdown=e=>e.stopPropagation()
 control.onclick=e=>{e.stopPropagation();setTaskDone(task,true);save()}
 return control
}
function restoreButton(task){
 const button=el('button','restore-task','恢复任务')
 button.type='button'
 button.setAttribute('aria-label','恢复任务：'+task.name)
 button.onclick=()=>{setTaskDone(task,false);save()}
 return button
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
  for(const t of items.slice().sort(taskListOrder)){
   const row=el('div',effectiveState(t.cat)==='muted'?'row muted-row':'row')
   row.dataset.taskId=t.id
   const name=el('button',t.done?'finished':'',t.name)
   name.onclick=()=>edit(t)
   const badge=el('span','category-badge',t.cat==null?'未分类':tagAncestors('t:'+t.cat).map(k=>db.cats[k.slice(2)]).join(' / '))
   styleCategory(badge,t.cat)
   row.append(name,badge,el('small','',t.date+' '+range(t)),t.done?restoreButton(t):completionControl(t))
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
function edit(t,date,minute=540,category=listLayout && currentTag?Number(currentTag.slice(2)):db.cats.length?0:''){
 editing=t
 const start=t?.start??minute
 $('allDay').checked=t?t.start==null:false
 $('startTime').value=clock(start)
 $('endTime').value=clock(t?.end??(start+60))
 $('endTime').setCustomValidity('')
 updateTimeFields()
 $('nameField').value=t?.name||'';$('dateField').value=t?.date||date||key(now)
 tagOptions($('catField'),t?(t.cat??''):category,null,true)
 $('done').checked=Boolean(t?.done)
 $('done').parentElement.hidden=Boolean(t?.done)
 $('restoreTask').hidden=!t?.done
 $('del').hidden=!t
 $('editor').querySelector('h2').textContent=t?'任务详情':'新建任务'
 $('editor').showModal()
 $('nameField').focus()
}
$('form').onsubmit=e=>{e.preventDefault();const name=$('nameField').value.trim();if(!name){$('nameField').focus();return}const cat=$('catField').value;const data={name,date:$('dateField').value,cat:cat===''?null:Number(cat)};if($('allDay').checked){data.start=null;data.end=null}
 else{
  data.start=minutes($('startTime').value)
  data.end=minutes($('endTime').value)
  if(data.end<=data.start)data.end+=1440
 }
 const task=editing || {id:crypto.randomUUID(),done:false}
 if(editing && task.cat!==data.cat)removeTaskFromOrder(task)
 Object.assign(task,data)
 if(!editing)db.items.push(task)
 setTaskDone(task,$('done').checked)
 const previousTag=currentTag
 if(!editing && task.cat==null && listLayout && currentTag)enterTag('')
 $('editor').close();save({previousTag})}
$('restoreTask').onclick=()=>{
 if(!editing?.done)return
 setTaskDone(editing,false)
 $('done').checked=false
 $('done').parentElement.hidden=false
 $('restoreTask').hidden=true
 save()
}
function deleteTask(task){
 if(!task || (!task.done && !confirm('删除任务「'+task.name+'」？')))return
 removeTaskFromOrder(task)
 db.items=db.items.filter(t=>t.id!==task.id)
 if($('editor').open && editing===task)$('editor').close()
 save()
}
function newTaskForTag(category=''){
 edit(null,key(mode==='calendar'?cursor:now),540,category)
}
$('del').onclick=()=>deleteTask(editing)
$('cancel').onclick=()=>$('editor').close()
$('newTask').onclick=()=>newTaskForTag('')
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
