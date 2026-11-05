export const QUEUE_STATUSES=[['Waiting','Waiting'],['Arrived','Arrived'],['In bay','In bay'],['Finished','Job complete']];
export function staggeredVehicle(vehicle={}){
 const clean=value=>{const raw=String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,''),match=raw.match(/^(\d{3})(\d{2})(?:ZR|R)?(\d{2})/);return match?match.slice(1).join('/'):raw;};
 const front=clean(vehicle.frontTyreSize||vehicle.tyreSize),rear=clean(vehicle.rearTyreSize);
 return Boolean(front&&rear&&front!==rear);
}
export function queueTime(job){return [job.arrivalDate||job.tyreBay?.arrivalDate||job.date||'',job.arrivalTime||job.tyreBay?.arrivalTime||'99:99',job.id||''].join('|');}
export function validQuantity(value,max=999){const n=Number(value);return Number.isInteger(n)&&n>=1&&n<=max;}
