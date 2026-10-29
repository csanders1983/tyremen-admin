import './TyreInspectionReport.css';

const POSITIONS=['NSF','OSF','NSR','OSR'];
const POINTS=['inner','middle','outer'];
const LOCKING_LOCATIONS=['Boot','Glove Box','Centre Console','On Seat','Customer'];

function text(value){return String(value??'').trim();}
function html(value){return text(value).replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));}
function pressure(value={}){
  const source=value?.tyrePressure||value;
  const psi=source?.psi;
  const bar=source?.bar;
  return {psi:psi==null?'':psi,bar:bar==null?'':bar};
}
function technicalFor(job={},completion={}){
  const source=job.vehicle?.tyreTechnical||job.vehicle?.activeTyreFitment||{};
  const front=pressure(source.front?.pressure||completion.pressures?.front||{});
  const rear=pressure(source.rear?.pressure||completion.pressures?.rear||{});
  const torque=source.torqueNm??source.fixing?.torqueNm??completion.torqueNm??'';
  return {front,rear,torque};
}
function lineDescription(line={}){
  const size=text(line.size||line.tyreSize);
  const loadSpeed=text(line.loadSpeed||[line.loadIndex,line.speedIndex].filter(Boolean).join(''));
  const brand=text(line.brand);
  const model=text(line.pattern||line.model||line.productName||line.name||line.description);
  return [size,loadSpeed,brand,model].filter(Boolean).join(' ').replace(/\bQTY\s*\d+\b/ig,'').replace(/\s+/g,' ').trim();
}
function tyreLines(job={}){
  return (job.items||job.tyres||job.workLines||[]).filter(line=>{
    const value=[line.type,line.category,line.name,line.description,line.serviceName].filter(Boolean).join(' ');
    return /tyre|puncture/i.test(value);
  });
}
function hasPuncture(job={}){
  return tyreLines(job).some(line=>/puncture|tyre\s*repair/i.test([line.name,line.description,line.serviceName,line.serviceKey].join(' ')));
}
export function blankTyreCompletion(job={},existing){
  const saved=existing||job.tyreCompletion||{};
  const treadDepths=Object.fromEntries(POSITIONS.map(position=>[
    position,
    Object.fromEntries(POINTS.map(point=>[point,saved.treadDepths?.[position]?.[point]??'']))
  ]));
  return {
    lockingWheelNutLocation:saved.lockingWheelNutLocation||'',
    lockingWheelNutRecipient:saved.lockingWheelNutRecipient||'',
    punctureCause:saved.punctureCause||'',
    treadDepths,
    pressureChecked:saved.pressureChecked===true,
    torqueChecked:saved.torqueChecked===true,
    fitmentChecked:saved.fitmentChecked===true,
    lockingWheelNutReturned:saved.lockingWheelNutReturned===true
  };
}
function pressureLabel(value){
  if(value.psi===''&&value.bar==='')return 'Not available';
  return [value.psi!==''?`${value.psi} psi`:'',value.bar!==''?`${value.bar} bar`:''].filter(Boolean).join(' / ');
}

export function buildTyreCompletion(job={},input={},technicians=[]){
  const location=text(input.lockingWheelNutLocation);
  if(!LOCKING_LOCATIONS.includes(location))throw new Error('Choose where the locking wheel nut was returned');
  const recipient=text(input.lockingWheelNutRecipient).slice(0,120);
  if(location==='Customer'&&!recipient)throw new Error('Enter who the locking wheel nut was handed to');
  const punctureCause=text(input.punctureCause).slice(0,500);
  if(hasPuncture(job)&&!punctureCause)throw new Error('Record what caused the puncture');
  const treadDepths={};
  for(const position of POSITIONS){
    treadDepths[position]={};
    for(const point of POINTS){
      const number=Number(input.treadDepths?.[position]?.[point]);
      if(!Number.isFinite(number)||number<0||number>20)throw new Error(`${position} ${point} tread depth must be between 0 and 20 mm`);
      treadDepths[position][point]=Number(number.toFixed(1));
    }
  }
  for(const key of ['pressureChecked','torqueChecked','fitmentChecked','lockingWheelNutReturned']){
    if(input[key]!==true)throw new Error('Complete every tyre safety confirmation');
  }
  const assigned=[...new Set((technicians||[]).map(text).filter(Boolean))];
  if(!assigned.length)throw new Error('Assign at least one technician before saving the inspection');
  const technical=technicalFor(job,input);
  const frontPsi=Number(technical.front.psi),rearPsi=Number(technical.rear.psi),torqueNm=Number(technical.torque);
  if(!Number.isFinite(frontPsi)||frontPsi<10||frontPsi>100||!Number.isFinite(rearPsi)||rearPsi<10||rearPsi>100||!Number.isFinite(torqueNm)||torqueNm<30||torqueNm>300)throw new Error('Refresh the vehicle lookup to import manufacturer pressure and wheel torque data');
  const source=job.vehicle?.tyreTechnical||job.vehicle?.activeTyreFitment||{};
  return {
    lockingWheelNutLocation:location,
    lockingWheelNutRecipient:location==='Customer'?recipient:'',
    punctureCause,
    treadDepths,
    pressureChecked:true,
    torqueChecked:true,
    fitmentChecked:true,
    lockingWheelNutReturned:true,
    pressures:{
      front:{...(source.front?.pressure||{}),psi:Number(frontPsi.toFixed(1))},
      rear:{...(source.rear?.pressure||{}),psi:Number(rearPsi.toFixed(1))}
    },
    torqueNm:Number(torqueNm.toFixed(1)),
    technicians:assigned,
    completedAt:new Date().toISOString()
  };
}

