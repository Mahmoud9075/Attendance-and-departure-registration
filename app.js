/* ========= إعدادات عامة ========= */

// (اختياري) لو هتستخدم Google Apps Script كوسيط بدل الإرسال المباشر
const GOOGLE_APPS_SCRIPT_URL = "";

// رابط Airtable Automation Webhook (تأكد إنه بتاعك)
const AIRTABLE_WEBHOOK_URL =
  "https://hooks.airtable.com/workflows/v1/genericWebhook/appzxGL0hH1jpxMM7/wflWj5y96rbaODAAA/wtrzdV1KGkmzggQA9";

/* ===== تخزين/عرض محلي: نحتفظ بآخر تسجيل لكل موظف فقط ===== */
const SAVE_LOCALLY   = true;  // نخزن آخر تسجيل (يستبدل القديم)
const SHOW_LOCAL_LOG = true;  // نعرض بطاقة واحدة بآخر تسجيل للموظف المختار

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

/* ========= اقتراحات البحث الفورية (اختياري) ========= */
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

  searchInput.addEventListener("focus", ()=>{
    const q = searchInput.value.trim().toLowerCase();
    if(!q) return;
    const filtered = EMPLOYEES.filter(n => n.toLowerCase().includes(q));
    showSuggestions(filtered.slice(0,20));
  });

  document.addEventListener("click", (e)=>{
    if(!e.target.closest(".search-wrap") && suggestionsEl){
      suggestionsEl.classList.add("hidden");
    }
  });
}

/* ========= تغيير الاسم -> نعرض آخر تسجيل له فقط ========= */
if (employeeSelect && SHOW_LOCAL_LOG){
  employeeSelect.addEventListener("change", ()=> renderLocalLog());
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
if (submitBtn){
  submitBtn.addEventListener("click", onSubmit);
}

async function onSubmit(){
  if (hint) hint.textContent="";
  const name=(employeeSelect?.value||"").trim();
  if(!name){ return setStatus("err","اختر اسم الموظف أولًا."); }

  // تنبيه لو رابط الـWebhook مش متضبط
  if(!AIRTABLE_WEBHOOK_URL || !/^https:\/\/hooks\.airtable\.com\/workflows\/v1\/genericWebhook\//.test(AIRTABLE_WEBHOOK_URL)){
    return setStatus("err","رابط Airtable Webhook غير مضبوط. عدّل السطر في app.js.");
  }

  setStatus("warn","جارٍ تحسين دقة الموقع...");
  try{
    // حاول الوصول لدقة ≤ 30م أو سلّم أفضل نتيجة بعد 10 ثواني
    const pos = await getBestPosition({ desiredAccuracy: 30, hardTimeoutMs: 10000 });
    const { latitude, longitude, accuracy } = pos.coords;

    const pretty = await reverseGeocodePrecise(latitude, longitude); // الدولة – المحافظة – المكان بالضبط

    const now = new Date();
    const record = {
      name,
      action: currentAction,
      address_text: pretty.text,
      address_parts: pretty.parts,   // {country, governorate, exact, city}
      lat: latitude,
      lon: longitude,
      gps_accuracy_m: Math.round(accuracy),
      timestamp_iso: now.toISOString(),
      time_hhmm: now.toLocaleTimeString("ar-EG",{hour:"2-digit",minute:"2-digit"})
    };

    // خزّن محليًا: آخر تسجيل فقط (يستبدل القديم)
    if (SAVE_LOCALLY) upsertLocalRecord(record);

    // (اختياري) Google Sheets
    if (GOOGLE_APPS_SCRIPT_URL){
      try{
        fetch(GOOGLE_APPS_SCRIPT_URL,{
          method:"POST", mode:"no-cors",
          headers:{ "Content-Type":"application/json" },
          body:JSON.stringify(record)
        }).catch(()=>{});
      }catch(_){}
    }

    // إرسال مباشر إلى Airtable كـ JSON
    await sendToAirtableWebhook(record);

    setStatus("ok","تم التسجيل بنجاح.");
    if (accuracyBadge) accuracyBadge.textContent = `دقة: ${record.gps_accuracy_m}م`;
    if (hint)           hint.textContent = `الموقع: ${record.address_text}`;

    console.log("تم إرسال Webhook:", {
      name: record.name,
      action: record.action,
      address_text: record.address_text,
      lat: record.lat,
      lon: record.lon,
      timestamp_iso: record.timestamp_iso,
      accuracy: record.gps_accuracy_m ?? null
    });

    if (SHOW_LOCAL_LOG) renderLocalLog();

  }catch(err){
    console.error(err);
    setStatus("err","تعذّر تحديد الموقع بدقة. فعّل GPS وحاول مجددًا.");
    if (accuracyBadge) accuracyBadge.textContent = "دقة: —";
  }
}

/* ========= إرسال إلى Airtable Webhook ========= */
async function sendToAirtableWebhook(record){
  const payload = {
    name: record.name,
    action: record.action,
    address_text: record.address_text,
    lat: record.lat,
    lon: record.lon,
    timestamp_iso: record.timestamp_iso,
    accuracy: record.gps_accuracy_m ?? null
  };

  try {
    const res = await fetch(AIRTABLE_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    // بعض البيئات قد تمنع قراءة الرد بسبب CORS، لكن الطلب يصل للويبهوك.
    // لو متاح، نطبع الرد:
    try { console.log("Webhook response:", await res.clone().text()); } catch(_) {}
  } catch (e) {
    console.error("Airtable webhook error", e);
  }
}


/* ========= مسح السجل المحلي ========= */
if (clearLocalBtn){
  clearLocalBtn.addEventListener("click", ()=>{
    localStorage.removeItem("attendanceLastByName");
    if (SHOW_LOCAL_LOG) renderLocalLog();
    setStatus("ok","تم مسح السجل المحلي.");
  });
}

/* ========= تحديد الموقع بدقة أعلى ========= */
function getBestPosition({ desiredAccuracy = 30, hardTimeoutMs = 10000 } = {}) {
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
        else if (accuracy <= 100)             accuracyBadge.classList.add("warn");
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

    const error = (err) => { if (!best) reject(err); };

    const wid = navigator.geolocation.watchPosition(success, error, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15000
    });

    const timer = setTimeout(() => {
      navigator.geolocation.clearWatch(wid);
      if (best) { resolved = true; resolve(best); }
      else reject(new Error("Timeout: لم نتمكن من الحصول على موقع جيد"));
    }, hardTimeoutMs);
  });
}

