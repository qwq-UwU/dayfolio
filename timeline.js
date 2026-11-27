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
