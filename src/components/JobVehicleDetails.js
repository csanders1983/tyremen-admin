import {useEffect,useState} from 'react';
import {wheelWork} from '../lib/tyreWork';
import {isTyre,itemDescription,isAddon,tyreData} from '../lib/tyrePresentation';
import TyreBrandLogo from './TyreBrandLogo';
export default function JobVehicleDetails({job,photo=true}){
 const url=job.vehicleImage||job.vehicle?.image||'',[failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[url]);
 const lines=(job.workLines||job.tyreLines||[]).filter(line=>!isAddon(line));
 return <div className="jobVehicleDetails"><div className="jobVehicleIdentity">{photo&&<div className="jobVehiclePhoto">{url&&!failed?<img src={url} alt={`${job.vehicle?.make||''} ${job.vehicle?.model||''} ${job.registration||'Vehicle'}`} onError={()=>setFailed(true)}/>:<span>Vehicle photo unavailable</span>}</div>}<div><strong>{job.customerName||job.name||'Customer name unavailable'}</strong><small>{[job.vehicle?.make,job.vehicle?.model].filter(Boolean).join(' ')}</small></div></div><div className="jobTechnicians">{(job.technicians?.filter(Boolean)||[job.technician]).filter(Boolean).map(name=><span key={name}>{name}</span>)}{!job.technicians?.length&&!job.technician&&<span>Technicians unassigned</span>}</div><div className="jobWorkList">{lines.map((line,index)=><div className="jobTyreDetail" key={index}>{isTyre(line)&&<TyreBrandLogo line={line}/>}<b>{itemDescription(line,isTyre(line)||wheelWork(line))}</b>{isTyre(line)&&tyreData(line).flags.length>0&&<div className="jobFitmentFlags">{tyreData(line).flags.map(flag=><span key={flag}>{flag}</span>)}</div>}{wheelWork(line)&&<span className={`jobWheelPositions ${line.positions?.length?'':'missing'}`}>{line.positions?.length?line.positions.join(' & '):'WHEEL POSITIONS REQUIRED'}</span>}</div>)}</div></div>;
}
