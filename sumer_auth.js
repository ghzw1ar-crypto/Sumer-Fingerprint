const SUMER_SUPABASE_URL='https://glbugvsorxtzixgexdak.supabase.co';
const SUMER_SUPABASE_KEY='sb_publishable_8iv3CIQ3MaQ6E9oPgK6N8A_KTYGp-V6';
(function(){
  const originalFetch=window.fetch.bind(window);
  let resolveReady;
  const ready=new Promise(r=>resolveReady=r);
  window.sumerAuthReady=ready;
  let client;
  const isLogin=/sumer_login\.html$/i.test(location.pathname);

  // Existing pages use fetch() directly. Hold their API requests until the
  // authenticated session is ready, then replace the public key token with
  // the signed-in user's access token.
  window.fetch=async function(input,init={}){
    const state=await ready;
    const h=new Headers(init.headers||{});
    h.set('apikey',SUMER_SUPABASE_KEY);
    if(state?.session?.access_token) h.set('Authorization','Bearer '+state.session.access_token);
    return originalFetch(input,{...init,headers:h});
  };

  async function boot(){
    if(!window.supabase){
      await new Promise((resolve,reject)=>{
        const s=document.createElement('script');
        s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        s.onload=resolve; s.onerror=()=>reject(new Error('تعذر تحميل مكتبة Supabase'));
        document.head.appendChild(s);
      });
    }
    // Supabase client itself bypasses the global wrapper so it can establish
    // the session without waiting on that same session.
    client=window.supabase.createClient(SUMER_SUPABASE_URL,SUMER_SUPABASE_KEY,{global:{fetch:originalFetch}});
    window.sumerSupabase=client;
    const {data:{session}}=await client.auth.getSession();
    if(isLogin){
      resolveReady({client,session,profile:null,permissions:new Set()});
      return;
    }
    if(!session){location.replace('sumer_login.html');return;}
    const {data:profile,error:pe}=await client.from('profiles').select('id,full_name,role,is_active,employee_id').eq('id',session.user.id).maybeSingle();
    if(pe||!profile||!profile.is_active){await client.auth.signOut();location.replace('sumer_login.html');return;}
    let permissions=new Set();
    if(profile.role==='admin') permissions=new Set(['attendance','employees','reports','payroll','settings','permissions']);
    else {const {data}=await client.from('user_permissions').select('permission').eq('user_id',session.user.id).eq('allowed',true);permissions=new Set((data||[]).map(x=>x.permission));}
    const map={attendance:'sumer_attendance_live.html',employees:'sumer_employees_shifts.html',reports:'sumer_attendance_reports.html',payroll:'sumer_payroll.html',settings:'sumer_settings.html',permissions:'sumer_permissions.html'};
    const file=location.pathname.split('/').pop()||'index.html';
    const current=Object.keys(map).find(k=>map[k]===file);
    if(current && !permissions.has(current)){alert('ليس لديك صلاحية للوصول إلى هذا القسم');location.replace('index.html');return;}
    const state={client,session,profile,permissions};
    window.sumerSession=session;window.sumerProfile=profile;window.sumerPermissions=permissions;
    resolveReady(state);
  }
  boot().catch(err=>{console.error(err);if(isLogin){resolveReady({client:null,session:null,profile:null,permissions:new Set(),error:err});}else{location.replace('sumer_login.html');}});
})();
