/** External scheduler entry point. Configure this with a 20-minute cron externally.
 * Secret values must be injected by that scheduler, never committed to source.
 * SITE_URL: deployed private Site origin; SITE_SERVICE_TOKEN: current Sites service access token.
 * The token must be obtained through supported service access and renewed by the scheduler.
 */
const origin=process.env.SITE_URL,token=process.env.SITE_SERVICE_TOKEN;
if(!origin||!token)throw new Error('SITE_URL and SITE_SERVICE_TOKEN are required.');
const url=new URL(origin);if(url.protocol!=='https:'||url.pathname!=='/')throw new Error('SITE_URL must be an HTTPS origin.');
const headers={'OAI-Sites-Authorization':`Bearer ${token}`};
for(let n=0;n<220;n++){
 const res=await fetch(new URL('/api/refresh',origin),{method:'POST',headers,redirect:'error',signal:AbortSignal.timeout(30000)});
 if(!res.ok)throw new Error(`Refresh failed: HTTP ${res.status}`);
 const result=await res.json();
 if(result.state==='complete'||result.state==='current'){
  const readback=await fetch(new URL('/api/report',origin),{headers,redirect:'error'});if(!readback.ok)throw new Error('Readback failed.');const report=await readback.json();console.log(JSON.stringify({status:report.sourceStatus,movies:report.movies.length,checkedAt:report.checkedAt,errorCount:report.errors.length}));if(report.sourceStatus==='error')process.exitCode=1;break;
 }
 await new Promise(r=>setTimeout(r,Math.max(1,result.retryAfter??1)*1000));
 if(n===219)throw new Error('Refresh did not complete within the step limit.');
}
