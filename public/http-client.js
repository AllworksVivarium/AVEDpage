/* One transport for both terminals. Never treat an unreadable HTTP 200 body as data. */
(function(root){
  const failure=(message,code,status=0)=>Object.assign(new Error(message),{code,status});
  function create({fetchImpl=(...args)=>fetch(...args),timeoutMs=45000,sleep=ms=>new Promise(r=>setTimeout(r,ms))}={}) {
    async function once(path,options){
      const {timeoutMs:deadline=timeoutMs,...request}=options;
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),deadline);
      try {
        const response=await fetchImpl(path,{...request,credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:{Accept:'application/json',...(request.body?{'Content-Type':'application/json'}:{}),...(request.headers||{})}});
        let data;
        try{data=await response.json();}
        catch(e){if(e.name==='AbortError'||controller.signal.aborted)throw e;throw failure('通讯资料未完整送达，请重新接入。','INVALID_RESPONSE',response.status);}
        if(!data||typeof data!=='object'||Array.isArray(data))throw failure('通讯资料未完整送达，请重新接入。','INVALID_RESPONSE',response.status);
        if(!response.ok||data.error)throw failure(data.error||'公司网络暂未响应。',data.code||'HTTP_ERROR',response.status);
        return data;
      }catch(e){if(controller.signal.aborted||e.name==='AbortError')throw failure('连接超时，请检查网络后重试。','TIMEOUT');if(e instanceof TypeError&&!e.code)throw failure('连接中断，请检查网络后重试。','NETWORK');throw e;}
      finally{clearTimeout(timer);}
    }
    async function request(path,options={}) {
      const safe=!options.method||options.method==='GET',retries=options.retries??(safe?1:0);
      for(let attempt=0;;attempt++)try{return await once(path,options);}catch(e){if(attempt>=retries||!safe||!(['TIMEOUT','NETWORK','INVALID_RESPONSE'].includes(e.code)||[502,503,504].includes(e.status)))throw e;await sleep(250*(attempt+1));}
    }
    async function confirmSession(expected) {
      for(let attempt=0;attempt<3;attempt++){
        try{const data=await request('/api/me',{retries:0});if(!data.employee?.username)throw failure('接入凭证未能确认，请重新登录。','INVALID_SESSION');if(expected&&data.employee.username!==expected)throw failure('接入身份未能确认，请退出后重新登录。','SESSION_MISMATCH');return data;}
        catch(e){if(e.status!==401)throw e;if(attempt===2)throw failure('账号已核验，但浏览器未保留接入凭证。请使用 HTTPS 入口，并允许本站 Cookie，或改用系统浏览器。','SESSION_NOT_SAVED',401);await sleep(150*(attempt+1));}
      }
    }
    return {request,confirmSession};
  }
  root.AVEDHttp={create,...create()};
})(globalThis);