/* ========= عكس الترميز بدقة أعلى ========= */
async function reverseGeocodePrecise(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&accept-language=ar&zoom=18&addressdetails=1&lat=${lat}&lon=${lon}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Reverse geocoding failed");
  const data = await res.json();
  const a = data.address || {};

  const country     = a.country || "";
  const governorate = a.state || a.region || a.county || a.province || a.state_district || "";
  const city        = a.city || a.town || a.village || a.municipality || a.city_district || "";

  const exactParts = [
    a.road, a.house_number, a.building, a.block,
    a.neighbourhood, a.suburb, a.quarter, a.residential, a.hamlet
  ].filter(Boolean);

  const exact = exactParts.join("، ");

  const parts = { country, governorate, exact, city };
  const text = [country, governorate, exact || city].filter(Boolean).join(" – ");
  return { parts, text: text || (data.display_name || "").replaceAll(",", " – ") || "غير محدد" };
}

/* ========= تخزين/عرض محلي: سجل واحد لكل موظف ========= */
function getLocalMap(){
  try{
    return JSON.parse(localStorage.getItem("attendanceLastByName") || "{}");
  }catch{
    return {};
  }
}
function setLocalMap(map){
  localStorage.setItem("attendanceLastByName", JSON.stringify(map));
}
function upsertLocalRecord(rec){
  if (!SAVE_LOCALLY) return;
  const map = getLocalMap();
  map[rec.name] = rec; // استبدل القديم بالجديد لنفس الاسم
  setLocalMap(map);
}
function getLastRecordFor(name){
  const map = getLocalMap();
  return map[name] || null;
}

/* ========= عرض بطاقة السجل الأخير للموظف ========= */
function renderLocalLog(){
  if (!SHOW_LOCAL_LOG || !logBody) return;

  const selected=(employeeSelect?.value||"").trim();
  logBody.innerHTML="";

  if (!selected){
    const div=document.createElement("div");
    div.className="empty";
    div.textContent="اختر اسمًا لعرض آخر تسجيل له";
    logBody.appendChild(div);
    return;
  }

  const r = getLastRecordFor(selected);
  if (!r){
    const div=document.createElement("div");
    div.className="empty";
    div.textContent="لا يوجد تسجيل سابق لهذا الموظف";
    logBody.appendChild(div);
    return;
  }

  // بطاقة واحدة فقط
  const wrap=document.createElement("div"); wrap.className="row-item";

  const name=document.createElement("div"); name.textContent=r.name;

  const action=document.createElement("div");
  const badge=document.createElement("span");
  badge.className="badge " + (r.action==="دخول" ? "in" : "out");
  badge.textContent=r.action;
  action.appendChild(badge);

  const loc=document.createElement("div");
  loc.className="location";
  loc.textContent=r.address_text || "—";

  const time=document.createElement("div");
  time.className="time";
  const dt=new Date(r.timestamp_iso);
  const dateStr=dt.toLocaleDateString("ar-EG",{year:"numeric",month:"2-digit",day:"2-digit"});
  const timeStr=dt.toLocaleTimeString("ar-EG",{hour:"2-digit",minute:"2-digit"});
  time.innerHTML=`<span style="direction:ltr; display:inline-block;">${dateStr} ${timeStr}</span>`;

  wrap.appendChild(name);
  wrap.appendChild(action);
  wrap.appendChild(loc);
  wrap.appendChild(time);
  logBody.appendChild(wrap);
}

/* ========= حالة الواجهة ========= */
function setStatus(kind, text){
  if (!statusDot) return;
  statusDot.classList.remove("ok","warn","err");
  statusDot.classList.add(kind);
  statusDot.textContent=text;
}
