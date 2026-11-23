function baseUrl(){
  const value=String(process.env.APP_BASE_URL||"").trim().replace(/\/$/,"");
  if(!value)return null;
  try{
    const url=new URL(value);
    if(url.protocol!=="https:" && !(url.protocol==="http:" && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(url.host)))return null;
    if(url.username||url.password||url.search||url.hash)return null;
    return url.toString().replace(/\/$/,"");
  }catch{return null;}
}
export function mailStatus(){const ready=Boolean(process.env.RESEND_API_KEY&&process.env.MAIL_FROM&&baseUrl());return{password_recovery_available:ready,email_verification_available:ready,provider:process.env.RESEND_API_KEY?"resend":null};}
export async function sendMail({to,token,type="recovery"}){
  const origin=baseUrl();
  if(!mailStatus().password_recovery_available||!origin)return false;
  const verify=type==="verification";
  const link=`${origin}/pages/${verify?"verify-email":"reset-password"}.html#token=${encodeURIComponent(token)}`;
  const subject=verify?"cfs_zockt · E-Mail bestätigen":"cfs_zockt · Passwort zurücksetzen";
  const text=verify?"Bitte bestätige deine E-Mail-Adresse.":"Du hast einen Passwort-Reset angefordert.";
  try{
    const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{authorization:`Bearer ${process.env.RESEND_API_KEY}`,"content-type":"application/json"},body:JSON.stringify({from:process.env.MAIL_FROM,to:[to],subject,html:`<p>${text}</p><p><a href="${link}">${verify?"E-Mail bestätigen":"Passwort zurücksetzen"}</a></p><p>Der Link ist 30 Minuten gültig und nur einmal verwendbar.</p>`})});
    return r.ok;
  }catch{return false;}
}
export const sendRecoveryMail=({to,token})=>sendMail({to,token,type:"recovery"});