function Warning({children}){return <div className="tirWarning"><span aria-hidden="true">!</span><strong>{children}</strong></div>;}
function printReport(job,completion){
  const tech=technicalFor(job,completion);
  const descriptions=tyreLines(job).map(lineDescription).filter(Boolean);
  const treadRows=POSITIONS.map(position=>`<tr><th>${position}</th>${POINTS.map(point=>`<td>${html(completion.treadDepths?.[position]?.[point])} mm</td>`).join('')}</tr>`).join('');
  const win=window.open('','_blank');
  if(!win)return false;
  win.document.write(`<!doctype html><html><head><title>Tyremen tyre inspection · ${html(job.registration)}</title><style>body{font-family:Arial,sans-serif;color:#111;margin:32px}header{border-bottom:5px solid #ffd200;padding-bottom:18px;margin-bottom:24px}small{letter-spacing:2px;font-weight:800}h1{margin:6px 0}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.card{border:1px solid #bbb;border-radius:10px;padding:14px}.card b{display:block;font-size:19px;margin-top:6px}.warning{border-left:5px solid #ffd200;background:#f5f5f5;padding:12px;margin:12px 0;font-weight:800}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #bbb;padding:10px;text-align:center}footer{margin-top:28px;color:#555}@media print{button{display:none}}</style></head><body><header><small>TYREMEN · TYRE INSPECTION REPORT</small><h1>${html(job.registration||'Vehicle')}</h1><div>${html(job.vehicle?.make)} ${html(job.vehicle?.model)}</div></header><div class="grid"><div class="card">Front pressure<b>${html(pressureLabel(tech.front))}</b></div><div class="card">Rear pressure<b>${html(pressureLabel(tech.rear))}</b></div><div class="card">Wheel torque<b>${html(tech.torque===''?'Not available':`${tech.torque} Nm`)}</b></div></div>${descriptions.map(value=>`<div class="warning">CHECK FITMENT · ${html(value)}</div>`).join('')}<div class="warning">RETURN LOCKING WHEEL NUT · ${html(completion.lockingWheelNutLocation||'Not recorded')}${completion.lockingWheelNutRecipient?` · ${html(completion.lockingWheelNutRecipient)}`:''}</div>${completion.punctureCause?`<p><b>Puncture cause:</b> ${html(completion.punctureCause)}</p>`:''}<table><thead><tr><th>Position</th><th>Inner</th><th>Middle</th><th>Outer</th></tr></thead><tbody>${treadRows}</tbody></table><footer>Technician${(completion.technicians||[]).length===1?'':'s'}: ${html((completion.technicians||job.technicians||[]).join(' · ')||'Not recorded')}<br>Completed: ${html(completion.completedAt?new Date(completion.completedAt).toLocaleString('en-GB'):'')}</footer><script>window.onload=()=>window.print();<\/script></body></html>`);
  win.document.close();
  return true;
}

