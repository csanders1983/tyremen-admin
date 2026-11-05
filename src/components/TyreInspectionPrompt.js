import TyreInspectionReport,{blankTyreCompletion} from './TyreInspectionReport';
export default function TyreInspectionPrompt({job,value,onChange,onRefreshTechnical}){
 const draft=value||blankTyreCompletion(job);
 return <details className="tyreInspectionPrompt"><summary><strong>TYRE HEALTH & SAFETY CHECK · open inspection</strong><span>Record tread readings now or in the bay. All checks must be complete before Job complete.</span></summary><p className="queueHint">Only confirm work that has actually been carried out. Saving a sales order does not mark the inspection complete.</p><TyreInspectionReport job={job} value={draft} onChange={onChange} draftMode onRefreshTechnical={onRefreshTechnical}/></details>;
}
