import {useEffect,useMemo,useState} from 'react';
import {wheelWork} from '../lib/tyreWork';
import {isTyre,itemDescription,isAddon,tyreData} from '../lib/tyrePresentation';
import TyreBrandLogo from './TyreBrandLogo';

const pressureText=value=>value?.psi?(`${value.psi} psi${value.bar?` / ${value.bar} bar`:''}`):value?.bar?`${value.bar} bar`:'Not supplied';
export default function JobVehicleDetails({job,photo=true}){
 const url=job.vehicleImage||job.vehicle?.image||'',[failed,setFailed]=useState(false),[expanded,setExpanded]=useState(false);useEffect(()=>setFailed(false),[url]);
 const lines=(job.workLines||job.tyreLines||[]).filter(line=>!isAddon(line));
 const technical=job.vehicle?.tyreTechnical||job.vehicle?.activeTyreFitment||{};
 const front=technical.front||{},rear=technical.rear||{},fixing=technical.fixing||{},torque=technical.torqueNm||fixing.torqueNm;
 const hasTechnical=Boolean(front.pressure||rear.pressure||torque||technical.hub?.pcd||job.vehicle?.tyreFitments?.length);
 const allDetails=useMemo(()=>job.vehicle?.vehicleTechnical||{},[job.vehicle]);
 return <div className="jobVehicleDetails">
  <div className="jobVehicleIdentity">{photo&&<div className="jobVehiclePhoto">{url&&!failed?<img src={url} alt={`${job.vehicle?.make||''} ${job.vehicle?.model||''} ${job.registration||'Vehicle'}`} onError={()=>setFailed(true)}/>:<span>Vehicle photo unavailable</span>}</div>}<div><strong>{job.customerName||job.name||'Customer name unavailable'}</strong><small>{[job.vehicle?.make,job.vehicle?.model].filter(Boolean).join(' ')}</small></div></div>
  {hasTechnical&&<section className="vehicleTechnicalPanel" aria-label="Manufacturer tyre settings"><div><span>FRONT PRESSURE</span><strong>{pressureText(front.pressure)}</strong></div><div><span>REAR PRESSURE</span><strong>{pressureText(rear.pressure)}</strong></div><div><span>WHEEL TORQUE</span><strong>{torque?`${torque} Nm`:'Not supplied'}</strong></div><button type="button" onClick={()=>setExpanded(value=>!value)} aria-expanded={expanded}>{expanded?'Hide vehicle data':'See all vehicle data'}</button>{expanded&&<div className="vehicleTechnicalMore"><p><b>Front:</b> {[front.size,front.loadIndex,front.speedIndex,front.runFlat?'Run flat':''].filter(Boolean).join(' ')||'Not supplied'}</p><p><b>Rear:</b> {[rear.size,rear.loadIndex,rear.speedIndex,rear.runFlat?'Run flat':''].filter(Boolean).join(' ')||'Not supplied'}</p><p><b>Laden pressures:</b> Front {pressureText(front.ladenPressure)} · Rear {pressureText(rear.ladenPressure)}</p><p><b>Wheel:</b> PCD {technical.hub?.pcd||'—'} · Centre bore {technical.hub?.centreBoreMm?`${technical.hub.centreBoreMm} mm`:'—'} · Thread {fixing.threadType||'—'} · Head {fixing.headSizeMm?`${fixing.headSizeMm} mm`:'—'}</p>{allDetails.identification&&<p><b>VDG vehicle:</b> {[allDetails.identification.DvlaBodyType||allDetails.identification.dvlaBodyType,allDetails.identification.DvlaFuelType||allDetails.identification.dvlaFuelType].filter(Boolean).join(' · ')}</p>}</div>}</section>}
  <div className="jobTechnicians">{(job.technicians?.filter(Boolean)||[job.technician]).filter(Boolean).map(name=><span key={name}>{name}</span>)}{!job.technicians?.length&&!job.technician&&<span>Technicians unassigned</span>}</div>
  <div className="jobWorkList">{lines.map((line,index)=><div className="jobTyreDetail" key={index}>{isTyre(line)&&<TyreBrandLogo line={line}/>}<b>{itemDescription(line,isTyre(line)||wheelWork(line))}</b>{isTyre(line)&&tyreData(line).flags.length>0&&<div className="jobFitmentFlags">{tyreData(line).flags.map(flag=><span key={flag}>{flag}</span>)}</div>}{wheelWork(line)&&<span className={`jobWheelPositions ${line.positions?.length?'':'missing'}`}>{line.positions?.length?line.positions.join(' & '):'WHEEL POSITIONS REQUIRED'}</span>}</div>)}</div>
 </div>;
}
