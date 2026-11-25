(() => {
  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = "silver-stack-v1";
  const config = window.SILVER_APP_CONFIG || {};
  const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  let items = Array.isArray(stored)?stored:stored.items;
  let sales = Array.isArray(stored)?[]:(stored.sales||[]);
  let goal = Number(localStorage.getItem("silver-stack-goal") || 100);
  let categoryGoals = Array.isArray(stored)?{}:(stored.categoryGoals||{});
  const selected = new Set(), categories=["Rounds","Bars","Constitutional","Foreign coins","Collectibles","Other"];
  let spot = null, spotUpdated = null, supabase = null, session = null, currentView = "overview";
  const fmt = (n, digits=2) => Number(n || 0).toLocaleString(undefined,{minimumFractionDigits:digits,maximumFractionDigits:digits});
  const money = n => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(n||0));
  const SILVER_PRESETS = {
    dime:{name:"90% U.S. Dime",category:"Constitutional",oz:0.07234},
    quarter:{name:"90% U.S. Quarter",category:"Constitutional",oz:0.18084},
    half:{name:"90% U.S. Half Dollar",category:"Constitutional",oz:0.36169},
    morgan:{name:"Morgan Silver Dollar",category:"Constitutional",oz:0.77344},
    peace:{name:"Peace Silver Dollar",category:"Constitutional",oz:0.77344},
    kennedy40:{name:"40% Kennedy Half Dollar (1965–1970)",category:"Constitutional",oz:0.1479},
    warNickel:{name:"35% Silver War Nickel (1942–1945)",category:"Constitutional",oz:0.05626},
    genericRound:{name:"1 oz Silver Round",category:"Rounds",oz:1},
    round2:{name:"2 oz Silver Round",category:"Rounds",oz:2},
    round5:{name:"5 oz Silver Round",category:"Rounds",oz:5},
    round10:{name:"10 oz Silver Round",category:"Rounds",oz:10},
    eagle:{name:"American Silver Eagle — 1 oz",category:"Rounds",oz:1},
    maple:{name:"Canadian Maple Leaf — 1 oz",category:"Rounds",oz:1},
    britannia:{name:"British Britannia — 1 oz",category:"Rounds",oz:1},
    philharmonic:{name:"Austrian Philharmonic — 1 oz",category:"Rounds",oz:1},
    tenth:{name:"1/10 oz Silver Round",category:"Rounds",oz:0.1},
    quarterOz:{name:"1/4 oz Silver Round",category:"Rounds",oz:0.25},
    halfOz:{name:"1/2 oz Silver Round",category:"Rounds",oz:0.5},
    bar1:{name:"1 oz Silver Bar",category:"Bars",oz:1},
    bar5:{name:"5 oz Silver Bar",category:"Bars",oz:5},
    bar10:{name:"10 oz Silver Bar",category:"Bars",oz:10},
    barKilo:{name:"1 Kilo Silver Bar",category:"Bars",oz:32.1507466},
    bar100:{name:"100 oz Silver Bar",category:"Bars",oz:100}
  };
  const totalOz = () => items.reduce((s,x)=>s+(Number(x.qty)||0)*(Number(x.oz)||0),0);
  const totalCost = () => items.reduce((s,x)=>s+(Number(x.cost)||0),0);
  const safe = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function saveLocal(){if(session)return;localStorage.setItem(STORAGE_KEY,JSON.stringify({items,sales,categoryGoals}));localStorage.setItem("silver-stack-goal",String(goal));}
  function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2600);}
  function dateLabel(d){if(!d)return "Date not recorded";return new Date(d+"T12:00:00").toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});}
  async function loadSpot(){
    try{
      const r=await fetch("https://api.gold-api.com/price/XAG",{cache:"no-store"});
      if(!r.ok)throw new Error("Price service unavailable");
      const d=await r.json();
      const p=Number(d.price ?? d.ask ?? d.rate);
      if(!Number.isFinite(p)||p<=0)throw new Error("Invalid spot quote");
      spot=p;spotUpdated=d.updatedAt||d.updated_at||d.timestamp||new Date().toISOString();
      render();
      $("spotUpdated").textContent="Updated "+new Date(spotUpdated).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});
    }catch(e){
      $("spotUpdated").textContent="Live quote unavailable";
      $("spotPrice").textContent="Unavailable";
      $("sideSpot").textContent="Unavailable";
    }
  }
  function render(){
    const oz=totalOz(), value=spot===null?null:oz*spot, cost=totalCost();
    $("totalOz").innerHTML=fmt(oz,4)+' <small>ozt</small>';
    $("meltValue").textContent=value===null?"—":money(value);
    $("itemCount").textContent=items.length;
    const knownOz=items.filter(x=>Number(x.cost)>0).reduce((s,x)=>s+Number(x.qty)*Number(x.oz),0);
    $("avgCost").textContent=knownOz>0&&cost>0?money(cost/knownOz):"—";
    $("spotPrice").textContent=spot===null?"$—":money(spot);
    $("sideSpot").textContent=spot===null?"Loading…":money(spot)+"/ozt";
    const pct=goal>0?Math.min(100,oz/goal*100):0;
    $("goalProgress").textContent=fmt(oz,2)+" / "+fmt(goal,2)+" ozt";
    $("goalPercent").textContent=fmt(pct,1)+"%";
    $("goalBar").style.width=pct+"%";
    $("remainingOz").textContent=fmt(Math.max(0,goal-oz),4)+" ozt to go";
    $("goalInput").value=goal;
    renderBreakdown();renderRecent();renderInventory();renderActivity();renderAnalytics();renderTools();renderSales();
  }
  function renderAnalytics(){
    const known=items.filter(x=>Number(x.cost)>0), cost=known.reduce((s,x)=>s+Number(x.cost),0), weight=known.reduce((s,x)=>s+Number(x.qty)*Number(x.oz),0), total=totalOz();
    const gain=spot!==null&&cost>0?weight*spot-cost:null;
    $("analyticsCost").textContent=cost>0?money(cost):"—";
    $("analyticsGain").textContent=gain===null?"—":(gain>0?"+":"")+money(gain);
    $("analyticsROI").textContent=gain===null?"—":(gain>0?"+":"")+fmt(gain/cost*100,2)+"%";
    for(const id of ["analyticsGain","analyticsROI"]) $(id).className=gain===null?"":gain<0?"negative":gain>0?"positive":"";
    $("analyticsCoverage").textContent=fmt(weight,4)+" of "+fmt(total,4)+" ozt have recorded positive purchase costs. Blank or zero costs are treated as unknown.";
    const cats=["Rounds","Bars","Constitutional","Foreign coins","Collectibles","Other"], colors=["#35685b","#d7b66d","#789b8c","#6b829b","#a68a72","#9b9ca5"];
    const groups=cats.map((name,i)=>({name,color:colors[i],oz:items.filter(x=>(cats.includes(x.category)?x.category:"Other")===name).reduce((s,x)=>s+Number(x.qty)*Number(x.oz),0)})).filter(x=>x.oz>0);
    let offset=0;const stops=groups.map(x=>{const start=offset;offset+=x.oz/total*100;return `${x.color} ${start}% ${offset}%`;});
    $("allocationChart").innerHTML=total>0?`<div class="allocation-ring" style="background:conic-gradient(${stops.join(",")})"><div><strong>${fmt(total,2)}</strong><small>ozt</small></div></div><div class="allocation-legend">${groups.map(x=>`<div><i style="background:${x.color}"></i><span>${x.name}</span><strong>${fmt(x.oz,4)} ozt · ${fmt(x.oz/total*100,1)}%</strong></div>`).join("")}</div>`:'<p class="muted">Add silver to see your allocation.</p>';
    const dates=new Map();let undated=0;
    for(const x of items){const w=Number(x.qty)*Number(x.oz);if(/^\d{4}-\d{2}-\d{2}$/.test(x.date||"")&&Number.isFinite(Date.parse(x.date))){dates.set(x.date,(dates.get(x.date)||0)+w);}else undated+=w;}
    let running=0;const points=[...dates].sort((a,b)=>a[0].localeCompare(b[0])).map(([date,w])=>({date,oz:running+=w}));
    $("growthNote").textContent="Based on dated current holdings only. "+fmt(undated,4)+" ozt without dates excluded. Edits and deletions can change this reconstructed history.";
    if(!points.length){$("growthChart").innerHTML='<p class="muted">Add purchase dates to see stack growth.</p>';return;}
    const max=Math.max(running,0.001), first=Date.parse(points[0].date), last=Date.parse(points.at(-1).date), px=p=>last===first?280:55+(Date.parse(p.date)-first)/(last-first)*475, py=p=>190-p.oz/max*155;
    $("growthChart").innerHTML=`<svg class="growth-svg" viewBox="0 0 560 235" role="img" aria-label="Cumulative dated current silver holdings"><g fill="none" stroke="#dfe6e1">${[0,.25,.5,.75,1].map(v=>`<path d="M55 ${190-v*155}H530"/>`).join("")}</g><g fill="currentColor" font-size="11">${[0,.25,.5,.75,1].map(v=>`<text x="48" y="${194-v*155}" text-anchor="end">${fmt(max*v,1)}</text>`).join("")}<text x="55" y="216">${safe(points[0].date)}</text>${last!==first?`<text x="530" y="216" text-anchor="end">${safe(points.at(-1).date)}</text>`:""}</g><polyline fill="none" stroke="#35685b" stroke-width="3" points="${points.map(p=>px(p)+","+py(p)).join(" ")}"/>${points.map(p=>`<circle cx="${px(p)}" cy="${py(p)}" r="4" fill="#35685b"><title>${safe(p.date)}: ${fmt(p.oz,4)} ozt</title></circle>`).join("")}</svg>`;
  }
  function renderBreakdown(){
    const cats=["Rounds","Bars","Constitutional","Foreign coins","Collectibles","Other"];
    const totals=cats.map(c=>({name:c,oz:items.filter(x=>x.category===c).reduce((s,x)=>s+x.qty*x.oz,0)}));
    const max=Math.max(0.0001,...totals.map(x=>x.oz));
    $("breakdown").innerHTML=totals.filter(x=>x.oz>0).map(x=>`<div class="breakdown-row"><span>${x.name}</span><div class="bar"><i style="width:${x.oz/max*100}%"></i></div><strong>${fmt(x.oz,3)}</strong></div>`).join("")||'<div class="empty-small">Add your first silver item to see the breakdown.</div>';
  }
  function renderRecent(){
    const sorted=[...items].sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||"")).slice(0,4);
    $("recentItems").innerHTML=sorted.map(x=>`<div class="recent-row"><div><strong>${safe(x.name)}</strong><small>${safe(x.category)} · ${dateLabel(x.date)}</small></div><div class="oz">${fmt(x.qty*x.oz,4)} ozt</div><div class="value">${x.cost?money(x.cost):"—"}</div></div>`).join("")||'<div class="empty-small">Your latest additions will appear here.</div>';
  }
  function visibleItems(){
    const q=$("inventorySearch").value.toLowerCase(),cat=$("categoryFilter").value;
    const list=items.filter(x=>(cat==="all"||x.category===cat)&&(`${x.name} ${x.category} ${x.dealer||""}`).toLowerCase().includes(q));
    const sort=$("inventorySort").value;return list.sort((a,b)=>sort==="name"?a.name.localeCompare(b.name):sort==="weight"||sort==="value"?b.qty*b.oz-a.qty*a.oz:sort==="cost"?b.cost-a.cost:sort==="date"?(b.date||"").localeCompare(a.date||""):(b.createdAt||"").localeCompare(a.createdAt||""));
  }
  function renderInventory(){
    const list=visibleItems();for(const id of selected)if(!list.some(x=>x.id===id))selected.delete(id);
    $("inventoryRows").innerHTML=list.map(x=>`<tr><td><input type="checkbox" data-select="${safe(x.id)}" aria-label="Select ${safe(x.name)}" ${selected.has(x.id)?"checked":""}></td><td><strong>${safe(x.name)}</strong><small>${safe(x.dealer||"")}</small></td><td>${safe(x.category)}</td><td>${fmt(x.qty,3)}</td><td><strong>${fmt(x.qty*x.oz,4)} ozt</strong></td><td>${x.cost?money(x.cost):"—"}</td><td>${spot===null?"—":money(x.qty*x.oz*spot)}</td><td>${x.purchaseSpot>0&&x.cost>0&&x.qty*x.oz>0?money(x.cost/(x.qty*x.oz)-x.purchaseSpot):"—"}</td><td class="row-actions"><button data-edit="${safe(x.id)}">Edit</button> · <button data-duplicate="${safe(x.id)}">Duplicate</button> · <button data-delete="${safe(x.id)}">Delete</button></td></tr>`).join("")||'<tr><td colspan="9" class="empty-cell">No matching silver found.</td></tr>';
    $("selectionCount").textContent=selected.size+" selected";$("selectVisible").checked=!!list.length&&selected.size===list.length;$("bulkEdit").disabled=!selected.size||busy||(!!session&&!cloudReady);
    const totals=xs=>{const w=xs.reduce((a,x)=>a+x.qty*x.oz,0),cost=xs.reduce((a,x)=>a+x.cost,0);return `${fmt(xs.reduce((a,x)=>a+x.qty,0),3)} items · ${fmt(w,4)} ozt · ${money(cost)} recorded cost · ${spot===null?"—":money(w*spot)} spot value`;};
    $("categorySummary").innerHTML=categories.map((cat,i)=>{const xs=items.filter(x=>x.category===cat),w=xs.reduce((a,x)=>a+x.qty*x.oz,0),g=Number(categoryGoals[cat])||0;return `<div class="summary-row"><strong>${cat}</strong><p>${totals(xs)}</p><button class="text-button" data-category-goal="${i}">${g?fmt(w,2)+" / "+fmt(g,2)+" ozt — edit goal":"Set goal"}</button>${g?`<div class="progress-track"><div class="progress-fill" style="width:${Math.min(100,w/g*100)}%"></div></div>`:""}</div>`;}).join("");
    const dealers=new Map();for(const x of items){const key=(x.dealer||"").trim()||"Not recorded";if(!dealers.has(key))dealers.set(key,[]);dealers.get(key).push(x);}$("dealerSummary").innerHTML=[...dealers].map(([name,xs])=>`<div class="summary-row"><strong>${safe(name)}</strong><p>${totals(xs)}</p></div>`).join("")||"No holdings recorded.";
  }
  function renderActivity(){
    const list=[...items].filter(x=>x.cost||x.date||x.dealer).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
    $("activityList").innerHTML=list.map(x=>`<div class="activity-card"><div><strong>${safe(x.name)}</strong><small>${dateLabel(x.date)} · ${safe(x.dealer||"Purchase details not recorded")} · ${fmt(x.qty*x.oz,4)} ozt</small></div><b>${x.cost?money(x.cost):"Cost not recorded"}</b></div>`).join("")||'<div class="panel empty-state">No purchases recorded yet. Add an item with its purchase cost and date to start your log.</div>';
  }
  function switchView(view){
    currentView=view;
    document.querySelectorAll(".view").forEach(el=>el.classList.add("hidden"));
    $(view+"View").classList.remove("hidden");
    document.querySelectorAll(".nav-item").forEach(el=>el.classList.toggle("active",el.dataset.view===view));
    const titles={overview:"Overview",inventory:"My inventory",activity:"Purchase log",analytics:"Portfolio analytics",tools:"Stacking tools",sales:"Sales history",settings:"Settings & account",about:"About TrackMySilver",help:"Help & FAQ",feedback:"Feedback & bug reporting",privacy:"Privacy policy",history:"Update history"};
    $("pageTitle").textContent=titles[view];$("eyebrow").textContent=view==="overview"?"YOUR COLLECTION":view.toUpperCase().replace("INVENTORY","COLLECTION");
    render();
  }
  function updateItemPreview(){
    const qty=Number($("itemQty").value)||0, oz=Number($("itemOz").value)||0;
    $("itemTotalOz").textContent=fmt(qty*oz,4)+" ozt";
  }
  function applyPreset(key){
    const p=SILVER_PRESETS[key];
    if(!p)return;
    $("itemName").value=p.name;
    $("itemCategory").value=p.category;
    $("itemOz").value=p.oz;
    updateItemPreview();
  }
  let cloudReady=false, busy=false;
  function openItem(item,duplicate=false){
    if(session&&(!cloudReady||busy)){toast("Cloud is loading or busy.");return;}
    $("itemForm").reset();$("itemId").value=duplicate?"":item?.id||"";
    $("modalTitle").textContent=duplicate?"Duplicate silver":item?"Edit silver":"Add silver";
    $("itemName").value=item?.name||"";$("itemCategory").value=item?.category||"Rounds";
    $("itemQty").value=item?.qty??1;$("itemOz").value=item?.oz??1;
    $("itemCost").value=item?.cost??"";$("itemDate").value=item?.date||new Date().toISOString().slice(0,10);
    $("itemDealer").value=item?.dealer||"";$("itemNotes").value=item?.notes||"";
    $("itemPurchaseSpot").value=duplicate?"":item?.purchaseSpot??"";if(duplicate){$("itemDate").value=new Date().toISOString().slice(0,10);$("itemCost").value="";}updateItemPreview();$("itemDialog").showModal();
  }
  $("itemForm").addEventListener("submit",async e=>{
    e.preventDefault();
    const id=$("itemId").value||crypto.randomUUID();
    const old=items.find(x=>x.id===id);
    const item={id,name:$("itemName").value.trim(),category:$("itemCategory").value,qty:Number($("itemQty").value),oz:Number($("itemOz").value),cost:Number($("itemCost").value)||0,date:$("itemDate").value,dealer:$("itemDealer").value.trim(),notes:$("itemNotes").value.trim(),purchaseSpot:Number($("itemPurchaseSpot").value)||null,createdAt:old?.createdAt||new Date().toISOString()};
    if(!item.name||!Number.isFinite(item.qty)||item.qty<=0||!Number.isFinite(item.oz)||item.oz<0){toast("Check the item name, quantity, and silver weight.");return;}
    if(session){await changeCloud(item,old);return;}
    const idx=items.findIndex(x=>x.id===id);if(idx>=0)items[idx]=item;else items.push(item);
    saveLocal();$("itemDialog").close();render();toast(idx>=0?"Item updated":"Silver added to your stack");
  });
  $("itemPreset").addEventListener("change",e=>{if(e.target.value)applyPreset(e.target.value);});
  $("itemQty").addEventListener("input",updateItemPreview);
  $("itemOz").addEventListener("input",updateItemPreview);
  $("closeDialog").onclick=$("cancelDialog").onclick=()=>$("itemDialog").close();
  $("quickAdd").onclick=()=>openItem();
  $("editGoal").onclick=()=>switchView("settings");
  $("saveGoal").onclick=()=>{const v=Number($("goalInput").value);if(v>0){goal=v;saveLocal();render();syncSettings();toast("Stacking goal updated");}};
  $("inventorySearch").addEventListener("input",renderInventory);$("categoryFilter").addEventListener("change",renderInventory);
  document.querySelectorAll(".nav-item").forEach(b=>b.onclick=()=>switchView(b.dataset.view));
  document.querySelectorAll("[data-goto]").forEach(b=>b.onclick=()=>switchView(b.dataset.goto));
  $("inventoryRows").addEventListener("click",async e=>{
    const edit=e.target.dataset.edit,del=e.target.dataset.delete,dup=e.target.dataset.duplicate;if(dup){const x=items.find(i=>i.id===dup);if(x)openItem(x,true);}
    if(edit){const x=items.find(i=>i.id===edit);if(x)openItem(x);}
    if(del&&confirm("Remove this item from your inventory?")){if(session){await changeCloud(null,items.find(i=>i.id===del));return;}items=items.filter(i=>i.id!==del);saveLocal();render();toast("Item removed");}
  });
  $("exportCsv").onclick=()=>{
    const rows=[["Name","Category","Quantity","Fine silver per item (ozt)","Total fine silver (ozt)","Purchase cost USD","Purchase date","Dealer","Notes"],...items.map(x=>[x.name,x.category,x.qty,x.oz,x.qty*x.oz,x.cost,x.date,x.dealer,x.notes])];
    const csv=rows.map(r=>r.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\n");
    downloadFile("silver-stack-inventory.csv",csv,"text/csv");toast("CSV exported");
  };
  $("downloadBackup").onclick=()=>downloadFile("silver-stack-backup.json",JSON.stringify({items,sales,goal,exportedAt:new Date().toISOString()},null,2),"application/json");
  $("clearLocal").onclick=()=>{if(confirm("This clears the inventory saved in this browser. It does not delete any cloud account data. Continue?")){if(session){toast("Sign out first.");return;}items=[];sales=[];saveLocal();render();toast("Local inventory cleared");}};
  function downloadFile(name,data,type){const a=document.createElement("a"),url=URL.createObjectURL(new Blob([data],{type}));a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);}
  function syncSettings(){if(!supabase||!session)return;supabase.from("silver_stack_settings").upsert({user_id:session.user.id,goal_oz:goal},{onConflict:"user_id"}).then(({error})=>{if(error)console.error(error);});}
  async function changeCloud(item,old){
    if(!cloudReady||busy||!session)return;
    const u=session.user.id;busy=true;renderSales();
    try{
      const payload=item&&{id:item.id,user_id:u,name:item.name,category:item.category,quantity:item.qty,fine_oz_each:item.oz,cost_total:item.cost,purchase_date:item.date||null,dealer:item.dealer,notes:item.notes,purchase_spot:item.purchaseSpot??null,created_at:item.createdAt};
      let q;
      if(old){q=(item?supabase.from("silver_stack_items").update(payload):supabase.from("silver_stack_items").delete()).eq("id",old.id).eq("user_id",u).eq("quantity",old.qty).eq("cost_total",old.cost).eq("fine_oz_each",old.oz).select("id");}else{q=supabase.from("silver_stack_items").insert(payload).select("id");}
      const {data,error}=await q;if(error||!data?.length)throw Error(error?.message||"Inventory changed on another device.");
      if(session?.user.id===u){if($("itemDialog").open)$("itemDialog").close();toast("Inventory saved");}
    }catch(e){toast(e.message);}finally{if(session?.user.id===u)await loadCloud();busy=false;renderSales();}
  }
  async function loadCloud(){
    const userId=session?.user.id;if(!userId)return;cloudReady=false;renderSales();
    const {data,error}=await supabase.from("silver_stack_items").select("*").eq("user_id",userId).order("created_at",{ascending:false});
    if(error){toast("Could not load cloud inventory: "+error.message);return;}
    if(session?.user.id!==userId)return;
    const loadedItems=(data||[]).map(x=>({id:x.id,name:x.name,category:x.category,qty:Number(x.quantity),oz:Number(x.fine_oz_each),cost:Number(x.cost_total||0),date:x.purchase_date||"",dealer:x.dealer||"",notes:x.notes||"",purchaseSpot:x.purchase_spot===null?null:Number(x.purchase_spot)||null,createdAt:x.created_at}));
    const {data:s}=await supabase.from("silver_stack_settings").select("goal_oz,category_goals").eq("user_id",userId).maybeSingle();
    if(session?.user.id!==userId)return;
    const {data:history,error:saleError}=await supabase.from("silver_stack_sales").select("*").eq("user_id",userId).order("created_at",{ascending:true});
    if(session?.user.id!==userId)return;
    if(saleError){toast("Cloud sales unavailable: "+saleError.message);return;}
    items=loadedItems;categoryGoals=s?.category_goals||{};goal=Number(s?.goal_oz||100);sales=(history||[]).map(x=>({id:x.id,itemId:x.item_id,name:x.name,qty:Number(x.quantity),oz:Number(x.fine_oz),basis:x.basis===null?null:Number(x.basis),proceeds:Number(x.proceeds),fees:Number(x.fees),date:x.sale_date,buyer:x.buyer||""}));cloudReady=true;
    render();toast("Your cloud collection is synced");
  }
  const recoveryReturn = new URLSearchParams(location.search).get("recovery")==="1";
  let recoveryMode="email";
  function openRecovery(passwordMode){
    recoveryMode=passwordMode?"password":"email";
    $("recoveryForm").reset();
    $("recoveryEmail").value=$("authEmail").value;
    $("recoveryEmailFields").classList.toggle("hidden",passwordMode);
    $("recoveryPasswordFields").classList.toggle("hidden",!passwordMode);
    $("recoveryEmail").disabled=passwordMode;
    $("newPassword").disabled=$("confirmPassword").disabled=!passwordMode;
    $("recoveryTitle").textContent=passwordMode?"Choose a new password":"Reset your password";
    $("recoveryHint").textContent=passwordMode?"Use at least 8 characters and confirm your new password.":"Enter your account email to receive a secure reset link.";
    $("submitRecovery").textContent=passwordMode?"Save new password":"Send reset email";
    $("recoveryMessage").textContent="";
    switchView("settings");
    if(!$("recoveryDialog").open)$("recoveryDialog").showModal();
  }
  function closeRecovery(){
    $("recoveryForm").reset();
    $("recoveryDialog").close();
    recoveryMode="email";
    if(recoveryReturn)history.replaceState(null,"",location.pathname);
  }
  $("forgotPassword").onclick=()=>openRecovery(false);
  $("cancelRecovery").onclick=async()=>{
    if(recoveryMode==="password" && supabase){const {error}=await supabase.auth.signOut({scope:"local"});if(error){$("recoveryMessage").textContent=error.message;return;}}
    closeRecovery();
  };
  $("recoveryDialog").addEventListener("cancel",e=>{e.preventDefault();if(!$("submitRecovery").disabled)$("cancelRecovery").click();});
  $("recoveryForm").addEventListener("submit",async e=>{
    e.preventDefault();
    const msg=$("recoveryMessage"),button=$("submitRecovery");
    if(!supabase){msg.textContent="Cloud accounts are unavailable.";return;}
    button.disabled=$("cancelRecovery").disabled=true;
    try{
      if(recoveryMode==="email"){
        const email=$("recoveryEmail").value.trim();
        if(!email||!$("recoveryEmail").checkValidity()){msg.textContent="Enter a valid email address.";return;}
        const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:"https://trackmysilver.com/?recovery=1"});
        if(error){msg.textContent="Unable to send a reset email right now. Please try again later.";return;}
        msg.textContent="If an account exists for that email, a reset link will arrive shortly. Check your spam folder too.";
      }else{
        const password=$("newPassword").value;
        if(password.length<8||password!==$("confirmPassword").value){msg.textContent="Passwords must match and contain at least 8 characters.";return;}
        if(!session){msg.textContent="Your recovery session expired. Request a new link.";return;}
        const {error}=await supabase.auth.updateUser({password});
        if(error){msg.textContent=error.message;return;}
        closeRecovery();toast("Password updated successfully");
      }
    }catch(error){msg.textContent="Unable to complete the request. Check your connection and try again.";}
    finally{button.disabled=$("cancelRecovery").disabled=false;}
  });
  async function initAuth(){
    if(!config.supabaseUrl||!config.supabaseAnonKey||!window.supabase){$("authStatus").textContent="Guest mode is ready. Cloud accounts become available after Supabase is configured in config.js.";return;}
    supabase=window.supabase.createClient(config.supabaseUrl,config.supabaseAnonKey);
    supabase.auth.onAuthStateChange((event,s)=>{
      applySession(s);
      if(event==="PASSWORD_RECOVERY" && s){openRecovery(true);}
      if(event==="SIGNED_OUT" && recoveryMode==="password"){closeRecovery();}
    });
    const {data}=await supabase.auth.getSession();
    applySession(data.session);
    if(recoveryReturn && recoveryMode!=="password"){
      openRecovery(false);
      $("recoveryMessage").textContent="This reset link is invalid or expired. Request a new email below.";
    }
  }
  function resetCollection(){
    if($("backupDialog").open)$("backupDialog").close();
    cloudReady=false;items=[];sales=[];goal=100;categoryGoals={};selected.clear();if($("bulkDialog").open)$("bulkDialog").close();
    if($("saleDialog").open)$("saleDialog").close();
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("silver-stack-goal");
    $("authEmail").value="";$("authPassword").value="";
    $("inventorySearch").value="";$("categoryFilter").value="all";
    if($("itemDialog").open)$("itemDialog").close();
    $("itemForm").reset();$("itemId").value="";
    render();
  }
  function applySession(next){
    const previous=session?.user.id;
    session=next;
    if(previous!==session?.user.id){
      resetCollection();
      if(session){const id=session.user.id;setTimeout(()=>{if(session?.user.id===id)loadCloud();},0);}
    }
    updateAuthUI();
  }
  function updateAuthUI(){
    const logged=!!session;
    $("authHeading").textContent=logged?"Account connected":"Your account";
    $("authStatus").textContent=logged?`Signed in as ${session.user.email}. Your collection is connected to cloud sync.`:"You're using guest mode. Create an account to sync your private collection across devices.";
    $("authForm").classList.toggle("hidden",logged);$("signOut").classList.toggle("hidden",!logged);
    $("accountMini").innerHTML=logged?`<span>${safe(session.user.email)}</span><small>Cloud sync enabled</small>`:"Guest collection <small>Stored on this device</small>";
  }
  $("signUp").onclick=async()=>{if(sales.length){toast("Guest sales exist. Account switching is disabled to protect them.");return;}if(!supabase){toast("Cloud setup needed first — see README.");return;}const email=$("authEmail").value,password=$("authPassword").value;if(password.length<8){toast("Use a password with at least 8 characters.");return;}const {error}=await supabase.auth.signUp({email,password});toast(error?error.message:"Check your email to confirm your account.");};
  $("signIn").onclick=async()=>{if(sales.length){toast("Guest sales exist. Export your backup before switching accounts; account switching clears guest data.");return;}if(!supabase){toast("Cloud setup needed first — see README.");return;}const {error}=await supabase.auth.signInWithPassword({email:$("authEmail").value,password:$("authPassword").value});if(error)toast(error.message);};
  $("signOut").onclick=async()=>{const {error}=await supabase.auth.signOut();if(error){toast(error.message);return;}session=null;resetCollection();updateAuthUI();switchView("settings");toast("Signed out");};
  const faceValues={dime:.1,quarter:.25,half:.5,morgan:1,peace:1,kennedy40:.5,warNickel:.05};
  for(const key of Object.keys(faceValues)){const o=document.createElement("option");o.value=key;o.textContent=SILVER_PRESETS[key].name;$("coinType").append(o);}
  function renderTools(){
    const manual=$("manualSpot").checked;$("toolSpot").disabled=!manual;
    if(!manual)$("toolSpot").value=spot===null?"":spot;
    const s=Number($("toolSpot").value), validSpot=s>0&&Number.isFinite(s);
    $("toolSpotNote").textContent=manual?"Manual quote (does not change portfolio values).":validSpot?"Using the latest available market quote.":"Quote unavailable; enable manual override.";
    function results(id,w,priceId,face){
      const raw=$(priceId).value,p=Number(raw),validPrice=raw!==""&&p>=0&&Number.isFinite(p),m=w*s;
      if(!Number.isFinite(w)||w<=0){$(id).textContent="Enter a valid positive quantity and weight.";return;}
      const rows=[["Fine silver",fmt(w,4)+" ozt"],...(face===undefined?[]:[["Face value",money(face)]]),["Melt value",validSpot?money(m):"—"],["Cost per ounce",validPrice?money(p/w):"—"],["Total premium",validPrice&&validSpot?money(p-m):"—"],["Premium per ounce",validPrice&&validSpot?money((p-m)/w):"—"],["Premium percentage",validPrice&&validSpot?fmt((p-m)/m*100,2)+"%":"—"]];
      $(id).innerHTML=rows.map(([a,b])=>`<div><span>${a}</span><strong>${b}</strong></div>`).join("");
    }
    const q=Number($("bullQty").value),w=Number($("bullOz").value);results("bullResults",q>0&&w>0?q*w:0,"bullPrice");
    const k=$("coinType").value,f=faceValues[k],a=Number($("coinAmount").value),n=$("coinMode").value==="face"?a/f:a;
    results("coinResults",n>0&&Math.abs(n-Math.round(n))<1e-7?Math.round(n)*SILVER_PRESETS[k].oz:0,"coinPrice",Math.round(n)*f);
  }
  for(const id of ["manualSpot","toolSpot","bullQty","bullOz","bullPrice","coinType","coinMode","coinAmount","coinPrice"]) $(id).addEventListener("input",renderTools);
  let pendingBackup=null;
  function validateBackup(b){
    if(b?.sales?.length)throw Error("Backups containing sales cannot yet be imported. Keep this file for your records.");
    if(!b||!Array.isArray(b.items)||b.items.length>10000)throw Error("Invalid backup format or too many entries.");
    const ids=new Set(), cats=["Rounds","Bars","Constitutional","Foreign coins","Collectibles","Other"];
    const clean=b.items.map(x=>{
      if(!x||typeof x.id!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x.id)||ids.has(x.id))throw Error("Invalid or duplicate item ID.");ids.add(x.id);
      if(typeof x.name!=="string"||!x.name.trim()||!cats.includes(x.category)||!Number.isFinite(x.qty)||x.qty<=0||!Number.isFinite(x.oz)||x.oz<0||!Number.isFinite(x.cost)||x.cost<0||!Number.isFinite(x.qty*x.oz))throw Error("Invalid inventory entry.");
      const date=x.date||"";if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date))throw Error("Invalid purchase date.");
      return {id:x.id,name:x.name,category:x.category,qty:x.qty,oz:x.oz,cost:x.cost,date,dealer:String(x.dealer||""),notes:String(x.notes||""),purchaseSpot:Number.isFinite(x.purchaseSpot)&&x.purchaseSpot>0?x.purchaseSpot:null,createdAt:typeof x.createdAt==="string"&&Number.isFinite(Date.parse(x.createdAt))?new Date(x.createdAt).toISOString():new Date().toISOString()};
    });return {items:clean,goal:Number.isFinite(b.goal)&&b.goal>0?b.goal:null};
  }
  $("importBackup").onclick=()=>{if(session){toast("For safety, cloud imports are not enabled yet. Use guest mode.");return;}$("backupFile").click();};
  $("backupFile").onchange=async()=>{const f=$("backupFile").files[0];$("backupFile").value="";if(!f)return;try{if(f.size>10000000)throw Error("Backup exceeds 10 MB.");const b=validateBackup(JSON.parse(await f.text()));if(session)throw Error("Sign out before importing.");pendingBackup=b;$("backupPreview").textContent=`${b.items.length} entries · ${fmt(b.items.reduce((s,x)=>s+x.qty*x.oz,0),4)} ozt. Current inventory: ${items.length} entries.`;$("backupMode").value="merge";$("restoreGoal").checked=false;$("restoreGoal").disabled=b.goal===null;$("backupDialog").showModal();}catch(e){toast(e.message);}};
  $("cancelBackup").onclick=()=>$("backupDialog").close();$("backupDialog").addEventListener("close",()=>{pendingBackup=null;});
  $("backupForm").onsubmit=e=>{e.preventDefault();if(!pendingBackup||session){$("backupDialog").close();return;}const replace=$("backupMode").value==="replace";if(sales.length){toast("Import disabled while sales history exists to avoid restoring sold holdings.");return;}if(replace&&!confirm("Replace your entire guest inventory? This cannot be undone without a backup."))return;
    const key=x=>JSON.stringify([x.name,x.category,x.qty,x.oz,x.cost,x.date,x.dealer,x.notes]);const ids=new Set(items.map(x=>x.id)),keys=new Set(items.map(key));const incoming=pendingBackup.items.filter(x=>replace||(!ids.has(x.id)&&!keys.has(key(x))));
    const next=replace?incoming:[...items,...incoming], nextGoal=$("restoreGoal").checked?pendingBackup.goal:goal;
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify({items:next,sales,categoryGoals}));localStorage.setItem("silver-stack-goal",String(nextGoal));}catch(err){toast("Could not save backup to this browser.");return;}
    items=next;goal=nextGoal;$("backupDialog").close();render();toast(`Imported ${incoming.length} entries`);
  };

  function saleDraft(){
    const x=items.find(i=>i.id===$("saleItem").value), q=Number($("saleQty").value), p=Number($("salePrice").value), f=Number($("saleFees").value);
    if(!x||!Number.isFinite(q)||q<=0||q>Number(x.qty)||!$("salePrice").value||!Number.isFinite(p)||p<0||!Number.isFinite(f)||f<0||!$("saleDate").value)return null;
    const basis=Number(x.cost)>0?Math.round(Number(x.cost)*q/Number(x.qty)*100)/100:null;
    return {id:crypto.randomUUID(),itemId:x.id,name:x.name,qty:q,oz:q*Number(x.oz),basis,proceeds:p,fees:f,date:$("saleDate").value,buyer:$("saleBuyer").value.trim()};
  }
  function renderSales(){
    const known=sales.filter(s=>s.basis!==null), basis=known.reduce((a,s)=>a+s.basis,0), gain=known.reduce((a,s)=>a+s.proceeds-s.fees-s.basis,0);
    const card=(label,value)=>`<article class="stat-card"><span>${label}</span><strong>${value}</strong></article>`;
    const realized=card("REALIZED PROFIT / LOSS",known.length?money(gain):"—")+card("REALIZED ROI",basis>0?fmt(gain/basis*100,2)+"%":"—");
    $("realizedSummary").innerHTML=session&&!cloudReady?card("REALIZED RETURNS","Unavailable"):realized;
    $("salesSummary").innerHTML=card("SILVER SOLD",fmt(sales.reduce((a,s)=>a+s.oz,0),4)+" ozt")+card("GROSS PROCEEDS",money(sales.reduce((a,s)=>a+s.proceeds,0)))+realized;
    $("salesStatus").textContent=session?(cloudReady?"Sales are saved to your account. Returns exclude unknown purchase costs.":"Cloud data loading or unavailable. Refresh to retry."):"Guest sales are saved on this device. Returns exclude sales with unknown purchase costs.";
    $("newSale").disabled=(!!session&&!cloudReady)||busy||!items.length;
    $("salesList").innerHTML=sales.slice().reverse().map(s=>`<div class="activity-card"><div><strong>${safe(s.name)}</strong><small>${safe(s.date)} · ${fmt(s.qty,4)} items · ${fmt(s.oz,4)} ozt · ${safe(s.buyer)}</small><small>Gross ${money(s.proceeds)} · Fees ${money(s.fees)} · Cost ${s.basis===null?"Unknown":money(s.basis)}</small></div><b>${s.basis===null?"Unknown gain":money(s.proceeds-s.fees-s.basis)}</b></div>`).join("")||'<p class="muted">No sales recorded.</p>';
  }
  function previewSale(){const s=saleDraft();$("salePreview").textContent=s?`${fmt(s.oz,4)} ozt sold · Net ${money(s.proceeds-s.fees)} · Realized gain ${s.basis===null?"unknown":money(s.proceeds-s.fees-s.basis)}`:"Enter a valid quantity within the selected lot and sale price.";}
  $("newSale").onclick=()=>{if((session&&!cloudReady)||busy||!items.length)return;$("saleForm").reset();$("saleItem").replaceChildren(...items.map(x=>{const o=document.createElement("option");o.value=x.id;o.textContent=x.name+" — "+x.qty+" available";return o;}));$("saleQty").value=Math.min(1,Number(items[0].qty));$("saleDate").value=new Date().toISOString().slice(0,10);previewSale();$("saleDialog").showModal();};
  $("saleForm").addEventListener("input",previewSale);$("cancelSale").onclick=()=>$("saleDialog").close();
  $("saleForm").onsubmit=async e=>{e.preventDefault();if(busy||(session&&!cloudReady))return;const s=saleDraft();if(!s){toast("Check sale details.");return;}if(!confirm("Record this sale and deduct the quantity? This cannot be undone in this release."))return;
    if(session){const u=session.user.id,x=items.find(i=>i.id===s.itemId);busy=true;renderSales();const button=$("saleForm").querySelector('button[type="submit"],button:not([type])');if(button)button.disabled=true;
      try{const {error}=await supabase.rpc("record_silver_sale",{p_id:s.id,p_item:s.itemId,p_qty:s.qty,p_proceeds:s.proceeds,p_fees:s.fees,p_date:s.date,p_buyer:s.buyer,p_expected_qty:x.qty,p_expected_cost:x.cost,p_expected_oz:x.oz});if(error)throw Error(error.message);if(session?.user.id===u)toast("Cloud sale recorded");}catch(e){toast("Sale result uncertain or rejected. Check history before retrying: "+e.message);}finally{if(session?.user.id===u){$("saleDialog").close();await loadCloud();}busy=false;if(button)button.disabled=false;renderSales();}return;}
    const next=items.map(x=>x.id===s.itemId?{...x,qty:Number(x.qty)-s.qty,cost:s.basis===null?0:Math.max(0,Math.round((Number(x.cost)-s.basis)*100)/100)}:x).filter(x=>x.qty>0), history=[...sales,s];
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify({items:next,sales:history,categoryGoals}));}catch(e){toast("Sale not saved. Inventory unchanged.");return;}
    items=next;sales=history;$("saleDialog").close();render();toast("Sale recorded");
  };

  $("feedbackForm").addEventListener("submit",async e=>{e.preventDefault();const form=e.currentTarget,button=form.querySelector('button[type="submit"]'),status=$("feedbackStatus");button.disabled=true;status.textContent="Sending…";try{const response=await fetch("/",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams(new FormData(form)).toString()});if(!response.ok)throw Error("Submission failed");form.reset();status.textContent="Report submitted. Thank you for your feedback!";}catch(err){status.textContent="Could not send feedback. Your message is still here; please try again later.";}finally{button.disabled=false;}});

  $("inventorySort").onchange=renderInventory;
  $("inventoryRows").addEventListener("change",e=>{const id=e.target.dataset.select;if(id){e.target.checked?selected.add(id):selected.delete(id);renderInventory();}});
  $("selectVisible").onchange=e=>{selected.clear();if(e.target.checked)visibleItems().forEach(x=>selected.add(x.id));renderInventory();};
  $("bulkEdit").onclick=()=>{if(!selected.size||busy||(session&&!cloudReady))return;$("bulkForm").reset();$("bulkDialog").showModal();};
  $("cancelBulk").onclick=()=>$("bulkDialog").close();
  $("bulkForm").onsubmit=async e=>{e.preventDefault();if(busy||(session&&!cloudReady))return;const patch={},cat=$("bulkCategory").value;if(cat)patch.category=cat;if($("bulkDealerChange").checked)patch.dealer=$("bulkDealer").value.trim();const ids=[...selected];if(!ids.length||!Object.keys(patch).length)return;if(!confirm(`Update ${ids.length} entries?`))return;
    if(session){const u=session.user.id;busy=true;try{const {data,error}=await supabase.from("silver_stack_items").update(patch).eq("user_id",u).in("id",ids).select("id");if(error)throw Error(error.message);if(session?.user.id===u)toast(`${data.length} entries updated`);}catch(err){toast(err.message);}finally{if(session?.user.id===u)await loadCloud();busy=false;}}else{items=items.map(x=>ids.includes(x.id)?{...x,...patch}:x);saveLocal();toast("Entries updated");}selected.clear();$("bulkDialog").close();render();};
  $("categorySummary").onclick=async e=>{if(e.target.dataset.categoryGoal===undefined||busy||(session&&!cloudReady))return;const cat=categories[Number(e.target.dataset.categoryGoal)],raw=prompt(`Goal for ${cat} in troy ounces (0 removes goal)`,categoryGoals[cat]||"");if(raw===null)return;const n=Number(raw);if(!Number.isFinite(n)||n<0||n>1e9){toast("Enter a valid goal");return;}const next={...categoryGoals};if(n)next[cat]=n;else delete next[cat];if(session){const u=session.user.id;busy=true;try{const {error}=await supabase.from("silver_stack_settings").upsert({user_id:u,category_goals:next},{onConflict:"user_id"});if(error)throw Error(error.message);if(session?.user.id!==u)return;}catch(err){toast(err.message);return;}finally{busy=false;}}categoryGoals=next;saveLocal();render();};
  $("printInventory").onclick=()=>{if(session&&!cloudReady)return;window.print();};
  if("serviceWorker" in navigator && location.protocol.startsWith("http"))navigator.serviceWorker.register("./sw.js", {updateViaCache:"none"}).then(reg=>reg.update()).catch(()=>{});
  if(config.supabaseUrl&&config.supabaseAnonKey&&!localStorage.getItem("silver-stack-cache-isolated-v2")){resetCollection();localStorage.setItem("silver-stack-cache-isolated-v2","1");}
  render();loadSpot();setInterval(loadSpot,30000);initAuth();
})();