const $ = id => document.getElementById(id)
const now = new Date()
let cursor = new Date(now)
let period = localStorage.getItem('dayfolio.view') || 'month'
const timelineDays = {day:1, threeDays:3, week:7}
const foldedHeight=30
const savedEnd=Number(localStorage.getItem('dayfolio.nightEnd'))
let nightEnd=savedEnd>=60 && savedEnd<=1440 && savedEnd%60===0?savedEnd:360
const savedStart=Number(localStorage.getItem('dayfolio.nightStart')??60)
let nightStart=savedStart>=0 && savedStart<nightEnd && savedStart%60===0?savedStart:Math.min(60,nightEnd-60)
let nightFolded=localStorage.getItem('dayfolio.foldNight')==='true'
let timelineScroll = 8 * 60
let timelineLeft = 0
const snapStep = 15
const key = d => [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-')
const colors = [['#e0eee4','#65a37c'],['#e7edf7','#819dc0'],['#f6e9dc','#c69a66'],['#ece6f5','#a28cbb']]
const seed = [
 [2,'制定本月计划',0],[4,'阅读与笔记',3],[6,'项目进度同步',1],[9,'设计方案评审',1],[11,'整理书单',3],[14,'周末徒步',2],[17,'产品迭代讨论',0],[19,'课程学习',3],[22,'家庭聚餐',2],[24,'更新项目文档',0],[26,'团队周会',1],[27,'月度工作复盘',0],[28,'公园慢跑',2]]
let db = JSON.parse(localStorage.getItem('dayfolio.v1') || 'null') || {cats:['专注工作','会议沟通','生活日常','学习阅读'],items:seed.map(([day,name,cat],i)=>({id:String(i),name,cat,date:key(new Date(now.getFullYear(),now.getMonth(),day)),start:540+(i%5)*75,end:600+(i%5)*75,done:false}))}
let mode='calendar',editing=null
db.folders??=[]
db.categoryParents??={}
db.treeOrder??={}
if(db.lists){
 delete db.lists
 for(const task of db.items)delete task.list
}
if(!db.categoryStates){
 db.categoryStates={}
 for(const [category] of db.cats.entries()){
  const members=db.items.filter(task=>task.cat===category)
  const hidden=db.hiddenCategories?.includes(category)??(members.length>0 && members.every(task=>task.hidden))
  if(hidden)db.categoryStates[category]='hidden'
 }
 delete db.hiddenCategories
 for(const task of db.items)delete task.hidden
}
function categoryColors(category){
 const accent=db.categoryAccents?.[category]
 if(accent)return [accent,'color-mix(in srgb, '+accent+' 72%, #385044)']
 if(colors[category])return colors[category]
 const hue=(345+(category-colors.length)*137.508)%360
 return ['hsl('+hue+' 48% 93%)','hsl('+hue+' 39% 52%)']
}
function styleCategory(node,category){
 const [bg,ink]=categoryColors(category)
 node.classList.toggle('muted-category',effectiveState(category)==='muted')
 node.style.setProperty('--bg',bg)
 node.style.setProperty('--ink',ink)
 const custom=db.categoryAccents?.[category]
 node.style.removeProperty('color')
 if(custom){
  const channels=custom.slice(1).match(/../g).map(hex=>{
   const s=parseInt(hex,16)/255
   return s<=0.04045?s/12.92:((s+0.055)/1.055)**2.4
  })
  const luminance=channels[0]*0.2126+channels[1]*0.7152+channels[2]*0.0722
  node.style.color=luminance<0.179?'white':'#101510'
 }
}
function el(tag,cls,txt){const n=document.createElement(tag);n.className=cls;if(txt!==undefined)n.textContent=txt;return n}
function save(){localStorage.setItem('dayfolio.v1',JSON.stringify(db));render()}
const stateLabels={inherit:'取消统一设置',shown:'统一显示',muted:'统一淡化',hidden:'统一隐藏'}
let listLayout=localStorage.getItem('dayfolio.folderLayout')==='list'
let currentFolder=localStorage.getItem('dayfolio.openFolder')||''
let currentTag=null
const expandedTags=new Set()
if(!db.folders.some(f=>f.id===currentFolder))currentFolder=''
function enterFolder(id){
 currentTag=null
 currentFolder=id
 localStorage.setItem('dayfolio.openFolder',id)
 $('taskTags').scrollTop=0
 renderCategoryTags()
}
for(const button of $('folderLayout').children)button.onclick=()=>{
 listLayout=button.value==='list'
 localStorage.setItem('dayfolio.folderLayout',button.value)
 renderCategoryTags()
}
function orderedChildren(parent){
 const keys=db.folders.filter(f=>f.parent===parent).map(f=>'f:'+f.id)
 db.cats.forEach((_,i)=>{if((db.categoryParents[i]??'')===parent)keys.push('t:'+i)})
 const saved=db.treeOrder[parent]??[]
 return [...saved.filter(key=>keys.includes(key)),...keys.filter(key=>!saved.includes(key))]
}
function setTreeWidth(wide){
 document.body.classList.toggle('wide-tree',wide)
 $('treeWidth').textContent=wide?'收起':'放大'
 $('treeWidth').setAttribute('aria-pressed',String(wide))
 localStorage.setItem('dayfolio.wideTree',String(wide))
}
const split=$('panelDivider')
const narrow=matchMedia('(max-width:760px)')
function setSplit(percent){
 const value=Math.max(25,Math.min(75,Math.round(percent)))
 document.body.style.setProperty('--panel-size',value+'%')
 document.body.style.setProperty('--panel-height',value+'dvh')
 split.setAttribute('aria-valuenow',value)
}
function setupSplit(){
 split.setAttribute('aria-orientation',narrow.matches?'horizontal':'vertical')
 setSplit(Number(localStorage.getItem('dayfolio.splitPercent')??50))
}
setupSplit()
narrow.addEventListener('change',setupSplit)
const rememberSplit=()=>localStorage.setItem('dayfolio.splitPercent',split.getAttribute('aria-valuenow'))
split.onpointerdown=e=>{
 if(!e.isPrimary || e.button!==0)return
 e.preventDefault()
 split.setPointerCapture(e.pointerId)
 const start=narrow.matches?e.clientY:e.clientX
 const value=Number(split.getAttribute('aria-valuenow'))
 const extent=narrow.matches?innerHeight:document.documentElement.clientWidth
 split.onpointermove=p=>{
  if(p.pointerId===e.pointerId)setSplit(value+100*((narrow.matches?p.clientY:p.clientX)-start)/extent)
 }
 const finish=p=>{
  if(p.pointerId!==e.pointerId)return
  split.onpointermove=split.onpointerup=split.onpointercancel=split.onlostpointercapture=null
  if(p.type==='pointerup')rememberSplit()
  else setSplit(value)
 }
 split.onpointerup=split.onpointercancel=split.onlostpointercapture=finish
}
split.onkeydown=e=>{
 const keys=narrow.matches?['ArrowUp','ArrowDown']:['ArrowLeft','ArrowRight']
 if(!keys.includes(e.key))return
 e.preventDefault()
 setSplit(Number(split.getAttribute('aria-valuenow'))+(e.key===keys[0]?-2:2))
 rememberSplit()
}
$('treeWidth').onclick=()=>setTreeWidth(!document.body.classList.contains('wide-tree'))
setTreeWidth(localStorage.getItem('dayfolio.wideTree')==='true')
function effectiveState(category){
 let state=db.categoryStates[category]??'shown'
 let id=db.categoryParents[category]
 while(id){
  const folder=db.folders.find(item=>item.id===id)
  if(!folder)break
  if(folder.state!=='inherit')state=folder.state
  id=folder.parent
 }
 return state
}
function folderOptions(select,current='',exclude=''){
 select.replaceChildren(new Option('顶层', ''))
 function visit(parent,path){
  for(const f of db.folders.filter(item=>item.parent===parent && item.id!==exclude)){
   const label=path+f.name
   select.add(new Option(label,f.id))
   visit(f.id,label+' / ')
  }
 }
 visit('','')
 select.value=current
}
let editingFolder=null
function openFolder(folder=null){
 editingFolder=folder
 $('folderTitle').textContent=folder?'编辑文件夹':'新建文件夹'
 $('folderName').value=folder?.name??''
 $('folderName').setCustomValidity('')
 folderOptions($('folderParent'),folder?.parent??(listLayout?currentFolder:''),folder?.id)
 $('folderEditor').showModal()
 $('folderName').select()
}
$('newFolder').onclick=()=>openFolder()
$('folderCancel').onclick=()=>$('folderEditor').close()
$('folderName').oninput=$('folderParent').onchange=()=>$('folderName').setCustomValidity('')
$('folderForm').onsubmit=e=>{
 e.preventDefault()
 const name=$('folderName').value.trim(),parent=$('folderParent').value
 if(!name || db.folders.some(f=>f!==editingFolder && f.parent===parent && f.name===name)){
  $('folderName').setCustomValidity(name?'同一层已有同名文件夹':'请输入文件夹名称')
  $('folderName').reportValidity()
  return
 }
 if(editingFolder)Object.assign(editingFolder,{name,parent})
 else db.folders.push({id:crypto.randomUUID(),name,parent,state:'inherit'})
 $('folderEditor').close()
 save()
}
function renderCategoryTags(){
 const host=$('taskTags')
 const scroll=host.scrollTop
 let source=null,highlight=null
 function clearMark(){if(highlight)delete highlight.dataset.drop;highlight=null}
 function stop(){
  source=null
  clearMark()
  $('categorySection').classList.remove('moving-item')
 }
 function allow(parent){
  if(!source)return false
  if(!source.folder)return true
  for(let id=parent;id;){
   if(id===source.folder.id)return false
   id=db.folders.find(f=>f.id===id)?.parent
  }
  return !db.folders.some(f=>f!==source.folder && f.parent===parent && f.name===source.folder.name)
 }
 function wireDrop(node,resolve){
  function target(e){
   if(!source)return null
   const dest=resolve(e)
   return dest.key!==source.key && allow(dest.parent)?dest:null
  }
  node.ondragover=e=>{
   clearMark()
   const dest=target(e)
   if(!dest)return
   e.preventDefault()
   e.dataTransfer.dropEffect='move'
   highlight=node
   node.dataset.drop=dest.where
  }
  node.ondragleave=e=>{if(highlight===node && !node.contains(e.relatedTarget))clearMark()}
  node.ondrop=e=>{
   const dest=target(e)
   if(!dest)return
   e.preventDefault()
   const order=orderedChildren(dest.parent).filter(key=>key!==source.key)
   const index=dest.where==='inside'?order.length:order.indexOf(dest.key)+(dest.where==='after'?1:0)
   order.splice(index,0,source.key)
   if(source.parent!==dest.parent && db.treeOrder[source.parent]){
    db.treeOrder[source.parent]=db.treeOrder[source.parent].filter(k=>k!==source.key)
   }
   db.treeOrder[dest.parent]=order
   if(source.folder)source.folder.parent=dest.parent
   else db.categoryParents[source.category]=dest.parent
   if(dest.where==='inside' && dest.parent)db.folders.find(f=>f.id===dest.parent).closed=false
   stop()
   save()
  }
 }
 function wireItem(node,item){
  node.draggable=true
  node.ondragstart=e=>{
   source=item
   e.dataTransfer.effectAllowed='move'
   e.dataTransfer.setData('text/plain',node.textContent)
   $('categorySection').classList.add('moving-item')
  }
  node.ondragend=stop
  wireDrop(node,e=>{
   const rect=node.getBoundingClientRect()
   const fraction=(e.clientY-rect.top)/rect.height
   if(item.folder && fraction>=0.22 && fraction<=0.78)return {key:item.key,parent:item.folder.id,where:'inside'}
   return {key:item.key,parent:item.parent,where:fraction<0.5?'before':'after'}
  })
 }
 wireDrop($('treeRoot'),()=>({parent:'',where:'inside'}))
 for(const button of $('folderLayout').children)button.setAttribute('aria-pressed',String((button.value==='list')===listLayout))
 host.classList.toggle('folder-list',listLayout)
 const path=$('folderPath')
 path.hidden=!listLayout
 path.replaceChildren()
 let inheritedState=null
 if(listLayout){
  if(currentTag!==null)currentFolder=db.categoryParents[currentTag]??''
  const chain=[]
  let id=currentFolder
  while(id){
   const folder=db.folders.find(f=>f.id===id)
   chain.unshift(folder)
   id=folder.parent
  }
  for(const folder of [{id:'',name:'全部分类'},...chain]){
   const link=el('button','',folder.name)
   link.onclick=()=>enterFolder(folder.id)
   if(folder.id===currentFolder && currentTag===null)link.setAttribute('aria-current','location')
   wireDrop(link,()=>({parent:folder.id,where:'inside'}))
   if(path.childElementCount)path.append(el('span','','›'))
   path.append(link)
  }
  inheritedState=chain.find(f=>f.state!=='inherit')?.state
  if(currentTag!==null)path.append(el('span','','›'),el('strong','',db.cats[currentTag]))
 }
 const marks={inherit:'↳',shown:'✓',muted:'−',hidden:''}
 function taskRows(category){
  const tasks=db.items.filter(t=>t.cat===category).sort((a,b)=>a.date.localeCompare(b.date)||(a.start??-1)-(b.start??-1))
  if(!tasks.length)return [el('p','empty-folder','暂无任务')]
  return tasks.map(task=>{
   const button=el('button','folder-task'+(task.done?' finished':''))
   button.append(el('span','',task.name),el('small','',task.date+' · '+range(task)))
   button.onclick=()=>edit(task)
   return button
  })
 }
 function categoryTag(name,i){
  const tag=el('div','task-tag')
  const own=db.categoryStates[i]??'shown',state=effectiveState(i)
  tag.dataset.category=i
  styleCategory(tag,i)
  const mark=el('button','state-circle',marks[state])
  mark.setAttribute('aria-pressed',{shown:'true',muted:'mixed',hidden:'false'}[state])
  mark.setAttribute('aria-label',name+'，'+{shown:'显示',muted:'淡化',hidden:'隐藏'}[state])
  const open=el('button','tag-open')
  open.setAttribute('aria-expanded',String(!listLayout && expandedTags.has(i)))
  open.append(el('span','tag-name',name),el('span','tag-chevron',!listLayout && expandedTags.has(i)?'▾':'▸'))
  open.onclick=()=>{
   if(listLayout)currentTag=i
   else if(expandedTags.has(i))expandedTags.delete(i)
   else expandedTags.add(i)
   host.scrollTop=listLayout?0:host.scrollTop
   renderCategoryTags()
  }
  tag.append(mark,open)
  tag.oncontextmenu=e=>{
   e.preventDefault()
   openCategory(i)
  }
  mark.onclick=()=>{
   if(own==='hidden')delete db.categoryStates[i]
   else db.categoryStates[i]=own==='shown'?'muted':'hidden'
   save()
   host.querySelector('[data-category="'+i+'"] .state-circle')?.focus({preventScroll:true})
  }
  return tag
 }
 function branch(parent,inherited){
  const nodes=new Map()
  for(const folder of db.folders.filter(f=>f.parent===parent)){
   const group=el('div','folder-group'),row=el('div','folder-row')
   const expand=el('button','folder-expand',folder.closed?'▸':'▾')
   expand.setAttribute('aria-expanded',String(!folder.closed))
   expand.setAttribute('aria-label',(folder.closed?'展开':'折叠')+folder.name)
   expand.onclick=()=>{folder.closed=!folder.closed;save()}
   const name=el('button','folder-name',folder.name)
   name.title=listLayout?'打开文件夹':'编辑文件夹'
   name.onclick=()=>listLayout?enterFolder(folder.id):openFolder(folder)
   name.oncontextmenu=e=>{e.preventDefault();openFolder(folder)}
   wireItem(row,{key:'f:'+folder.id,parent,folder})
   if(listLayout){
    const icon=el('span','folder-glyph')
    icon.setAttribute('aria-hidden','true')
    row.append(icon,name)
   }else row.append(expand,name)
   const control=el('button','state-circle',marks[folder.state])
   control.title=stateLabels[folder.state]
   control.setAttribute('aria-label',folder.name+'，'+control.title)
   control.onclick=()=>{
    folder.state={inherit:'shown',shown:'muted',muted:'hidden',hidden:'inherit'}[folder.state]
    save()
   }
   row.prepend(control)
   group.append(row)
   if(inherited)group.append(el('small','inherited-state','上层'+stateLabels[inherited]))
   if(!listLayout && !folder.closed){
    const children=el('div','folder-children')
    children.append(...branch(folder.id,inherited || (folder.state==='inherit'?null:folder.state)))
    group.append(children)
   }
   nodes.set('f:'+folder.id,group)
  }
  db.cats.forEach((name,i)=>{
   if((db.categoryParents[i]??'')!==parent)return
   const tag=categoryTag(name,i)
   wireItem(tag,{key:'t:'+i,parent,category:i})
   if(inherited){
    tag.title='上层'+stateLabels[inherited]+' · 标签自身'+{shown:'显示',muted:'淡化',hidden:'隐藏'}[db.categoryStates[i]??'shown']
   }
   const group=el('div','tag-group')
   group.append(tag)
   if(!listLayout && expandedTags.has(i)){
    const children=el('div','folder-children')
    children.append(...taskRows(i))
    group.append(children)
   }
   nodes.set('t:'+i,group)
  })
  return orderedChildren(parent).map(key=>nodes.get(key))
 }
 host.replaceChildren(...(listLayout && currentTag!==null?taskRows(currentTag):branch(listLayout?currentFolder:'',inheritedState)))
 if(listLayout && !host.childElementCount)host.append(el('p','empty-folder','此文件夹为空'))
 host.scrollTop=scroll
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
 if(!monthly){for(const t of items.slice().sort((a,b)=>a.date.localeCompare(b.date)||(a.start??-1)-(b.start??-1))){const r=el('div',effectiveState(t.cat)==='muted'?'row muted-row':'row'),c=el('input',''),b=el('button',t.done?'finished':'',t.name);c.type='checkbox';c.checked=t.done;c.setAttribute('aria-label','完成 '+t.name);c.onchange=()=>{t.done=c.checked;save()};b.onclick=()=>edit(t);const badge=el('span','category-badge',db.cats[t.cat]);styleCategory(badge,t.cat);r.append(c,b,badge,el('small','',t.date+' '+range(t)));view.append(r)}if(!items.length)view.append(el('p','','暂无任务'));return}
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
$('form').onsubmit=e=>{e.preventDefault();const name=$('nameField').value.trim();if(!name){$('nameField').focus();return}const data={name,date:$('dateField').value,cat:+$('catField').value,done:$('done').checked};if($('allDay').checked){data.start=null;data.end=null}
 else{
  data.start=minutes($('startTime').value)
  data.end=minutes($('endTime').value)
  if(data.end<=data.start)data.end+=1440
 }
 if(editing)Object.assign(editing,data);else db.items.push({id:crypto.randomUUID(),...data});$('editor').close();save()}
$('del').onclick=()=>{if(confirm('删除这个任务？')){db.items=db.items.filter(t=>t!==editing);$('editor').close();save()}}
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
let categoryIndex=null
const presetColors=[...colors.map(pair=>pair[0]),'#f4d7dd','#f7e7ae','#c7e6e5','#d5dade']
let initialColor='',draftColor=''
function selectColor(value){
 draftColor=value.toLowerCase()
 for(const button of $('colorPresets').children){
  button.setAttribute('aria-pressed',String(button.dataset.color===draftColor))
 }
 $('customColor').style.setProperty('--sample',draftColor)
}
for(const [i,color] of presetColors.entries()){
 const button=el('button','swatch')
 button.type='button'
 button.dataset.color=color
 button.style.backgroundColor=color
 button.setAttribute('aria-label',['鼠尾草绿','雾蓝','杏色','淡紫','浅玫瑰','奶黄','青瓷','雾灰'][i])
 button.onclick=()=>selectColor(color)
 $('colorPresets').append(button)
}
function openCategory(index=null){
 categoryIndex=index
 folderOptions($('categoryParent'),index===null && listLayout?currentFolder:db.categoryParents[index])
 $('categoryTitle').textContent=index===null?'新建分类':'编辑分类'
 $('categoryName').value=db.cats[index]??''
 $('categoryName').setCustomValidity('')
 // The native color input expects hex, including for older HSL-based defaults.
 const context=document.createElement('canvas').getContext('2d')
 context.fillStyle=categoryColors(index??db.cats.length)[0]
 initialColor=context.fillStyle
 selectColor(initialColor)
 $('categoryEditor').showModal()
 $('categoryName').select()
}
$('customColor').onclick=()=>{
 $('categoryColor').value=$('hexColor').value=draftColor
 $('colorEditor').showModal()
 $('hexColor').select()
}
$('categoryColor').oninput=()=>{$('hexColor').value=$('categoryColor').value}
$('hexColor').oninput=()=>{
 if($('hexColor').validity.valid)$('categoryColor').value='#'+$('hexColor').value.replace(/^#/,'')
}
$('colorForm').onsubmit=e=>{
 e.preventDefault()
 selectColor('#'+$('hexColor').value.replace(/^#/,''))
 $('colorEditor').close()
}
$('colorCancel').onclick=()=>$('colorEditor').close()
$('addCat').onclick=$('newCategory').onclick=()=>openCategory()
$('categoryCancel').onclick=()=>$('categoryEditor').close()
$('categoryName').oninput=()=>$('categoryName').setCustomValidity('')
$('categoryForm').onsubmit=e=>{
 e.preventDefault()
 const name=$('categoryName').value.trim()
 if(!name || db.cats.some((other,i)=>other===name && i!==categoryIndex)){
  $('categoryName').setCustomValidity(name?'已有同名分类':'请输入分类名称')
  $('categoryName').reportValidity()
  return
 }
 const index=categoryIndex??db.cats.length
 db.categoryParents[index]=$('categoryParent').value
 db.cats[index]=name
 if(draftColor!==initialColor){
  db.categoryAccents??={}
  db.categoryAccents[index]=draftColor
 }
 if($('editor').open){
  $('catField').replaceChildren(...db.cats.map((label,i)=>new Option(label,i)))
  $('catField').value=index
 }
 $('categoryEditor').close()
 save()
 if(!$('editor').open)$('taskTags').querySelector('[data-category="'+index+'"] .tag-open')?.focus()
}
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
 const b=el('button','event'+(t.done?' finished':''))
 b.dataset.taskId=t.id
 styleCategory(b,t.cat)
 b.setAttribute('aria-label',t.name+' '+range(t))
 if(timed)b.append(el('strong','',t.name),el('span','event-time',range(t)))
 else b.textContent=(offset?'续至 '+clock(t.end)+' ':t.start==null?'':clock(t.start)+' ')+t.name
 b.onclick=e=>{e.stopPropagation();edit(t)}
 return b
}
function chooseDay(current,candidate,point){
 if(current===candidate)return current
 const from=current.getBoundingClientRect(),to=candidate.getBoundingClientRect()
 function crossed(value,oldEdge,newEdge,size){
  const inset=Math.min(40,size*.25)
  if(newEdge>oldEdge+1)return value>=newEdge+inset
  if(newEdge<oldEdge-1)return value<=newEdge+size-inset
  return true
 }
 return crossed(point.clientX,from.left,to.left,to.width) &&
        crossed(point.clientY,from.top,to.top,to.height)?candidate:current
}
function bindTaskDrag(button,begin){
 if(button.classList.contains('muted-category'))return
 button.onpointerdown=down=>{
  if(!down.isPrimary || down.button!==0)return
  const id=down.pointerId
  const gesture=begin(down)
  let moving=false
  button.setPointerCapture(id)
  const move=e=>{
   if(e.pointerId!==id)return
   if(!moving && Math.hypot(e.clientX-down.clientX,e.clientY-down.clientY)<5)return
   moving=true
   gesture.move(e)
  }
  const finish=e=>{
   if(e.pointerId!==id)return
   const commit=e.type==='pointerup'
   document.removeEventListener('pointermove',move)
   document.removeEventListener('pointerup',finish)
   document.removeEventListener('pointercancel',finish)
   button.onlostpointercapture=null
   window.removeEventListener('keydown',escape)
   if(button.hasPointerCapture(id))button.releasePointerCapture(id)
   if(!moving)return
   if(commit)gesture.move(e)
   const suppress=click=>{click.preventDefault();click.stopImmediatePropagation()}
   document.addEventListener('click',suppress,true)
   setTimeout(()=>document.removeEventListener('click',suppress,true),0)
   gesture.finish(commit)
  }
  const escape=e=>{if(e.key==='Escape')finish({pointerId:id,type:'cancel'})}
  window.addEventListener('keydown',escape)
  document.addEventListener('pointermove',move)
  document.addEventListener('pointerup',finish)
  document.addEventListener('pointercancel',finish)
  button.onlostpointercapture=finish
 }
}
function snapMinute(value, min, max){
 const first=Math.ceil(min/snapStep)*snapStep
 const last=Math.floor(max/snapStep)*snapStep
 return Math.max(first,Math.min(last,Math.round(value/snapStep)*snapStep))
}

function timelineAutoScroll(scroller, header){
 let frame=0, point=null, refresh=null, lastTime=0
 function stop(){
  cancelAnimationFrame(frame)
  frame=0
  point=null
  refresh=null
 }
 function speed(position,low,high){
  const zone=Math.min(52,(high-low)/3)
  if(zone<=0)return 0
  if(position<low+zone)return -Math.min(1,(low+zone-position)/zone)
  return Math.min(1,Math.max(0,(position-high+zone)/zone))
 }
 function tick(now){
  frame=0
  if(!scroller.isConnected || !point){stop();return}
  const rect=scroller.getBoundingClientRect()
  const left=Math.max(0,rect.left)
  const right=Math.min(innerWidth,rect.left+scroller.clientWidth)
  const top=Math.max(0,header.getBoundingClientRect().bottom)
  const bottom=Math.min(innerHeight,rect.top+scroller.clientHeight)
  const distance=Math.min(32,Math.max(1,now-lastTime))*.58
  const dx=speed(point.clientX,left,right)*distance
  const dy=speed(point.clientY,top,bottom)*distance
  const x=scroller.scrollLeft, y=scroller.scrollTop
  const pixels=n=>n===0?0:Math.sign(n)*Math.max(1,Math.round(Math.abs(n)))
  scroller.scrollBy(pixels(dx),pixels(dy))
  lastTime=now
  if(scroller.scrollTop!==y || scroller.scrollLeft!==x)frame=requestAnimationFrame(tick)
 }
 function track(event,onScroll){
  point={clientX:event.clientX,clientY:event.clientY,pointerId:event.pointerId}
  refresh=onScroll
  if(!frame){
   lastTime=performance.now()
   frame=requestAnimationFrame(tick)
  }
 }
 scroller.addEventListener('scroll',()=>{if(point)refresh(point)})
 return {track,stop}
}

function addResizeHandle(button, part, edge, column, previewBlocks, autoScroll){
 const {task,offset}=part
 const handle=el('span','resize-handle resize-'+edge)
 button.append(handle)
 handle.onclick=e=>{e.preventDefault();e.stopPropagation()}
 handle.onpointerdown=e=>{
  if(e.button!==0 || !e.isPrimary)return
  e.preventDefault()
  e.stopPropagation()
  const pointer=e.pointerId
  const origin=timeAt(e.clientY-column.getBoundingClientRect().top)
  const original=task[edge]
  let preview=original
  let selected=column
  handle.setPointerCapture(pointer)
  const move=event=>{
   if(event.pointerId!==pointer)return
   const hit=document.elementFromPoint(event.clientX,event.clientY)?.closest('.time-col')
   const target=hit?chooseDay(selected,hit,event):selected
   selected=target
   const dayDelta=Number(target.dataset.index)-Number(column.dataset.index)
   const delta=dayDelta*1440+timeAt(event.clientY-target.getBoundingClientRect().top)-origin
   if(Math.abs(delta)<2 && preview===original)return
   preview=edge==='start'
    ?snapMinute(original+delta,task.end-1440,task.end-1)
    :snapMinute(original+delta,task.start+1,task.start+1440)
   const interval={...task,[edge]:preview}
   previewBlocks.show(task,column,interval.start-offset,interval.end-offset,target)
  }
  const finish=event=>{
   if(event.pointerId!==pointer)return
   autoScroll.stop()
   const commit=event.type==='pointerup'
   if(commit)move(event)
   handle.onpointermove=handle.onpointerup=handle.onlostpointercapture=handle.onpointercancel=null
   previewBlocks.clear()
   if(commit && preview!==original){
    task[edge]=preview
    normalizeStart(task)
    save()
   }
  }
  handle.onpointermove=event=>{
   if(event.pointerId!==pointer)return
   move(event)
   autoScroll.track(event,move)
  }
  handle.onpointerup=handle.onpointercancel=handle.onlostpointercapture=finish
 }
}
function normalizeStart(task){
 const days=Math.floor(task.start/1440)
 if(days){
  task.date=shiftDate(task.date,days)
  task.start-=days*1440
  task.end-=days*1440
 }
}

function dayAt(offset){
 const day=new Date(cursor)
 day.setDate(day.getDate()+offset)
 return day
}
function overlaps(tasks){
 const entries=[]
 let group=[],ends=[],groupEnd=0
 function flush(){for(const entry of group)entries.push({...entry,count:ends.length});group=[];ends=[]}
 for(const task of tasks.slice().sort((a,b)=>a.start-b.start||b.end-a.end)){
  if(task.start>=groupEnd){flush();groupEnd=0}
  let lane=ends.findIndex(end=>end<=task.start)
  if(lane<0)lane=ends.length
  ends[lane]=task.end
  groupEnd=Math.max(groupEnd,task.end)
  group.push({task,lane})
 }
 flush()
 return entries
}
function timelinePreview(body,grid){
 const columns=body.getElementsByClassName('time-col')
 const blocks=new Map()
 let sources=[]
 let activeTask=null
 function clear(){
  for(const block of blocks.values())block.remove()
  blocks.clear()
  for(const source of sources)source.classList.remove('drag-source')
  sources=[]
  activeTask=null
 }
 function show(task,origin,start,end,focused){
  const dayStart=Math.floor(start/1440)*1440
  const label=range({start:start-dayStart,end:end-dayStart})
  let labelBlock=null
  if(task!==activeTask){
   clear()
   activeTask=task
   sources=Array.from(grid.querySelectorAll('[data-task-id]')).filter(node=>node.dataset.taskId===String(task.id))
   for(const source of sources)source.classList.add('drag-source')
  }
  for(const col of columns){
   const offset=(Number(col.dataset.index)-Number(origin.dataset.index))*1440
   const part={start:Math.max(0,start-offset),end:Math.min(1440,end-offset)}
   let block=blocks.get(col)
   if(part.start>=part.end){
    if(block)block.hidden=true
    continue
   }
   if(!block){
    block=el('div','event drag-preview')
    styleCategory(block,task.cat)
    block.append(el('strong','',task.name),el('span','preview-time'))
    col.append(block)
    blocks.set(col,block)
   }
   block.hidden=false
   block.lastChild.textContent=''
   if(!labelBlock || col===focused)labelBlock=block
   positionTask(block,part)
  }
  if(labelBlock)labelBlock.lastChild.textContent=label
 }
 return {show,clear}
}
function renderTimeline(view,items){
 const count=timelineDays[period]
 const first=count===7?-((cursor.getDay()+6)%7):0
 const days=Array.from({length:count},(_,i)=>dayAt(first+i))
 const format=d=>d.toLocaleDateString('zh-CN',{month:'short',day:'numeric'})
 const last=days[count-1]
 $('month').textContent=days[0].getFullYear()+'年 '+format(days[0])+(count===1?'':' — '+(last.getFullYear()!==days[0].getFullYear()?last.getFullYear()+'年 ':'')+format(last))
 view.className='schedule'
 const scroller=el('div','time-scroll'),grid=el('div','time-grid')
 grid.style.setProperty('--days',count)
 const head=el('div','time-head'),body=el('div','time-body'),axis=el('div','axis')
 const previewBlocks=timelinePreview(body,grid)
 const autoScroll=timelineAutoScroll(scroller,head)
 function bindTimelineTask(button,part,source,timed){
  bindTaskDrag(button,down=>{
   const task=part.task
   const length=task.start==null?60:task.end-task.start
   const grip=timed?Math.round(timeAt(down.clientY-source.getBoundingClientRect().top))+part.offset-task.start:0
   let selected=source,destination=null,start=0
   function preview(point){
    const hit=document.elementFromPoint(point.clientX,point.clientY)
    const candidate=hit?.closest('.time-col')
    if(!candidate || !body.contains(candidate) || hit.closest('.night-band')){
     destination=null
     previewBlocks.clear()
     return
    }
    selected=chooseDay(selected,candidate,point)
    destination=selected.dataset.date
    const minute=Math.round(timeAt(point.clientY-selected.getBoundingClientRect().top))
    start=snapMinute(minute-grip,-1440,1425)
    previewBlocks.show(task,selected,start,start+length,selected)
   }
   return {
    move(point){preview(point);autoScroll.track(point,preview)},
    finish(commit){
     autoScroll.stop()
     previewBlocks.clear()
     if(commit && destination){
      Object.assign(task,{start,end:start+length,date:destination})
      normalizeStart(task)
      save()
     }
    }
   }
  })
 }
 head.append(el('small','axis-label','全天'))
 const nightRange=()=>clock(nightStart)+'–'+(nightEnd===1440?'24:00':clock(nightEnd))
 for(let h=0;h<24;h++){
  if(h*60===nightStart){
   const toggle=el('button','night-axis',clock(nightStart)+(nightFolded?' ▸':' ▾'))
   toggle.setAttribute('aria-label',(nightFolded?'展开 ':'折叠 ')+nightRange())
   toggle.setAttribute('aria-expanded',String(!nightFolded))
   toggle.style.height=(nightFolded?foldedHeight:60)+'px'
   toggle.onclick=()=>{toggleNight();document.querySelector('.night-axis').focus({preventScroll:true})}
   axis.append(toggle)
  }else if(!nightFolded || h*60<nightStart || h*60>=nightEnd)axis.append(el('span','',clock(h*60)))
 }
 function addNightLimit(isStart){
  const value=isStart?nightStart:nightEnd
  const min=isStart?0:nightStart+60
  const max=isStart?nightEnd-60:1440
  const grip=el('button','night-limit','═')
  grip.dataset.edge=isStart?'start':'end'
  grip.setAttribute('role','slider')
  grip.setAttribute('aria-orientation','vertical')
  grip.setAttribute('aria-label','调整折叠'+(isStart?'开始':'结束')+'时间')
  grip.setAttribute('aria-valuemin',min)
  grip.setAttribute('aria-valuemax',max)
  const place=minute=>{
   grip.style.top=minute+'px'
   grip.setAttribute('aria-valuenow',minute)
   grip.setAttribute('aria-valuetext',minute===1440?'24:00':clock(minute))
  }
  const commit=minute=>{
   if(isStart)nightStart=minute
   else nightEnd=minute
   localStorage.setItem(isStart?'dayfolio.nightStart':'dayfolio.nightEnd',String(minute))
   render()
   document.querySelector('.night-limit[data-edge="'+grip.dataset.edge+'"]')?.focus({preventScroll:true})
  }
  const bound=minute=>Math.min(max,Math.max(min,Math.round(minute/60)*60))
  grip.onkeydown=e=>{
   if(e.key==='ArrowUp'||e.key==='ArrowDown'){
    e.preventDefault()
    commit(bound(value+(e.key==='ArrowUp'?-60:60)))
   }
  }
  grip.onpointerdown=e=>{
   if(e.button!==0 || !e.isPrimary)return
   e.preventDefault()
   grip.setPointerCapture(e.pointerId)
   const origin=e.clientY-axis.getBoundingClientRect().top
   const minuteAt=p=>bound(value+p.clientY-axis.getBoundingClientRect().top-origin)
   grip.onpointermove=p=>{if(p.pointerId===e.pointerId)place(minuteAt(p))}
   const finish=p=>{
    if(p.pointerId!==e.pointerId)return
    grip.onpointermove=grip.onpointerup=grip.onpointercancel=grip.onlostpointercapture=null
    if(p.type==='pointerup')commit(minuteAt(p))
    else place(value)
   }
   grip.onpointerup=grip.onpointercancel=grip.onlostpointercapture=finish
  }
  place(value)
  axis.append(grip)
 }
 if(!nightFolded){addNightLimit(true);addNightLimit(false)}
 body.append(axis)
 for(const d of days){
  const date=key(d),daily=daySegments(items,date)
  const top=el('div','day-head'),label=el('button',date===key(now)?'is-today':'',d.toLocaleDateString('zh-CN',{weekday:'short'})+' '+d.getDate())
  label.onclick=()=>{cursor=new Date(d);setPeriod('day')}
  top.append(label)

  head.append(top)
  const col=el('div','time-col')
  col.dataset.index=days.indexOf(d)
  col.dataset.date=date
  for(const part of daily.filter(t=>t.start==null)){
   const button=eventButton(part.task)
   bindTimelineTask(button,part,col,false)
   top.append(button)
  }
  const minute=e=>Math.round(timeAt(e.clientY-col.getBoundingClientRect().top))
  const timed=daily.filter(t=>t.start!=null)
  const visible=timed.filter(t=>!nightFolded || t.start<nightStart || t.end>nightEnd)
  col.style.height=timeY(1440)+'px'
  if(nightFolded){
   col.classList.add('folded-night')
   col.style.setProperty('--night-start',nightStart+'px')
   const hiddenCount=timed.length-visible.length
   const band=el('button','night-band',hiddenCount?hiddenCount+' 项任务':'···')
   band.title='展开 '+nightRange()
   band.setAttribute('aria-label',band.title)
   band.style.top=nightStart+'px'
   band.style.height=foldedHeight+'px'
   band.onclick=e=>{e.stopPropagation();toggleNight()}
   col.append(band)
  }
  const clamp=(n,max)=>Math.max(0,Math.min(max,n))
  col.onclick=e=>edit(null,date,clamp(minute(e),1439))
  for(const {task:part,lane,count:lanes} of overlaps(visible)){
   const b=eventButton(part.task,true,part.offset)
   if(effectiveState(part.task.cat)!=='muted'){
    bindTimelineTask(b,part,col,true)
    if(!part.offset)addResizeHandle(b,part,'start',col,previewBlocks,autoScroll)
    if(part.task.end<=part.offset+1440)addResizeHandle(b,part,'end',col,previewBlocks,autoScroll)
   }
   positionTask(b,part)
   b.style.left=(100*lane/lanes)+'%';b.style.width='calc('+100/lanes+'% - 2px)'
   col.append(b)
  }
  body.append(col)
 }
 grid.append(head,body);scroller.append(grid);view.append(scroller)
 scroller.scrollTop=timeY(timelineScroll)
 scroller.scrollLeft=timelineLeft
 scroller.onscroll=()=>{if(scroller.isConnected)timelineScroll=timeAt(scroller.scrollTop)}
}

