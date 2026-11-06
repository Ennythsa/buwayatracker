import {writeFileSync} from 'fs';
const URL='https://hfkwmqvbopizmzdkboan.supabase.co';
const KEY='sb_publishable_AIdhguufnXgAcSbq22V-1A_vAhcxfQn';
const OK=/^(politicians|relations|profiles|news|sources)\.txt$/;
const r=await fetch(`${URL}/rest/v1/site_files?select=name,content`,{headers:{apikey:KEY}});
if(!r.ok)throw new Error('site_files '+r.status);
for(const f of await r.json()){
  if(!OK.test(f.name))continue;
  writeFileSync(f.name,f.content.endsWith('\n')?f.content:f.content+'\n');
  console.log('wrote',f.name);
}
