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
