import {writeFileSync} from 'fs';
const URL='https://hfkwmqvbopizmzdkboan.supabase.co';
const KEY='sb_publishable_AIdhguufnXgAcSbq22V-1A_vAhcxfQn';
const get=async t=>{
  const r=await fetch(`${URL}/rest/v1/${t}?select=*`,{headers:{apikey:KEY}});
  if(!r.ok)throw new Error(t+' '+r.status);
  return r.json();
};
const c=s=>String(s??'').replace(/[|\r\n]+/g,' ').trim();
const hdr=n=>`# ${n} - auto-generated from Supabase. Do not edit by hand.\n`;


const P=(await get('politicians')).sort((a,b)=>a.id-b.id);
writeFileSync('politicians.txt',hdr('politicians')+P.map(p=>
  [p.id,c(p.name),c(p.party),c(p.position),c(p.platform),c(p.track_record)].join('|')).join('\n')+'\n');


const R=await get('relations');
writeFileSync('relations.txt',hdr('relations')+R.map(r=>
  [r.person_a,r.person_b,r.relation_type].join('|')).join('\n')+'\n');


const N=await get('news');
writeFileSync('news.txt',hdr('news')+N.map(n=>
  [n.published_at,c(n.category),c(n.title),c(n.summary),c(n.url),n.politician_id??''].join('|')).join('\n')+'\n');
