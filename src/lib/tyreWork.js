export const WHEEL_POSITIONS=['NSF','OSF','NSR','OSR'];
export const TECHNICIANS=['Chris Sanders','Sarah Sanders','Nigel Love','Billy McManus','Dave Bailey','Damain','Page Bosworth','Ellie Sanders','Mia Sanders','Ethan','George Dearlove','Mally Clixby','Martin Taylor','Will Massey','Darren Blagg','Kieron BMW','Jack Wright-Sims'];
export function wheelWork(line={}){const text=[line.type,line.category,line.serviceKey,line.name,line.description,line.serviceName].filter(Boolean).join(' ').toLowerCase();return ['tyre','tyres'].includes(String(line.type||line.category||'').toLowerCase())||/\btpms\b|tyre.*repair|puncture/.test(text);}
export function techniciansFor(job={}){return job.technicians?.length?job.technicians:job.technician?[job.technician]:[];}
export function sizeParts(value){const m=String(value).toUpperCase().replace(/\s/g,'').match(/^(\d{3})\/?(\d{2})(?:R)?(\d{2})$/);if(!m)throw new Error('Enter a complete tyre size, e.g. 205/55R16');return {width:m[1],profile:m[2],rim:m[3]};}
