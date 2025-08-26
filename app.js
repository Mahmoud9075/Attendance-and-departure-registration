/* ========= إعدادات عامة ========= */

// رابط Zapier Webhook الخاص بك (Trigger: Webhooks by Zapier → Catch Hook)
const ZAPIER_WEBHOOK_URL = "https://hooks.zapier.com/hooks/catch/24367588/uhbefux/";

/* ===== تخزين/عرض محلي ===== */
const SAVE_LOCALLY   = true;
const SHOW_LOCAL_LOG = true;

// أسماء الموظفين
const EMPLOYEES = [
  "Amna Al-Shehhi","Saman","Sufiyan","Subhan","Vangelyn","Swaroop","Nada Farag","Aya","Maysa",
  "Rajeh","Jaber","Ali amallah","Riham Al-Abri","Maryam Al-Futaisi","Salma Al-Shibli","Raqia Al-Suri",
  "Jihad | Operations","Nada | Operations","Aisha | Operations","Kholoud | Operations","Israa – Hormuz Designer",
  "Mona Ibrahim","Trusila Thuo","Kholoud | Marketing","Alia | Marketing"
];

/* ========= مراجع عناصر الواجهة ========= */
const searchInput    = document.getElementById("search");
const suggestionsEl  = document.getElementById("suggestions");
const employeeSelect = document.getElementById("employee");
const btnIn          = document.getElementById("btn-in");
const btnOut         = document.getElementById("btn-out");
const submitBtn      = document.getElementById("submitBtn");
const clearLocalBtn  = document.getElementById("clearLocalBtn");
const statusDot      = document.getElementById("statusDot");
const accuracyBadge  = document.getElementById("accuracyBadge");
const hint           = document.getElementById("hint");
const logBody        = document.getElementById("logBody");

let currentAction = "دخول";

/* ========= تهيئة ========= */
(function init(){
  fillEmployees(EMPLOYEES);
  setActionButton("دخول");

  if (!SHOW_LOCAL_LOG && logBody)      logBody.style.display = "none";
  if (!SAVE_LOCALLY  && clearLocalBtn) clearLocalBtn.style.display = "none";

  if (SHOW_LOCAL_LOG) renderLocalLog();
  if (statusDot) { statusDot.className="status ok"; statusDot.textContent="جاهز"; }
})();

/* ========= تعبئة قائمة الأسماء ========= */
function fillEmployees(list){
  if (!employeeSelect) return;
  employeeSelect.querySelectorAll("option:not(:first-child)").forEach(o=>o.remove());
  list.forEach(name=>{
    const opt=document.createElement("option");
    opt.value=name; opt.textContent=name;
    employeeSelect.appendChild(opt);
  });
}

/* ========= البحث الفوري ========= */
function showSuggestions(items){
  if (!suggestionsEl) return;
  suggestionsEl.innerHTML = "";
  if(!items.length){ suggestionsEl.classList.add("hidden"); return; }
  items.forEach(name=>{
    const li=document.createElement("li");
    li.textContent=name;
    li.addEventListener("mousedown", e=>{
      e.preventDefault();
      if (searchInput) searchInput.value = name;
      suggestionsEl.classList.add("hidden");
      fillEmployees([name]);
      if (employeeSelect) employeeSelect.value = name;
      if (SHOW_LOCAL_LOG) renderLocalLog();
    });
    suggestionsEl.appendChild(li);
  });
  suggestionsEl.classList.remove("hidden");
}

if (searchInput){
  searchInput.addEventListener("input", ()=>{
    const q = searchInput.value.trim().toLowerCase();
    const filtered = EMPLOYEES.filter(n => n.toLowerCase().includes(q));
    fillEmployees(filtered.length ? filtered : EMPLOYEES);
    if(q){ showSuggestions(filtered.slice(0,20)); }
    else if (suggestionsEl) { suggestionsEl.classList.add("hidden"); }
  });

  document.addEventListener("click", (e)=>{
    if(!e.target.closest(".search-wrap") && suggestionsEl){
      suggestionsEl.classList.add("hidden");
    }
  });
}

/* ========= تبديل الحركة ========= */
if (btnIn)  btnIn.addEventListener("click",()=> setActionButton("دخول"));
if (btnOut) btnOut.addEventListener("click",()=> setActionButton("انصراف"));

function setActionButton(action){
  currentAction = action;
  if(!btnIn || !btnOut) return;
  if(action==="دخول"){ btnIn.classList.add("btn-primary"); btnOut.classList.remove("btn-primary"); }
  else               { btnOut.classList.add("btn-primary"); btnIn.classList.remove("btn-primary"); }
}

/* ========= زر تسجيل الآن ========= */
if (submitBtn){ submitBtn.addEventListener("click", onSubmit); }

