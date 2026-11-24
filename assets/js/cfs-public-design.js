// Public browser adapter; defaults remain active when the endpoint is unavailable.
// Scope to hero only; never replace logo, text, navigation or global theme.
export function applyPublicDesign(hero,payload){
 if(!hero?.style)return false;
 const keys=["--cfs-home-shade-start","--cfs-home-shade-end","--cfs-home-background","--cfs-home-position","--cfs-home-accent"];
 for(const key of keys)hero.style.removeProperty(key);
 const d=payload?.design;
 if(!d||!Number.isSafeInteger(d.revision)||d.revision<1||!Number.isInteger(d.shade)||d.shade<0||d.shade>90||!["center","top","bottom","left","right"].includes(d.position)||typeof d.accent!=="string"||!/^#[0-9a-f]{6}$/i.test(d.accent))return false;
 // Media route is intentionally not implemented yet; do not use arbitrary URLs.
 if(d.backgroundAssetId!==null&&(typeof d.backgroundAssetId!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(d.backgroundAssetId)))return false;
 if(d.backgroundAssetId!==null)return false; // Keep original until authorized media delivery exists.
 hero.style.setProperty(keys[0],String(d.shade/100));
 hero.style.setProperty(keys[1],String(d.shade/100));
 hero.style.setProperty(keys[3],d.position);
 hero.style.setProperty(keys[4],d.accent.toLowerCase());
 return true;
}

export async function loadPublicDesign(hero,request=fetch){
 if(!hero?.style)return false;
 try{
  const response=await request("/api/public/website-design",{method:"GET",cache:"no-store",credentials:"omit",redirect:"error"});
  if(!response.ok)return applyPublicDesign(hero,null);
  return applyPublicDesign(hero,await response.json());
 }catch{return applyPublicDesign(hero,null)}
}