export default function TyreInspectionReport({job={},value,onChange,readOnly=false,summaryOnly=false,onRefreshTechnical,onPrintError}){
  const completion=readOnly?(job.tyreCompletion||value||{}):(value||blankTyreCompletion(job));
  const tech=technicalFor(job,completion);
  const technicalMissing=tech.front.psi===''||tech.rear.psi===''||tech.torque==='';
  const update=patch=>onChange?.({...completion,...patch});
  const descriptions=tyreLines(job).map(lineDescription).filter(Boolean);
  const setDepth=(position,point,next)=>update({treadDepths:{...completion.treadDepths,[position]:{...completion.treadDepths?.[position],[point]:next}}});
  return <section className={`tyreInspectionReport ${readOnly?'isReadOnly':''}`}>
    <header className="tirHeader">
      <div><small>TYREMEN · SAFETY RECORD</small><h3>Tyre inspection report</h3><p>{job.registration} · pressures and torque imported from vehicle data</p></div>
      {readOnly&&<button type="button" onClick={()=>{if(!printReport(job,completion))onPrintError?.('Allow the print window in your browser.');}}>Print / save PDF</button>}
    </header>
    <div className="tirSafetyData">
      <div><span>Front pressure</span><strong>{pressureLabel(tech.front)}</strong></div>
      <div><span>Rear pressure</span><strong>{pressureLabel(tech.rear)}</strong></div>
      <div><span>Removed-wheel torque</span><strong>{tech.torque===''?'Not available':`${tech.torque} Nm`}</strong></div>
    </div>
    {technicalMissing&&!readOnly&&<div className="tirMissing"><div><strong>Vehicle safety data is incomplete</strong><span>Refresh the VRM lookup before completing this job. Values cannot be entered manually.</span></div>{onRefreshTechnical&&<button type="button" onClick={onRefreshTechnical}>Refresh vehicle data</button>}</div>}
    {!summaryOnly&&<><div className="tirWarnings">
      {descriptions.length?descriptions.map((description,index)=><Warning key={index}>CHECK FITMENT · {description}</Warning>):<Warning>CHECK FITMENT · Confirm the tyre description on the sales order</Warning>}
      <Warning>RETURN LOCKING WHEEL NUT</Warning>
    </div>
    {readOnly?<div className="tirRecorded">
      <div><span>Locking wheel nut returned to</span><strong>{completion.lockingWheelNutLocation||'Not recorded'}{completion.lockingWheelNutRecipient?` · ${completion.lockingWheelNutRecipient}`:''}</strong></div>
      {completion.punctureCause&&<div><span>Puncture cause</span><strong>{completion.punctureCause}</strong></div>}
    </div>:<div className="tirFormGrid">
      <label>Locking wheel nut returned to *<select required value={completion.lockingWheelNutLocation} onChange={event=>update({lockingWheelNutLocation:event.target.value,lockingWheelNutRecipient:event.target.value==='Customer'?completion.lockingWheelNutRecipient:''})}><option value="">Select location</option>{LOCKING_LOCATIONS.map(option=><option key={option}>{option}</option>)}</select></label>
      {completion.lockingWheelNutLocation==='Customer'&&<label>Handed back to *<input required value={completion.lockingWheelNutRecipient} onChange={event=>update({lockingWheelNutRecipient:event.target.value})} placeholder="Customer name"/></label>}
      {hasPuncture(job)&&<label className="tirWide">What caused the puncture? *<input required value={completion.punctureCause} onChange={event=>update({punctureCause:event.target.value})} placeholder="e.g. nail through centre tread"/></label>}
    </div>}
    <div className="tirTread">
      <div className="tirTreadHeading"><strong>Tyre health check</strong><span>All readings in millimetres</span></div>
      <div className="tirTreadTable">
        <div className="tirTreadRow tirTreadLabels"><b>Position</b>{POINTS.map(point=><b key={point}>{point}</b>)}</div>
        {POSITIONS.map(position=><div className="tirTreadRow" key={position}><strong>{position}</strong>{POINTS.map(point=>readOnly?<span key={point}>{completion.treadDepths?.[position]?.[point]??'—'} <small>mm</small></span>:<label key={point}><input aria-label={`${position} ${point} tread depth`} required type="number" min="0" max="20" step="0.1" value={completion.treadDepths?.[position]?.[point]??''} onChange={event=>setDepth(position,point,event.target.value)}/><small>mm</small></label>)}</div>)}
      </div>
    </div>
    {!readOnly&&<div className="tirChecks">
      {[['pressureChecked','Pressures checked and set to the imported manufacturer values'],['torqueChecked','Removed wheels tightened to the imported manufacturer torque'],['fitmentChecked','Tyre size and full description checked against the fitted tyres'],['lockingWheelNutReturned','Locking wheel nut returned to the recorded location']].map(([key,label])=><label key={key}><input type="checkbox" required checked={completion[key]===true} onChange={event=>update({[key]:event.target.checked})}/><span>{label}</span></label>)}
    </div>}
    {readOnly&&<footer className="tirFooter"><span>Completed by</span><strong>{(completion.technicians||job.technicians||[]).join(' · ')||'Not recorded'}</strong>{completion.completedAt&&<small>{new Date(completion.completedAt).toLocaleString('en-GB')}</small>}</footer>}</>}
  </section>;
}
