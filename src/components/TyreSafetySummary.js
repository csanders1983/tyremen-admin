import './TyreSafetySummary.css';
import {wheelWork} from '../lib/tyreWork';
import {itemDescription,isAddon} from '../lib/tyrePresentation';

export const LOCKING_NUT_LOCATIONS=['Boot','Glove Box','Centre Console','On Seat','Customer'];
const present=value=>value!==null&&value!==undefined&&String(value).trim()!=='';
function pressure(value={}){
 const source=value?.tyrePressure||value||{};
 return {psi:present(source.psi)?source.psi:'',bar:present(source.bar)?source.bar:''};
}
export function safetyTechnical(job={},completion=job.tyreCompletion||{}){
 const source=job.vehicle?.tyreTechnical||job.vehicle?.activeTyreFitment||{};
 return {front:pressure(source.front?.pressure||completion.pressures?.front),rear:pressure(source.rear?.pressure||completion.pressures?.rear),torque:source.torqueNm??source.fixing?.torqueNm??completion.torqueNm??''};
}
export function lockingNutFor(job={},completion=job.tyreCompletion||{}){
 return {location:completion.lockingWheelNutLocation||job.lockingWheelNutLocation||'',recipient:completion.lockingWheelNutRecipient||job.lockingWheelNutRecipient||''};
}
export function pressureText(value){
 return [present(value.psi)?`${value.psi} psi`:'',present(value.bar)?`${value.bar} bar`:''].filter(Boolean).join(' / ')||'Not available';
}
export function safetyLines(job={}){
 const rows=[...(job.items||[]),...(job.tyreLines||[]),...(job.tyres||[]),...(job.workLines||[])].filter(line=>!isAddon(line)&&wheelWork(line));
 return rows.filter((line,index)=>rows.findIndex(other=>(line.lineId||line.id)?(other.lineId||other.id)===(line.lineId||line.id):itemDescription(other)===itemDescription(line)&&JSON.stringify(other.positions||[])===JSON.stringify(line.positions||[]))===index);
}
export function LockingNutFields({job={},onChange}){
 const {location,recipient}=lockingNutFor(job);
 return <fieldset className="tyreNutFields"><legend>Locking wheel nut · record before bay handover</legend><label>Location *<select required value={location} onChange={e=>onChange({lockingWheelNutLocation:e.target.value,lockingWheelNutRecipient:e.target.value==='Customer'?recipient:''})}><option value="">Select location</option>{LOCKING_NUT_LOCATIONS.map(value=><option key={value}>{value}</option>)}</select></label>{location==='Customer'&&<label>Customer holding the key *<input required value={recipient} onChange={e=>onChange({lockingWheelNutRecipient:e.target.value})} placeholder="Customer name"/></label>}<p>This records where the key is kept. The technician must separately confirm it has been returned at completion.</p></fieldset>;
}
export default function TyreSafetySummary({job={},completion}){
 const tech=safetyTechnical(job,completion),nut=lockingNutFor(job,completion),lines=safetyLines(job);
 const missing=tech.front.psi===''||tech.rear.psi===''||tech.torque==='';
 return <section className="tyreLiveSafety" aria-label="Tyre bay safety instructions"><div className="tyreLiveSafetyTitle">VEHICLE SAFETY · CHECK BEFORE HANDOVER</div><dl className="tyreLiveSafetyValues"><div><dt>Front pressure</dt><dd>{pressureText(tech.front)}</dd></div><div><dt>Rear pressure</dt><dd>{pressureText(tech.rear)}</dd></div><div><dt>Removed-wheel torque</dt><dd>{present(tech.torque)?`${tech.torque} Nm`:'Not available'}</dd></div></dl>{missing&&<p className="tyreLiveMissing">Manufacturer data incomplete · refresh vehicle lookup before completion. Verify the selected fitment against the vehicle.</p>}<div className="tyreLiveWarnings"><div><b>CHECK FITMENT</b>{lines.length?lines.map((line,index)=><span key={index}>{itemDescription(line).replace(/\bQTY\s*\d+\b/ig,'').replace(/^\s*\d+\s*[×x]\s*/,'').trim()} · {line.positions?.length?line.positions.join(' / '):'WHEEL POSITIONS REQUIRED'}</span>):<span>Check the sales order against the tyres fitted.</span>}</div><div><b>RETURN LOCKING WHEEL NUT</b><span>{nut.location?nut.location==='Customer'?`Hand back to ${nut.recipient||job.customerName||job.name||'customer'}`:`Return to ${nut.location}`:'LOCATION NOT RECORDED · record before handover'}</span></div><div><b>FINAL SAFETY CHECK</b><span>Recheck all tyre pressures. Torque removed wheels only. Complete the tyre health check before sending to office.</span></div></div></section>;
}
