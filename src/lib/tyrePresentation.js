const upper=value=>String(value??'').trim().toUpperCase();
const KNOWN_LOGOS={APTANY:'2024',LANDSAIL:'2297',LINGLONG:'2308',DELINTE:'2121',ZMAX:'2797'};
function isTyre(line={}){return ['tyre','tyres'].includes(String(line.type||line.category||'').toLowerCase());}
function safeLogo(value){return /^https:\/\//i.test(String(value||''))?String(value):'';}
function tyreData(line={}){
 const description=upper(line.name||line.description||line.serviceName||''), rawSize=upper(line.size||'');
 const match=(rawSize||description).match(/\b(\d{3})\s*\/?\s*(\d{2})\s*(?:ZR|R)?\s*(\d{2})\b/);
 const size=match?`${match[1]}/${match[2]} R${match[3]}`:rawSize;
 const rating=upper(line.loadSpeed||[line.loadIndex,line.speedRating||line.speed].filter(Boolean).join('')||description.match(/\b\d{2,3}(?:\/\d{2,3})?[A-Z]\b/)?.[0]||'');
 const brand=upper(line.brand||line.Brand||''),structured=upper(line.pattern||line.model||line.Model||'');
 let pattern=structured.replace(/\b(XL|EXTRA LOAD|RUN[ -]?FLAT|RFT|ROF)\b/g,'').replace(/\s+/g,' ').trim();
 if(!pattern){pattern=description;if(match)pattern=pattern.replace(match[0],'');if(rating)pattern=pattern.replace(rating,'');if(brand)pattern=pattern.replace(brand,'');pattern=pattern.replace(/\b(XL|EXTRA LOAD|RUN[ -]?FLAT|RFT|ROF)\b/g,'').replace(/\s+/g,' ').trim();}
 const flags=Array.isArray(line.flags)?line.flags.filter(v=>typeof v==='string'&&v.length<50).map(upper):[];const combined=[description,structured,upper(line.homologation||line.oeMarking||'')].join(' ');
 if(line.extraLoad===true||/\bXL\b|EXTRA LOAD/.test(combined))flags.push('XL');
 if(line.runFlat===true||/\b(RUN[ -]?FLAT|RFT|ROF|ZP|SSR)\b/.test(combined))flags.push('RUN-FLAT');
 if(line.homologation||line.oeMarking)flags.push(upper(line.homologation||line.oeMarking));
 if(line.vehicleType==='commercial')flags.push('COMMERCIAL');if(line.vehicleType==='suv')flags.push('SUV');
 const logo=safeLogo(line.brandLogo||line.brandImage||line.images?.brand)|| (KNOWN_LOGOS[brand.replace(/[^A-Z0-9]/g,'')]?`https://images.tyreintelligence.co.uk/brandlogos/${KNOWN_LOGOS[brand.replace(/[^A-Z0-9]/g,'')]}_LTB.jpg`:'');
 return {brand,pattern,size,loadSpeed:rating,flags:[...new Set(flags)],brandLogo:logo};
}
function itemDescription(line={},includeQuantity=false){const data=tyreData(line);const title=isTyre(line)?[data.size,data.loadSpeed,data.brand,data.pattern].filter(Boolean).join(' '):upper(line.name||line.description||line.serviceName||line.service||'Work');return `${includeQuantity?'QTY '+Number(line.qty??line.quantity??1)+' — ':''}${title}`;}
function invoiceDescription(line={}){const title=itemDescription(line),flags=isTyre(line)?tyreData(line).flags:[];return flags.length?title+' · '+flags.join(' · '):title;}
function isAddon(line={}){if(isTyre(line))return false;const code=upper(line.stockNumber||line.code||line.serviceKey);return ['CD','WB','TLV'].includes(code)||/CASING DISPOSAL|WHEEL BALANC|TUBELESS VALVE|NEW VALVE/.test(upper(line.name||line.description||line.serviceName));}
function jobItems(job={}){return job.items?.length?job.items:job.tyres||[];}
function mechanicalLines(job,tyreWork){const rows=jobItems(job);if(rows.length)return rows.filter(l=>!tyreWork(l));if(job.foremanOrderNumber||job.tyreBay)return [];return job.service?String(job.service).split(/\s+[&+]\s+|\s*·\s*|\s+and\s+/i).map(name=>({name,type:'service',qty:1})).filter(line=>!tyreWork(line)&&!/^tyres?\b/i.test(line.name.trim())):[];}
export {upper,isTyre,safeLogo,tyreData,itemDescription,invoiceDescription,isAddon,mechanicalLines};
