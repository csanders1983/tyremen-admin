import "../admin-pages.css";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";

const defaults = {
  offer: { active: false, headline: "Buy 2 tyres and save", minimumQuantity: 2, discountType: "fixedPerTyre", discountAmount: 0 },
  delivery: { deliveryPrice: 12.95, freeDeliveryOver: 0, excludedPostcodes: "" },
  pricing: { priceSource: "midasRetail", vatPercent: 20, roundingMode: "server", notes: "Public shop receives retail price only." },
};
const csvLine = (line) => { const out=[]; let value="", quoted=false; for (const char of line) { if (char === '"') quoted=!quoted; else if (char === "," && !quoted) { out.push(value.trim()); value=""; } else value += char; } out.push(value.trim()); return out; };
const parseCsv = (text) => { const lines=text.split(/\r?\n/).filter(Boolean), headers=csvLine(lines.shift()||""); return lines.map((line) => Object.fromEntries(headers.map((header,index) => [header,csvLine(line)[index]||""]))); };
const safeId = (row,index) => String(row["Part code"] || row.partCode || `kit-${index}`).replace(/[^a-z0-9_-]/gi,"-");

export default function VctCommerce() {
  const [tab,setTab] = useState("overview"); const [orders,setOrders] = useState([]); const [offer,setOffer] = useState(defaults.offer); const [delivery,setDelivery] = useState(defaults.delivery); const [pricing,setPricing] = useState(defaults.pricing); const [status,setStatus] = useState("Live"); const [importStatus,setImportStatus] = useState("");
  useEffect(() => {
    const stops = [
      onSnapshot(query(collection(db,"vctOrders"),orderBy("createdAt","desc")), (snap) => {
        setOrders(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
      }),
      onSnapshot(doc(db,"vctOffers","public"), (snap) => {
        if (snap.exists()) setOffer({ ...defaults.offer, ...snap.data() });
      }),
      onSnapshot(doc(db,"vctDeliveryRules","default"), (snap) => {
        if (snap.exists()) setDelivery({ ...defaults.delivery, ...snap.data() });
      }),
      onSnapshot(doc(db,"vctPricing","tyres"), (snap) => {
        if (snap.exists()) setPricing({ ...defaults.pricing, ...snap.data() });
      }),
    ]; return () => stops.forEach((stop)=>stop());
  },[]);
  const turnover = useMemo(() => orders.filter((x)=>x.status!=="cancelled").reduce((sum,x)=>sum+Number(x.total||0),0),[orders]);
  const save = async (collectionName,id,value) => { setStatus("Saving…"); await setDoc(doc(db,collectionName,id),{...value,updatedAt:new Date().toISOString()},{merge:true}); setStatus("Live"); };
  const importRoadHero = async (event) => {
    const file=event.target.files?.[0]; if(!file)return; setImportStatus("Reading file…");
    try { const rows=parseCsv(await file.text()); if(!rows.length) throw new Error("No rows found"); let written=0;
      for(let start=0;start<rows.length;start+=400){const batch=writeBatch(db); rows.slice(start,start+400).forEach((row,index)=>batch.set(doc(db,"vctRoadHero",safeId(row,start+index)),{...row,sourceFile:file.name,updatedAt:new Date().toISOString()})); await batch.commit(); written+=Math.min(400,rows.length-start); setImportStatus(`Imported ${written} of ${rows.length}…`);}
      setImportStatus(`${written} Road Hero kits imported successfully.`);
    } catch(error){setImportStatus(`Import failed: ${error.message}`);} finally{event.target.value="";}
  };
  const setOrderStatus = (id,value) => updateDoc(doc(db,"vctOrders",id),{status:value,updatedAt:new Date().toISOString()});
  return <section className="adminPage vctAdmin">
    <div className="adminHero vctHero"><span>SEPARATE E-COMMERCE CHANNEL</span><h2>Very Cheap Tyres</h2><p>Orders, retail controls, delivery and Road Hero data for verycheaptyres.co.uk.</p></div>
    <div className="adminStats"><div className="adminStat"><span>Orders</span><strong>{orders.length}</strong></div><div className="adminStat"><span>Order value</span><strong>£{turnover.toFixed(2)}</strong></div><div className="adminStat"><span>Connection</span><strong className="smallStat">{status}</strong></div></div>
    <div className="vctTabs">{[["overview","Overview"],["orders","Orders"],["offer","Offer"],["delivery","Delivery"],["pricing","Tyre pricing"],["roadhero","Road Hero import"]].map(([id,label])=><button className={tab===id?"active":""} onClick={()=>setTab(id)} key={id}>{label}</button>)}</div>
    {tab==="overview"&&<div className="adminPanel"><h3>Connected, but kept separate</h3><div className="vctFlow"><div><b>verycheaptyres.co.uk</b><span>Public shop</span></div><i>→</i><div><b>vctOrders</b><span>Dedicated orders</span></div><i>→</i><div><b>This admin tab</b><span>Private control</span></div></div><div className="adminInfoBox">Tyre supplier cost and markup rules stay out of the public site. The shop displays only the final retail value returned by the server.</div></div>}
    {tab==="orders"&&<div className="adminPanel"><div className="adminItemsHeader"><div><h3>Online orders</h3><p>Only orders with the Very Cheap Tyres sales channel appear here.</p></div></div><div className="vctOrderList">{orders.map((order)=><article key={order.id}><div><small>{order.id}</small><h4>{order.customer?.firstName} {order.customer?.lastName}</h4><p>{order.customer?.email} · {order.customer?.postcode}</p></div><strong>£{Number(order.total||0).toFixed(2)}</strong><select value={order.status||"new"} onChange={(e)=>setOrderStatus(order.id,e.target.value)}><option value="awaiting-payment">Awaiting payment</option><option value="paid">Paid</option><option value="processing">Processing</option><option value="dispatched">Dispatched</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></article>)}{!orders.length&&<p>No Very Cheap Tyres orders yet.</p>}</div></div>}
    {tab==="offer"&&<div className="adminPanel vctForm"><h3>Public promotion</h3><label className="toggleField"><input type="checkbox" checked={offer.active} onChange={(e)=>setOffer({...offer,active:e.target.checked})}/>Promotion active</label><label>Headline<input value={offer.headline} onChange={(e)=>setOffer({...offer,headline:e.target.value})}/></label><div className="adminFormGrid"><label>Minimum quantity<input type="number" value={offer.minimumQuantity} onChange={(e)=>setOffer({...offer,minimumQuantity:Number(e.target.value)})}/></label><label>Saving per tyre £<input type="number" step=".01" value={offer.discountAmount} onChange={(e)=>setOffer({...offer,discountAmount:Number(e.target.value)})}/></label></div><button onClick={()=>save("vctOffers","public",offer)}>Save offer</button></div>}
    {tab==="delivery"&&<div className="adminPanel vctForm"><h3>Delivery rules</h3><div className="adminFormGrid"><label>Standard delivery £<input type="number" step=".01" value={delivery.deliveryPrice} onChange={(e)=>setDelivery({...delivery,deliveryPrice:Number(e.target.value)})}/></label><label>Free delivery over £<input type="number" step=".01" value={delivery.freeDeliveryOver} onChange={(e)=>setDelivery({...delivery,freeDeliveryOver:Number(e.target.value)})}/></label></div><label>Excluded postcode prefixes<textarea value={delivery.excludedPostcodes} onChange={(e)=>setDelivery({...delivery,excludedPostcodes:e.target.value})} placeholder="Comma separated. Leave blank to deliver nationwide."/></label><button onClick={()=>save("vctDeliveryRules","default",delivery)}>Save delivery</button></div>}
    {tab==="pricing"&&<div className="adminPanel vctForm"><h3>Tyre retail control</h3><p>These are private server-side controls. Update the MIDAS server function to read this document before launch.</p><div className="adminFormGrid"><label>VAT %<input type="number" value={pricing.vatPercent} onChange={(e)=>setPricing({...pricing,vatPercent:Number(e.target.value)})}/></label><label>Price source<select value={pricing.priceSource} onChange={(e)=>setPricing({...pricing,priceSource:e.target.value})}><option value="midasRetail">MIDAS final retail</option><option value="adminRetail">Admin retail override</option></select></label></div><label>Internal notes<textarea value={pricing.notes} onChange={(e)=>setPricing({...pricing,notes:e.target.value})}/></label><button onClick={()=>save("vctPricing","tyres",pricing)}>Save private pricing control</button></div>}
    {tab==="roadhero"&&<div className="adminPanel vctForm"><h3>Road Hero product data</h3><p>Import the supplier CSV containing Manufacturer, Model, year range, wheel size, tyre size, part code and Sell Inc Vat.</p><label className="vctImport">Choose Road Hero CSV<input type="file" accept=".csv,text/csv" onChange={importRoadHero}/></label>{importStatus&&<div className="adminInfoBox">{importStatus}</div>}</div>}
  </section>;
}