async function onSubmit(){
  if (hint) hint.textContent="";
  const name=(employeeSelect?.value||"").trim();
  if(!name){ return setStatus("err","اختر اسم الموظف أولًا."); }

  if(!ZAPIER_WEBHOOK_URL.startsWith("https://hooks.zapier.com/hooks/catch/")){
    return setStatus("err","رابط Zapier Webhook غير مضبوط.");
  }

  setStatus("warn","جارٍ تحديد الموقع...");
  try{
    const pos = await getBestPosition({ desiredAccuracy: 120, hardTimeoutMs: 15000 });
    const { latitude, longitude, accuracy } = pos.coords;

    const pretty = await reverseGeocodePrecise(latitude, longitude);

    const now = new Date();
    const record = {
      name,
      action: currentAction,
      address_text: pretty.text,
      lat: latitude,
      lon: longitude,
      accuracy: Math.round(accuracy),
      timestamp_iso: now.toISOString()
    };

    if (SAVE_LOCALLY) upsertLocalRecord(record);

    await sendToZapier(record);

    setStatus("ok","تم التسجيل بنجاح.");
    if (accuracyBadge) accuracyBadge.textContent = `دقة: ${record.accurي}م`.replace("accurي","accuracy"); // حماية بسيطة لو محرك غيّر الحروف
    if (hint)           hint.textContent = `الموقع: ${record.address_text}`;
    if (SHOW_LOCAL_LOG) renderLocalLog();

  }catch(err){
    console.error(err);
    setStatus("err","تعذّر تحديد الموقع بدقة. فعّل GPS وحاول مجددًا.");
    if (accuracyBadge) accuracyBadge.textContent = "دقة: —";
  }
}

/* ========= إرسال إلى Zapier Webhook ========= */
async function sendToZapier(record){
  // الإرسال الموصى به: JSON + UTF-8 (يحافظ على العربي)
  try {
    const res = await fetch(ZAPIER_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8", "Accept": "application/json" },
      body: JSON.stringify(record)
    });
    try { console.log("Zapier response:", await res.clone().text()); } catch(_) {}
  } catch (e) {
    console.error("Zapier webhook error", e);
  }

  /* // بديل (لو شوفت ???? جوه Zapier Trigger): استخدم FormData وغيّر المابينج في Zapier لـ payload.*
  const fd = new FormData();
  for (const [k,v] of Object.entries(record)) fd.append(k, String(v ?? ""));
  await fetch(ZAPIER_WEBHOOK_URL, { method:"POST", body: fd });
  */
}

/* ========= تحديد الموقع (أفضل نتيجة خلال مهلة) ========= */
function getBestPosition({ desiredAccuracy = 120, hardTimeoutMs = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Geolocation unavailable"));

    let best = null;
    let resolved = false;

    const success = (pos) => {
      const { accuracy } = pos.coords;
      if (!best || accuracy < best.coords.accuracy) best = pos;

      if (accuracyBadge) {
        accuracyBadge.classList.remove("ok","warn","err");
        if (accuracy <= desiredAccuracy)      accuracyBadge.classList.add("ok");
        else if (accuracy <= 200)             accuracyBadge.classList.add("warn");
        else                                  accuracyBadge.classList.add("err");
        accuracyBadge.textContent = `دقة: ${Math.round(accuracy)}م`;
      }

      if (!resolved && accuracy <= desiredAccuracy) {
        resolved = true;
        navigator.geolocation.clearWatch(wid);
        clearTimeout(timer);
        resolve(pos);
      }
    };

    const wid = navigator.geolocation.watchPosition(success, ()=>{}, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 20000
    });

    const timer = setTimeout(() => {
      navigator.geolocation.clearWatch(wid);
      if (best) resolve(best);
      else reject(new Error("Timeout: لم نتمكن من الحصول على موقع"));
    }, hardTimeoutMs);
  });
}

/* ========= عكس الترميز (عنوان عربي مرتب) ========= */
async function reverseGeocodePrecise(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&accept-language=ar&zoom=18&addressdetails=1&lat=${lat}&lon=${lon}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Reverse geocoding failed");
  const data = await res.json();
  const a = data.address || {};
  const country     = a.country || "";
  const governorate = a.state || a.region || a.county || a.province || a.state_district || "";
  const city        = a.city || a.town || a.village || a.municipality || a.city_district || "";
  const exact       = [a.road, a.house_number, a.neighbourhood, a.suburb, a.quarter, a.building]
                      .filter(Boolean).join("، ");
  const text = [country, governorate, exact || city].filter(Boolean).join(" – ");
  return { text: text || (data.display_name || "").replaceAll(",", " – ") || "غير محدد" };
}

/* ========= السجل المحلي ========= */
function getLocalMap(){
  try{ return JSON.parse(localStorage.getItem("attendanceLastByName") || "{}"); }
  catch{ return {}; }
}
function setLocalMap(map){ localStorage.setItem("attendanceLastByName", JSON.stringify(map)); }
function upsertLocalRecord(rec){ const map=getLocalMap(); map[rec.name]=rec; setLocalMap(map); }
function getLastRecordFor(name){ return getLocalMap()[name] || null; }

function renderLocalLog(){
  if (!SHOW_LOCAL_LOG || !logBody) return;
  const selected=(employeeSelect?.value||"").trim();
  logBody.innerHTML="";
  if (!selected){
    logBody.innerHTML="<div class='empty'>اختر اسمًا لعرض آخر تسجيل له</div>"; return;
  }
  const r=getLastRecordFor(selected);
  if (!r){
    logBody.innerHTML="<div class='empty'>لا يوجد تسجيل سابق لهذا الموظف</div>"; return;
  }
  const wrap=document.createElement("div"); wrap.className="row-item";
  wrap.innerHTML=`
    <div>${r.name}</div>
    <div><span class="badge ${r.action==="دخول"?"in":"out"}">${r.action}</span></div>
    <div class="location">${r.address_text||"—"}</div>
    <div class="time"><span style="direction:ltr;">${new Date(r.timestamp_iso).toLocaleString("ar-EG")}</span></div>
  `;
  logBody.appendChild(wrap);
}

/* ========= حالة الواجهة ========= */
function setStatus(kind, text){
  if (!statusDot) return;
  statusDot.classList.remove("ok","warn","err");
  statusDot.classList.add(kind);
  statusDot.textContent=text;
}
