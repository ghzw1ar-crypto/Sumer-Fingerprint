const SUMER_SUPABASE_URL='https://glbugvsorxtzixgexdak.supabase.co';
const SUMER_SUPABASE_KEY='sb_publishable_8iv3CIQ3MaQ6E9oPgK6N8A_KTYGp-V6';
(function(){
  const nativeFetch=window.fetch.bind(window);
  const STORAGE='sumer_auth_session_v2';
  let resolveReady, rejectReady;
  const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
  window.sumerAuthReady=ready;
  const file=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  const isLogin=file==='sumer_login.html';
  const routePermissions={
    'sumer_attendance_live.html':'attendance',
    'sumer_employees_shifts.html':'employees',
    'sumer_attendance_reports.html':'reports',
    'sumer_payroll.html':'payroll',
    'sumer_settings.html':'settings',
    'sumer_permissions.html':'permissions'
  };
  let state={client:null,session:null,profile:null,permissions:new Set(),isLogin};

  function readStored(){try{return JSON.parse(localStorage.getItem(STORAGE)||'null')}catch{return null}}
  function saveStored(s){try{localStorage.setItem(STORAGE,JSON.stringify(s))}catch{}}
  function clearStored(){try{localStorage.removeItem(STORAGE)}catch{}}
  function authHeaders(token){return {'apikey':SUMER_SUPABASE_KEY,'Authorization':'Bearer '+token,'Content-Type':'application/json'}}

  async function authRequest(path, options={}){
    const headers={'apikey':SUMER_SUPABASE_KEY,'Content-Type':'application/json',...(options.headers||{})};
    const r=await nativeFetch(SUMER_SUPABASE_URL+'/auth/v1/'+path,{...options,headers});
    const text=await r.text(); let data={}; try{data=text?JSON.parse(text):{}}catch{data={message:text}};
    if(!r.ok) throw new Error(data.error_description||data.msg||data.message||'تعذر الاتصال بنظام الدخول');
    return data;
  }

  async function refreshSession(stored){
    if(!stored?.refresh_token) return null;
    const data=await authRequest('token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:stored.refresh_token})});
    const session={...data,expires_at:Math.floor(Date.now()/1000)+(data.expires_in||3600)};
    saveStored(session); return session;
  }

  async function getSession(){
    let stored=readStored();
    if(!stored?.access_token) return null;
    const exp=Number(stored.expires_at||0);
    if(exp && exp < Math.floor(Date.now()/1000)+60){
      try{return await refreshSession(stored)}catch{clearStored();return null}
    }
    return stored;
  }

  async function dbFetch(path, options={}, token){
    const headers={...(options.headers||{}),...authHeaders(token)};
    const r=await nativeFetch(SUMER_SUPABASE_URL+'/rest/v1/'+path,{...options,headers});
    const text=await r.text(); let data=[]; try{data=text?JSON.parse(text):[] }catch{data={message:text}};
    if(!r.ok) throw new Error(data?.message||data?.hint||text||('HTTP '+r.status));
    return data;
  }

  async function buildState(session){
    if(!session?.access_token) return {client:null,session:null,profile:null,permissions:new Set(),isLogin};
    const profiles=await dbFetch('profiles?select=id,full_name,role,is_active,employee_id&id=eq.'+encodeURIComponent(session.user?.id||''),{method:'GET'},session.access_token);
    const profile=profiles?.[0];
    if(!profile || !profile.is_active) throw new Error('الحساب غير فعال أو لا توجد صلاحيات لهذا المستخدم');
    let permissions=new Set();
    if(profile.role==='admin') permissions=new Set(['attendance','employees','reports','payroll','settings','permissions']);
    else{
      const rows=await dbFetch('user_permissions?select=permission&user_id=eq.'+encodeURIComponent(profile.id)+'&allowed=eq.true',{method:'GET'},session.access_token);
      permissions=new Set((rows||[]).map(x=>x.permission));
    }
    return {client:null,session,profile,permissions,isLogin:false};
  }

  async function signIn(email,password){
    const data=await authRequest('token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})});
    const session={...data,expires_at:Math.floor(Date.now()/1000)+(data.expires_in||3600)};
    saveStored(session);
    return session;
  }
  async function signOut(){clearStored(); state={client:null,session:null,profile:null,permissions:new Set(),isLogin};}
  window.sumerSignIn=signIn; window.sumerSignOut=signOut;
  window.sumerGetAccessToken=()=>state.session?.access_token||readStored()?.access_token||null;

  window.fetch=async function(input,init={}){
    const current=state.session||readStored();
    const token=current?.access_token;
    if(!token) return nativeFetch(input,init);
    const headers=new Headers(init.headers||{});
    const url=typeof input==='string'?input:input?.url||'';
    if(url.includes(SUMER_SUPABASE_URL+'/rest/v1/')){
      headers.set('apikey',SUMER_SUPABASE_KEY); headers.set('Authorization','Bearer '+token);
    }
    return nativeFetch(input,{...init,headers});
  };

  window.sumerRequirePermission=async function(permission){
    const s=await ready;
    if(s.profile?.role==='admin'||s.permissions.has(permission)) return true;
    alert('ليس لديك صلاحية لتنفيذ هذا الإجراء'); return false;
  };

  async function boot(){
    if(isLogin){
      const session=await getSession();
      state={client:null,session,profile:null,permissions:new Set(),isLogin:true};
      resolveReady(state); return;
    }
    let session=await getSession();
    if(!session){location.replace('sumer_login.html'); return;}
    try{
      state=await buildState(session); window.sumerSession=session;window.sumerProfile=state.profile;window.sumerPermissions=state.permissions;
      const required=routePermissions[file];
      if(required && !state.permissions.has(required)){alert('ليس لديك صلاحية للوصول إلى هذا القسم');location.replace('index.html');return;}
      resolveReady(state);
    }catch(err){console.error('Sumer Auth:',err);await signOut();location.replace('sumer_login.html');}
  }
  setInterval(async()=>{
    if(!state.session?.refresh_token)return;
    const exp=Number(state.session.expires_at||0);
    if(exp && exp < Math.floor(Date.now()/1000)+300){
      try{state.session=await refreshSession(state.session);window.sumerSession=state.session}catch{await signOut();location.replace('sumer_login.html')}
    }
  },60000);
  boot().catch(err=>{console.error('Sumer Auth:',err);rejectReady(err);if(!isLogin)location.replace('sumer_login.html');});
})();
