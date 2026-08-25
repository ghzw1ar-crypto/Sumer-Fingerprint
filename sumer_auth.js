const SUMER_SUPABASE_URL='https://glbugvsorxtzixgexdak.supabase.co';
const SUMER_SUPABASE_KEY='sb_publishable_8iv3CIQ3MaQ6E9oPgK6N8A_KTYGp-V6';
(function(){
  const nativeFetch=window.fetch.bind(window);
  let resolveReady,rejectReady;
  const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
  window.sumerAuthReady=ready;
  let client=null;
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
  async function loadSupabase(){
    if(window.supabase?.createClient)return;
    await new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      s.async=true;s.onload=resolve;s.onerror=()=>reject(new Error('تعذر تحميل مكتبة Supabase'));
      document.head.appendChild(s);
    });
  }
  async function boot(){
    await loadSupabase();
    client=window.supabase.createClient(SUMER_SUPABASE_URL,SUMER_SUPABASE_KEY,{
      global:{fetch:nativeFetch},auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
    });
    window.sumerSupabase=client;
    const {data:{session},error:sessionError}=await client.auth.getSession();
    if(sessionError)throw sessionError;
    if(isLogin){resolveReady({client,session,profile:null,permissions:new Set(),isLogin:true});return;}
    if(!session){location.replace('sumer_login.html');return;}
    const {data:profile,error:profileError}=await client.from('profiles')
      .select('id,full_name,role,is_active,employee_id').eq('id',session.user.id).maybeSingle();
    if(profileError||!profile||!profile.is_active){
      await client.auth.signOut({scope:'local'});location.replace('sumer_login.html');return;
    }
    let permissions=new Set();
    if(profile.role==='admin')permissions=new Set(['attendance','employees','reports','payroll','settings','permissions']);
    else{
      const {data:rows,error}=await client.from('user_permissions').select('permission')
        .eq('user_id',session.user.id).eq('allowed',true);
      if(error)throw error;
      permissions=new Set((rows||[]).map(x=>x.permission));
    }
    const required=routePermissions[file];
    if(required&&!permissions.has(required)){
      alert('ليس لديك صلاحية للوصول إلى هذا القسم');location.replace('index.html');return;
    }
    const state={client,session,profile,permissions,isLogin:false};
    window.sumerSession=session;window.sumerProfile=profile;window.sumerPermissions=permissions;
    resolveReady(state);
  }
  window.fetch=async function(input,init={}){
    const state=await ready;
    const headers=new Headers(init.headers||{});
    headers.set('apikey',SUMER_SUPABASE_KEY);
    if(state?.session?.access_token)headers.set('Authorization','Bearer '+state.session.access_token);
    else headers.delete('Authorization');
    return nativeFetch(input,{...init,headers});
  };
  window.sumerRequirePermission=async function(permission){
    const state=await ready;
    if(state.profile?.role==='admin'||state.permissions?.has(permission))return true;
    alert('ليس لديك صلاحية لتنفيذ هذا الإجراء');return false;
  };
  boot().catch(err=>{
    console.error('Sumer Auth:',err);rejectReady(err);
    if(isLogin)resolveReady({client,session:null,profile:null,permissions:new Set(),isLogin:true,error:err});
    else location.replace('sumer_login.html');
  });
})();