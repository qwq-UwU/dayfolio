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
  if(item.folder)item.folder.parent=dest.parent
  else db.categoryParents[item.category]=dest.parent
  if(dest.where==='inside' && dest.parent)db.folders.find(f=>f.id===dest.parent).closed=false
  save()
 }
 function wireItem(row,item){
  wireDrop(row,fraction=>{
   if(item.folder && fraction>=0.22 && fraction<=0.78)return {key:item.key,parent:item.folder.id,where:'inside'}
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
    if(target.key===item.key)return false
    if(!item.folder)return true
    for(let id=target.parent;id;id=db.folders.find(f=>f.id===id)?.parent){
     if(id===item.folder.id)return false
    }
    return !db.folders.some(f=>f!==item.folder && f.parent===target.parent && f.name===item.folder.name)
   }
   function place(anchor,where){
    if(where==='before'?gap.nextElementSibling===anchor:gap.previousElementSibling===anchor)return
    const positions=new Map()
    if(!reduced){
     for(const node of host.querySelectorAll('.task-tag,.folder-row')){
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
    const container=hit.closest('.folder-group,.tag-group')
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
     point=e
     if(!active){
      active=true
      group.before(gap)
      row.style.width=rect.width+'px'
      row.style.height=rect.height+'px'
      group.classList.add('lifted-group')
      row.classList.add('lifted-row')
      section.classList.add('moving-item')
     }
     row.style.transform='translate('+ (rect.left+e.clientX-down.clientX)+'px,'+(rect.top+e.clientY-down.clientY)+'px)'
     updateTarget()
     if(!frame)frame=requestAnimationFrame(scrollEdge)
    },
    finish(accepted){
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
