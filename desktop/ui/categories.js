const stateLabels={inherit:'取消统一设置',shown:'统一显示',muted:'统一淡化',hidden:'统一隐藏'}
let listLayout=localStorage.getItem('dayfolio.folderLayout')==='list'
let currentTag=localStorage.getItem('dayfolio.openTag')||''
if(!db.cats.some((_,i)=>currentTag==='t:'+i))currentTag=''
const expandedTags=new Set(db.expandedTags??[])
function enterTag(key){
 currentTag=key
 localStorage.setItem('dayfolio.openTag',key)
 $('taskTags').scrollTop=0
 renderCategoryTags()
}
for(const button of $('folderLayout').children)button.onclick=()=>{
 listLayout=button.value==='list'
 localStorage.setItem('dayfolio.folderLayout',button.value)
 renderCategoryTags()
}
function orderedChildren(parent){
 const keys=db.cats.map((_,i)=>'t:'+i).filter(key=>(db.categoryParents[key.slice(2)]??'')===parent)
 const saved=db.treeOrder[parent]??[]
 return [...saved.filter(key=>keys.includes(key)),...keys.filter(key=>!saved.includes(key))]
}
function tagAncestors(key){
 const chain=[]
 while(key){
  chain.unshift(key)
  key=db.categoryParents[key.slice(2)]??''
 }
 return chain
}
function tagOptions(select,parent='',exclude=null,forTask=false){
 select.replaceChildren()
 if(!forTask)select.add(new Option('顶层',''))
 function visit(key,path){
  for(const child of orderedChildren(key)){
   const index=Number(child.slice(2))
   if(index===exclude)continue
   const name=path+db.cats[index]
   select.add(new Option(name,forTask?index:child))
   visit(child,name+' / ')
  }
 }
 visit('','')
 select.value=parent
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
 for(const key of tagAncestors('t:'+category)){
  const state=db.categoryStates[key.slice(2)]
  if(state)return state
 }
 return 'shown'
}
function renderCategoryTags(){
 const host=$('taskTags')
 const scroll=host.scrollTop
 const section=$('categorySection')
 const targets=new Map()
 function wireDrop(node,resolve){
  node.dataset.dropTarget=''
  targets.set(node,resolve)
 }
 function commit(item,dest){
  const order=orderedChildren(dest.parent).filter(key=>key!==item.key)
  const index=dest.where==='inside'?order.length:order.indexOf(dest.key)+(dest.where==='after'?1:0)
  order.splice(index,0,item.key)
  if(item.parent!==dest.parent && db.treeOrder[item.parent]){
   db.treeOrder[item.parent]=db.treeOrder[item.parent].filter(key=>key!==item.key)
  }
  db.treeOrder[dest.parent]=order
  db.categoryParents[item.category]=dest.parent
  if(dest.where==='inside' && dest.parent){
   expandedTags.add(Number(dest.parent.slice(2)))
   db.expandedTags=[...expandedTags]
  }
  save()
 }
 function wireItem(row,item){
  wireDrop(row,fraction=>{
   if(fraction>=0.28 && fraction<=0.72)return {key:item.key,parent:item.key,where:'inside'}
   return {key:item.key,parent:item.parent,where:fraction<0.5?'before':'after'}
  })
  bindPointerDrag(row,down=>{
   const group=row.parentElement, rect=row.getBoundingClientRect()
   const gap=el('div','category-gap')
   gap.setAttribute('aria-hidden','true')
   gap.style.height=rect.height+'px'
   const animations=new Map()
   const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches
   let active=false, dest=null, gapTarget=null, point=down, frame=0
   function allowed(target){
    return target.key!==item.key && !tagAncestors(target.parent).includes(item.key)
   }
   function place(anchor,where){
    if(where==='before'?gap.nextElementSibling===anchor:gap.previousElementSibling===anchor)return
    const positions=new Map()
    if(!reduced){
     for(const node of host.querySelectorAll('.task-tag')){
      if(node!==row && node.offsetHeight)positions.set(node,node.getBoundingClientRect().top)
     }
    }
    if(where==='before')anchor.before(gap)
    else anchor.after(gap)
    for(const [node,top] of positions){
     animations.get(node)?.cancel()
     const offset=top-node.getBoundingClientRect().top
     if(Math.abs(offset)>1){
      animations.set(node,node.animate([{transform:'translateY('+offset+'px)'},{transform:'none'}],
       {duration:150,easing:'cubic-bezier(.2,.8,.2,1)'}))
     }
    }
   }
   function targetAt(x,y){
    const hit=document.elementFromPoint(x,y)
    if(!hit || !section.contains(hit))return null
    if(hit===gap)return gapTarget
    const container=hit.closest('.tag-group')
    const node=container?.firstElementChild || hit.closest('[data-drop-target]')
    const resolve=targets.get(node)
    if(resolve){
     // Hit-test the stationary layout, independently of the visual swap animation.
     const top=container?container.getBoundingClientRect().top+container.clientTop+parseFloat(getComputedStyle(container).paddingTop):node.getBoundingClientRect().top
     const fraction=(y-top)/node.offsetHeight
     if(fraction<0 || fraction>1)return null
     const target=resolve(fraction)
     return allowed(target)?{node,...target}:null
    }
    const box=gap.getBoundingClientRect()
    return x>=box.left && x<=box.right && y>=box.top-6 && y<=box.bottom+6?gapTarget:null
   }
   function updateTarget(){
    const next=targetAt(point.clientX,point.clientY)
    if(next?.node===dest?.node && next?.where===dest?.where)return
    if(dest)delete dest.node.dataset.drop
    dest=next
    if(!dest)return
    if(dest.where==='inside')dest.node.dataset.drop='inside'
    else{
     gapTarget=dest
     place(dest.node.parentElement,dest.where)
    }
   }
   function scrollEdge(){
    frame=0
    const box=host.getBoundingClientRect(), x=point.clientX, y=point.clientY
    if(x<box.left || x>box.right || y<box.top || y>box.bottom)return
    const zone=Math.min(32,box.height/3)
    const speed=Math.max(0,y-box.bottom+zone)-Math.max(0,box.top+zone-y)
    const before=host.scrollTop
    host.scrollTop+=Math.sign(speed)*Math.ceil(Math.abs(speed)/3)
    if(host.scrollTop!==before){updateTarget();frame=requestAnimationFrame(scrollEdge)}
   }
   return {
    move(e){
     const dy=e.clientY-down.clientY
     if(!active){
      if(Math.abs(dy)<5)return
      active=true
      group.before(gap)
      row.style.width=rect.width+'px'
      row.style.height=rect.height+'px'
      group.classList.add('lifted-group')
      row.classList.add('lifted-row')
      section.classList.add('moving-item')
     }
     point=e
     row.style.transform='translate('+rect.left+'px,'+(rect.top+dy)+'px)'
     updateTarget()
     if(!frame)frame=requestAnimationFrame(scrollEdge)
    },
    finish(accepted){
     if(!active)return
     cancelAnimationFrame(frame)
     for(const animation of animations.values())animation.cancel()
     if(dest)delete dest.node.dataset.drop
     gap.remove()
     section.classList.remove('moving-item')
     group.classList.remove('lifted-group')
     row.classList.remove('lifted-row')
     for(const prop of ['width','height','transform'])row.style.removeProperty(prop)
     if(accepted && dest)commit(item,dest)
    }
   }
  })
 }
 wireDrop($('treeRoot'),()=>({parent:'',where:'inside'}))
 for(const button of $('folderLayout').children)button.setAttribute('aria-pressed',String((button.value==='list')===listLayout))
 const path=$('folderPath')
 path.hidden=!listLayout
 path.replaceChildren()
 if(listLayout){
  for(const key of ['',...tagAncestors(currentTag)]){
   const link=el('button','',key?db.cats[key.slice(2)]:'全部标签')
   link.onclick=()=>enterTag(key)
   if(key===currentTag)link.setAttribute('aria-current','location')
   wireDrop(link,()=>({parent:key,where:'inside'}))
   if(path.childElementCount)path.append(el('span','','›'))
   path.append(link)
  }
 }
 const marks={inherit:'↳',shown:'✓',muted:'−',hidden:''}
 function taskRows(category){
  const tasks=db.items.filter(t=>t.cat===category).sort(taskListOrder)
  return tasks.map(task=>{
   const button=el('button','folder-task'+(task.done?' finished':''))
   button.append(el('span','',task.name),el('small','',task.date+' · '+range(task)))
   button.onclick=()=>edit(task)
   const row=el('div','folder-task-row')
   row.append(button,completionControl(task))
   return row
  })
 }
 function categoryTag(name,i){
  const tag=el('div','task-tag')
  const own=db.categoryStates[i]??'inherit',state=effectiveState(i)
  const hasChildren=orderedChildren('t:'+i).length>0
  tag.dataset.category=i
  styleCategory(tag,i)
  const mark=el('button','state-circle',hasChildren && own==='inherit'?'↳':marks[state])
  const visibleState={shown:'显示',muted:'淡化',hidden:'隐藏'}[state]
  mark.title=hasChildren?stateLabels[own]+' · 当前'+visibleState:visibleState
  mark.setAttribute('aria-label',name+'，'+mark.title)
  mark.setAttribute('aria-pressed',{shown:'true',muted:'mixed',hidden:'false'}[state])
  const open=el('button','tag-open')
  open.setAttribute('aria-expanded',String(!listLayout && expandedTags.has(i)))
  open.append(el('span','tag-name',name),el('span','tag-chevron',!listLayout && expandedTags.has(i)?'▾':'▸'))
  open.onclick=()=>{
   if(listLayout){enterTag('t:'+i);return}
   else if(expandedTags.has(i))expandedTags.delete(i)
   else expandedTags.add(i)
   db.expandedTags=[...expandedTags]
   save()
  }
  tag.append(mark,open)
  mark.onclick=()=>{
   if(own==='hidden')delete db.categoryStates[i]
   else db.categoryStates[i]=own==='inherit' && hasChildren?'shown':own==='muted'?'hidden':'muted'
   save()
   host.querySelector('[data-category="'+i+'"] .state-circle')?.focus({preventScroll:true})
  }
  return tag
 }
 function contents(parent){
  const nodes=orderedChildren(parent).map(key=>{
   const i=Number(key.slice(2)),group=el('div','tag-group')
   const tag=categoryTag(db.cats[i],i)
   wireItem(tag,{key,parent,category:i})
   group.append(tag)
   if(!listLayout && expandedTags.has(i)){
    const children=el('div','folder-children')
    children.append(...contents(key))
    group.append(children)
   }
   return group
  })
  if(parent)nodes.push(...taskRows(Number(parent.slice(2))))
  if(!nodes.length)nodes.push(el('p','empty-folder','暂无子标签或任务'))
  return nodes
 }
 host.replaceChildren(...contents(listLayout?currentTag:''))
 host.scrollTop=scroll
}

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
function openCategory(index=null,parent=listLayout?currentTag:''){
 categoryIndex=index
 tagOptions($('categoryParent'),index===null?parent:db.categoryParents[index],index)
 $('categoryTitle').textContent=index===null?'新建标签':'编辑标签'
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
$('addCat').onclick=()=>openCategory()
const tagMenu=$('tagMenu')
function showTagMenu(target,x,y){
 const tag=target.closest('.task-tag')
 const group=target.closest('.tag-group')
 const context=group?'t:'+group.firstElementChild.dataset.category:listLayout?currentTag:''
 tagMenu.replaceChildren()
 function action(label,run){
  const button=el('button','',label)
  button.type='button'
  button.setAttribute('role','menuitem')
  button.onclick=()=>{tagMenu.hidePopover();run()}
  tagMenu.append(button)
 }
 if(tag){
  const index=Number(tag.dataset.category)
  action('新建同级标签',()=>openCategory(null,db.categoryParents[index]??''))
  action('新建子标签',()=>openCategory(null,'t:'+index))
  action('编辑标签',()=>openCategory(index))
 }else action('新建标签',()=>openCategory(null,context))
 tagMenu.showPopover()
 tagMenu.style.left=Math.max(4,Math.min(x,innerWidth-tagMenu.offsetWidth-4))+'px'
 tagMenu.style.top=Math.max(4,Math.min(y,innerHeight-tagMenu.offsetHeight-4))+'px'
 tagMenu.firstElementChild.focus({preventScroll:true})
}
$('categorySection').oncontextmenu=e=>{
 e.preventDefault()
 if(!$('categorySection').classList.contains('moving-item'))showTagMenu(e.target,e.clientX,e.clientY)
}
$('categorySection').addEventListener('keydown',e=>{
 if(e.key!=='ContextMenu' && !(e.shiftKey && e.key==='F10'))return
 e.preventDefault()
 const rect=e.target.getBoundingClientRect()
 showTagMenu(e.target,rect.left,rect.bottom)
})
tagMenu.onkeydown=e=>{
 if(!['ArrowUp','ArrowDown'].includes(e.key))return
 e.preventDefault()
 const buttons=[...tagMenu.children]
 const next=buttons.indexOf(document.activeElement)+(e.key==='ArrowUp'?-1:1)
 buttons[(next+buttons.length)%buttons.length].focus()
}
$('categoryCancel').onclick=()=>$('categoryEditor').close()
$('categoryName').oninput=()=>$('categoryName').setCustomValidity('')
$('categoryParent').onchange=()=>$('categoryName').setCustomValidity('')
$('categoryForm').onsubmit=e=>{
 e.preventDefault()
 const name=$('categoryName').value.trim()
 const index=categoryIndex??db.cats.length
 const oldParent=db.categoryParents[index]??''
 const parent=$('categoryParent').value
 const renamedOrMoved=name!==db.cats[index] || oldParent!==parent
 if(!name || (renamedOrMoved && db.cats.some((other,i)=>other===name && i!==index && (db.categoryParents[i]??'')===parent))){
  $('categoryName').setCustomValidity(name?'已有同名标签':'请输入标签名称')
  $('categoryName').reportValidity()
  return
 }
 if(oldParent!==parent && db.treeOrder[oldParent])db.treeOrder[oldParent]=db.treeOrder[oldParent].filter(k=>k!=='t:'+index)
 db.categoryParents[index]=parent
 if(parent){expandedTags.add(Number(parent.slice(2)));db.expandedTags=[...expandedTags]}
 db.cats[index]=name
 if(draftColor!==initialColor){
  db.categoryAccents??={}
  db.categoryAccents[index]=draftColor
 }
 if($('editor').open){
  tagOptions($('catField'),index,null,true)
  $('catField').value=index
 }
 $('categoryEditor').close()
 save()
 if(!$('editor').open)$('taskTags').querySelector('[data-category="'+index+'"] .tag-open')?.focus()
}
