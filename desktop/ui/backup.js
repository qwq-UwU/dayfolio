function readPlannerBackup(text){
 const backup=JSON.parse(text)
 if(backup.format!=='dayfolio' || ![1,2].includes(backup.version))throw Error('请选择序日导出的日程文件。')
 const data=backup.data
 const invalid=()=>{throw Error('日程文件的数据不完整，请重新导出。')}
 if(!data || !Array.isArray(data.cats) ||
    !data.cats.every(name=>typeof name==='string' && name.trim()) ||
    !Array.isArray(data.items))invalid()
 const legacy=backup.version===1
 if(legacy ? !Array.isArray(data.folders) || data.tagTreeVersion!=null : data.tagTreeVersion!==2)invalid()
 const parents=new Map()
 if(legacy)for(const f of data.folders){
  if(!f || typeof f.id!=='string' || !f.id || Object.hasOwn(Object.prototype,f.id) ||
     parents.has(f.id) || typeof f.name!=='string' || typeof f.parent!=='string' ||
     !['inherit','shown','muted','hidden'].includes(f.state))invalid()
  parents.set(f.id,f.parent)
 }
 else{
  data.cats.forEach((_,i)=>parents.set('t:'+i,data.categoryParents?.[i]??''))
  if(!Array.isArray(data.expandedTags) || !data.expandedTags.every(i=>Number.isInteger(i) && i>=0 && i<data.cats.length))invalid()
 }
 for(const id of parents.keys()){
  const ancestors=new Set()
  for(let parent=id;parent;parent=parents.get(parent)){
   if(!parents.has(parent) || ancestors.has(parent))invalid()
   ancestors.add(parent)
  }
 }
 const ids=new Set()
 for(const t of data.items){
  if(!t || typeof t.id!=='string' || ids.has(t.id) || typeof t.name!=='string' ||
     ((legacy || t.cat!==null) && (!Number.isInteger(t.cat) || t.cat<0 || t.cat>=data.cats.length)) ||
     typeof t.date!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(t.date) ||
     key(new Date(t.date+'T12:00:00'))!==t.date)invalid()
  if(t.start!=null || t.end!=null){
   if(!Number.isInteger(t.start) || t.start<0 || t.start>=1440 ||
      !Number.isInteger(t.end) || t.end<=t.start || t.end>t.start+1440)invalid()
  }
  ids.add(t.id)
 }
 for(const field of ['categoryParents','categoryAccents','categoryStates','categoryPalette','treeOrder']){
  const map=data[field]??{}
  if(typeof map!=='object' || Array.isArray(map))invalid()
  for(const [k,v] of Object.entries(map)){
   if(field==='treeOrder'){
    if((k!=='' && !parents.has(k)) || !Array.isArray(v) || !v.every(x=>typeof x==='string'))invalid()
    if(!legacy && (new Set(v).size!==v.length || v.some(key=>parents.get(key)!==k)))invalid()
   }else{
    if(!/^\d+$/.test(k) || Number(k)>=data.cats.length)invalid()
    if(field==='categoryParents' && v!=='' && !parents.has(v))invalid()
    if(field==='categoryAccents' && (typeof v!=='string' || !/^#[0-9a-f]{6}$/i.test(v)))invalid()
    if(field==='categoryStates' && !['shown','muted','hidden'].includes(v))invalid()
    if(field==='categoryPalette' && (!Number.isSafeInteger(v) || v<0))invalid()
   }
  }
 }
 if(legacy)migrateTagTree(data)
 return data
}
$('exportData').onclick=()=>{
 const json=JSON.stringify({format:'dayfolio',version:2,data:db},null,2)
 window.chrome.webview.postMessage(json)
}
$('importData').onclick=()=>$('backupFile').click()
$('backupFile').onchange=async e=>{
 const input=e.target,file=input.files[0]
 input.value=''
 if(!file)return
 try{
  const data=readPlannerBackup(await file.text())
  if(!confirm('用备份中的 '+data.items.length+' 项任务、'+data.cats.length+' 个标签替换当前日程？'))return
  const previousTag=currentTag
  usePlanner(data,'')
  $('displaySettings').close()
  save({previousTag})
 }catch(error){alert('导入失败。'+error.message)}
}
