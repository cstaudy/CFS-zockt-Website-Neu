/* R45: Offline QA audit record; never serializes source URLs, design JSON, or credentials. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CFSR45QualityReport=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
/* R46: audit messages can contain user-controlled element names. A report must not
   accidentally preserve streaming URLs, bearer credentials or local file paths. */
const LIMIT=180, MAX_FINDINGS=500;
function safeLabel(value){
 let text=String(value??'');
 text=text.replace(/(?:https?|wss?|rtmp|rtmps):\/\/[^\s<>\"'`]+/gi,'[URL entfernt]');
 text=text.replace(/\bdata:[^\s<>\"'`]+/gi,'[Daten-URL entfernt]');
 text=text.replace(/\bBearer\s+[a-z0-9._~+\/-]+/gi,'Bearer [geschützt]');
 text=text.replace(/\b(?:access[_-]?token|refresh[_-]?token|auth(?:orization)?|secret|password|passwd|api[_-]?key|client[_-]?secret|session[_-]?id)\s*[:=]\s*(?:\"[^\"]*\"|'[^']*'|[^\s&,;]+)/gi,'[Zugangsdaten entfernt]');
 text=text.replace(/\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+/g,'[Token entfernt]');
 text=text.replace(/(?:[A-Z]:\\|\\\\)[^\s<>\"'`]+/gi,'[Dateipfad entfernt]');
 text=text.replace(/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi,'[E-Mail entfernt]');
 text=text.replace(/[A-Za-z0-9_-]{64,}/g,'[Schlüssel entfernt]');
 return text.replace(/[\u0000-\u001f<>]/g,' ').trim().slice(0,LIMIT);
}
function filename(value){return safeLabel(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70)||'design';}
function record(audit,kind,name,at=new Date()){
 if(!audit||!['scene','widget'].includes(kind)||audit.kind!==kind||!Array.isArray(audit.findings)||!['ok','warning','error'].includes(audit.status))throw new Error('Kein gültiges Prüfergebnis vorhanden.');
 const stamp=at instanceof Date?at.toISOString():new Date(at).toISOString();
 const validSeverities=['errors','warnings','notes'];
 const counts={errors:0,warnings:0,notes:0};
 for(const f of audit.findings){const severity=validSeverities.includes(f?.severity)?f.severity:'notes';counts[severity]++;}
 const finding=audit.findings.slice(0,MAX_FINDINGS).map(f=>({severity:validSeverities.includes(f?.severity)?f.severity:'notes',code:safeLabel(f?.code||f?.text),elementId:f?.elementId==null?null:safeLabel(f.elementId),message:safeLabel(f?.text)}));
 const count=value=>Number.isSafeInteger(Number(value))&&Number(value)>=0?Math.min(Number(value),100000):0;
 return {schema:'cfs-output-quality-report-v1',scope:kind,designName:safeLabel(name).slice(0,100),checkedAt:stamp,method:'geometry-and-metadata-only',dimensions:safeLabel(audit.dimensions),status:counts.errors?'error':counts.warnings?'warning':'ok',counts:{...counts,visibleElements:count(audit.stats?.visible),totalElements:count(audit.stats?.total)},findings:finding,omittedFindings:audit.findings.length-finding.length,limitations:['Kein Pixelvergleich der fertigen OBS-Ausgabe.','Keine Prüfung von Live-Plattformdaten.','Keine Bilddateien, Quell-URLs, Zugangsdaten oder vollständigen Designs enthalten.']};
}
function download(audit,kind,name,env=globalThis){const doc=env.document,URLapi=env.URL;if(!doc||!URLapi||!env.Blob)throw new Error('Browser-Download nicht verfügbar.');const result=record(audit,kind,name);const blob=new env.Blob([JSON.stringify(result,null,2)+'\n'],{type:'application/json'}),url=URLapi.createObjectURL(blob),link=doc.createElement('a');try{link.href=url;link.download=`${filename(name)}-${kind}-qualitaet.json`;doc.body.appendChild(link);link.click();}finally{link.remove();(env.setTimeout||setTimeout)(()=>URLapi.revokeObjectURL(url),1000);}return result;}
return {record,download,filename};
});
