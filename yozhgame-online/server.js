const express=require("express"),http=require("http"),crypto=require("crypto"),path=require("path");
const app=express(),server=http.createServer(app),io=require("socket.io")(server);
app.use(express.static(path.join(__dirname,"public")));
const rooms=new Map(),code=()=>crypto.randomBytes(3).toString("hex").toUpperCase();
function view(r){return {code:r.code,phase:r.phase,seconds:r.seconds,round:r.round,players:[...r.players.values()],pot:[...r.players.values()].reduce((s,p)=>s+p.bet,0),winner:r.winner}}
function send(r){io.to(r.code).emit("room:update",view(r))}
function finish(r){if(r.phase!=="betting")return;r.phase="spinning";r.seconds=0;let ps=[...r.players.values()].filter(p=>p.bet),pot=ps.reduce((s,p)=>s+p.bet,0);if(ps.length){let n=Math.random()*pot,w=ps[0];for(const p of ps){n-=p.bet;if(n<=0){w=p;break}}w.balance+=pot;r.winner={name:w.name,face:w.face,pot}}send(r);setTimeout(()=>{r.round++;r.phase="betting";r.seconds=30;r.winner=null;for(const p of r.players.values())p.bet=0;send(r)},8500)}
function makeRoom(c){let r={code:c,phase:"betting",seconds:30,round:1,players:new Map(),winner:null};r.timer=setInterval(()=>{if(r.phase!=="betting")return;if(--r.seconds<=0)finish(r);else send(r)},1000);rooms.set(c,r);return r}
function join(s,r,name){r.players.set(s.id,{id:s.id,name:String(name||"Игрок").trim().slice(0,18)||"Игрок",bet:0,balance:1000,face:["🦔","🐸","🗿","🦊","🐱","🥶"][r.players.size%6]});s.join(r.code);s.emit("room:joined",{code:r.code,you:s.id});send(r)}
io.on("connection",s=>{
s.on("room:create",({name},cb=()=>{})=>{let c;do{c=code()}while(rooms.has(c));join(s,makeRoom(c),name);cb({ok:true,code:c})});
s.on("room:join",({code:c,name},cb=()=>{})=>{let r=rooms.get(String(c||"").toUpperCase());if(!r)return cb({ok:false,error:"Комната не найдена"});if(r.players.size>=12)return cb({ok:false,error:"Комната заполнена"});join(s,r,name);cb({ok:true,code:r.code})});
s.on("bet:place",({amount},cb=()=>{})=>{let r=[...rooms.values()].find(x=>x.players.has(s.id));if(!r)return cb({ok:false,error:"Нет комнаты"});let p=r.players.get(s.id),n=Math.floor(Number(amount));if(r.phase!=="betting"||p.bet)return cb({ok:false,error:"Ставки закрыты или ставка уже сделана"});if(!Number.isFinite(n)||n<1||n>p.balance)return cb({ok:false,error:"Недостаточно монет или неверная сумма"});p.bet=n;p.balance-=n;send(r);cb({ok:true})});
s.on("disconnect",()=>{for(const r of rooms.values())if(r.players.delete(s.id)){send(r);if(!r.players.size){clearInterval(r.timer);rooms.delete(r.code)}}})
});
server.listen(process.env.PORT||3000,()=>console.log("ЁжGame online ready"));