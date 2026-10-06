import "../admin-pages.css";
import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useAuth } from "../auth/AuthContext";

const FUNCTIONS_ROOT = "https://us-central1-tyremen-system.cloudfunctions.net";
const blankProduct = () => ({ id: "", sku: "", category: "tyre", description: "", brand: "", pattern: "", size: "", loadSpeed: "", season: "", supplier: "", supplierCode: "", costExVat: 0, retailIncVat: 0, special2PlusIncVat: 0, xtraIncVat: 0, supplyIncVat: 0, stockQty: 0, reorderLevel: 2, active: true, source: "manual", vehicleType: "car", homologation: "", runFlat: false, extraLoad: false, brandLogo: "" });
const blankService = () => ({ id: "", code: "", name: "", category: "general-repair", retailIncVat: 0, costExVat: 0, vatRate: 20, notes: "", active: true });
const sizeSearch = (width = "205", profile = "55", rim = "16") => ({ width, profile, rim, speed: "" });

function csvCells(line) {
  const cells = []; let value = ""; let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && line[index + 1] === '"' && quoted) { value += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) { cells.push(value.trim()); value = ""; }
    else value += character;
  }
  cells.push(value.trim());
  return cells;
}

function parseStockCsv(text) {
  const lines = String(text || "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = csvCells(lines.shift()).map((header) => header.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const value = (row, names) => { const index = headers.findIndex((header) => names.includes(header)); return index >= 0 ? row[index] || "" : ""; };
  return lines.map(csvCells).map((row) => {
    const brand = value(row, ["brand", "manufacturer", "make"]);
    const pattern = value(row, ["pattern", "model", "treadpattern"]);
    const size = value(row, ["size", "tyresize"]);
    return {
      sku: value(row, ["sku", "stocknumber", "stockno", "code", "productcode", "partcode"]),
      category: value(row, ["category", "type"]) || "tyre",
      description: value(row, ["description", "product", "name"]) || [brand, pattern, size].filter(Boolean).join(" "),
      brand, pattern, size,
      loadSpeed: value(row, ["loadspeed", "loadindex", "speedrating"]),
      supplier: value(row, ["supplier", "vendor"]),
      supplierCode: value(row, ["suppliercode", "vendorcode", "partcode"]),
      costExVat: Number(value(row, ["costexvat", "cost", "buyprice", "tradeprice"]) || 0),
      retailIncVat: Number(value(row, ["retailincvat", "retail", "sellprice", "price"]) || 0),
      special2PlusIncVat: Number(value(row, ["2specialincvat", "2plusspecialincvat", "special2plusincvat", "specialincvat"]) || 0),
      xtraIncVat: Number(value(row, ["xtraincvat", "extra", "extraincvat"]) || 0),
      supplyIncVat: Number(value(row, ["supplyincvat", "supplyprice", "supply"]) || 0),
      stockQty: Number(value(row, ["stockqty", "stock", "quantity", "qty"]) || 0),
      reorderLevel: Number(value(row, ["reorderlevel", "minimumstock", "minstock"]) || 0),
      vehicleType: String(value(row, ["vehicletype", "tyretype"]) || "car").toLowerCase(),
      homologation: value(row, ["homologation", "oemarking", "oem"]).toUpperCase(),
      runFlat: /^(yes|true|y|1)$/i.test(value(row, ["runflat", "rf"])),
      extraLoad: /^(yes|true|y|1)$/i.test(value(row, ["extraload", "xl"])),
      brandLogo: value(row, ["brandlogo", "brandlogourl"]),
      source: "csv", active: true,
    };
  }).filter((product) => product.sku && product.description);
}

function parseServiceCsv(text) {
  const lines = String(text || "").split(/\r?\n/).filter((line) => line.trim());
  const headers = csvCells(lines.shift() || "").map((value) => value.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const read = (row, name) => row[headers.indexOf(name)] || "";
  if (!headers.includes("code") || !headers.includes("name")) throw new Error("Service CSV requires Code and Name columns.");
  return lines.map(csvCells).map((row) => ({ code: read(row, "code"), name: read(row, "name"), category: read(row, "category") || "general-repair", retailIncVat: Number(read(row, "retailincvat") || 0), costExVat: Number(read(row, "costexvat") || 0), vatRate: Number(read(row, "vatrate") || 20), notes: read(row, "notes") })).filter((row) => row.code && row.name);
}
function downloadCsv(filename, headers, records) {
  const safeCell = (value) => { const content = String(value ?? ""); const escaped = /^[=+@\-\t\r]/.test(content) ? `'${content}` : content; return `"${escaped.replaceAll('"', '""')}"`; };
  const csv = [headers.map(safeCell).join(","), ...records.map((record) => record.map(safeCell).join(","))].join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function fallbackPrices(product) {
  const retail = Number(product.retailIncVat || 0);
  const cost = Number(product.costExVat || 0);
  return {
    retail,
    special2Plus: Number(product.special2PlusIncVat || Math.max(0, retail - 4.9992)),
    xtra: Number(product.xtraIncVat || retail * (retail <= 198 ? 0.92 : 0.96)),
    supply: Number(product.supplyIncVat || (cost + 12) * 1.2),
  };
}

function TyreBadges({ tyre }) {
  return <div className="tyreBadges"><span className={`vehicleBadge ${tyre.vehicleType || "car"}`}>{tyre.vehicleType === "commercial" ? "COMMERCIAL" : tyre.vehicleType === "suv" ? "SUV / 4x4" : "CAR"}</span>{tyre.runFlat && <span>RUN-FLAT</span>}{tyre.extraLoad && <span>XL</span>}{tyre.homologation && <span className="oeBadge">OE {tyre.homologation}</span>}</div>;
}

export default function Tyres() {
  const { role } = useAuth();
  const [tab, setTab] = useState("stock");
  const [products, setProducts] = useState([]);
  const [services, setServices] = useState([]);
  const [movements, setMovements] = useState([]);
  const [search, setSearch] = useState("");
  const [stockStatus, setStockStatus] = useState("none");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [editor, setEditor] = useState(blankProduct);
  const [serviceEditor, setServiceEditor] = useState(blankService);
  const [serviceSearch, setServiceSearch] = useState("");
  const [counts, setCounts] = useState({});
  const [midas, setMidas] = useState(sizeSearch());
  const [midasResults, setMidasResults] = useState([]);
  const [midasBrand, setMidasBrand] = useState("all");
  const [frontSize, setFrontSize] = useState(sizeSearch("225", "40", "19"));
  const [rearSize, setRearSize] = useState(sizeSearch("255", "35", "19"));
  const [matchMode, setMatchMode] = useState("pattern");
  const [matchedSets, setMatchedSets] = useState([]);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => onSnapshot(collection(db, "stockProducts"), (snapshot) => setProducts(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })))), []);
  useEffect(() => onSnapshot(collection(db, "serviceMaster"), (snapshot) => setServices(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })))), []);
  useEffect(() => {
    const movementQuery = query(collection(db, "stockMovements"), orderBy("createdAt", "desc"), limit(150));
    return onSnapshot(movementQuery, (snapshot) => setMovements(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))));
  }, []);

  const authenticatedPost = async (path, body) => {
    const token = await auth.currentUser.getIdToken();
    const response = await fetch(`${FUNCTIONS_ROOT}/${path}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || `${path} failed`);
    return data;
  };

  const brands = useMemo(() => [...new Set(products.map((product) => product.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [products]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const requested = Boolean(term) || stockStatus !== "none" || categoryFilter !== "all" || brandFilter !== "all";
    if (!requested) return [];
    return products.filter((product) => {
      const quantity = Number(product.stockQty || 0);
      const archived = product.active === false;
      if (stockStatus === "archived" ? !archived : archived) return false;
      if (stockStatus === "in" && quantity <= 0) return false;
      if (stockStatus === "out" && quantity > 0) return false;
      if (stockStatus === "low" && quantity > Number(product.reorderLevel || 0)) return false;
      if (categoryFilter !== "all" && product.category !== categoryFilter) return false;
      if (brandFilter !== "all" && product.brand !== brandFilter) return false;
      return !term || [product.sku, product.description, product.brand, product.pattern, product.size, product.supplier, product.supplierCode].join(" ").toLowerCase().includes(term);
    });
  }, [products, search, stockStatus, categoryFilter, brandFilter]);
  const totals = useMemo(() => { const active = products.filter((product) => product.active !== false); return { lines: active.length, units: active.reduce((sum, product) => sum + Number(product.stockQty || 0), 0), cost: active.reduce((sum, product) => sum + Number(product.stockQty || 0) * Number(product.costExVat || 0), 0), low: active.filter((product) => Number(product.stockQty || 0) <= Number(product.reorderLevel || 0)).length }; }, [products]);
  const midasBrands = useMemo(() => [...new Set(midasResults.map((tyre) => tyre.brand).filter(Boolean))].sort(), [midasResults]);
  const visibleMidas = useMemo(() => midasBrand === "all" ? midasResults : midasResults.filter((tyre) => tyre.brand === midasBrand), [midasResults, midasBrand]);
  const visibleServices = useMemo(() => { const term = serviceSearch.toLowerCase().trim(); return services.filter((service) => !term || [service.code, service.name, service.category, service.notes].join(" ").toLowerCase().includes(term)); }, [services, serviceSearch]);

  const clearStockSearch = () => { setSearch(""); setStockStatus("none"); setCategoryFilter("all"); setBrandFilter("all"); };
  const saveProduct = async (product = editor) => { setBusy("save"); setMessage(""); try { const data = await authenticatedPost("saveStockProduct", { product }); setEditor(blankProduct()); setMessage(`${data.product.sku} saved to stock.`); } catch (error) { setMessage(error.message); } finally { setBusy(""); } };
  const adjust = async (product, newQuantity) => { setBusy(`count-${product.id}`); setMessage(""); try { const data = await authenticatedPost("adjustStockQuantity", { productId: product.id, newQuantity: Number(newQuantity), reason: "stock-count", reference: "Admin stock count" }); setMessage(`${product.sku}: ${data.beforeQty} changed to ${data.afterQty}.`); setCounts((current) => ({ ...current, [product.id]: "" })); } catch (error) { setMessage(error.message); } finally { setBusy(""); } };
  const runMidasSearch = (size) => authenticatedPost("adminMidasTyreSearchV2", size);
  const searchMidas = async () => { setBusy("midas"); setMessage(""); setMidasResults([]); setMidasBrand("all"); try { const data = await runMidasSearch(midas); setMidasResults(data.products || []); setMessage(`${data.search?.count || 0} Oak/MIDAS tyres found.`); } catch (error) { setMessage(error.message); } finally { setBusy(""); } };
  const clearMidas = () => { setMidasResults([]); setMidasBrand("all"); setMessage(""); };
  const midasProduct = (tyre) => ({ sku: tyre.code || String(tyre.id || ""), category: "tyre", description: `${tyre.brand || ""} ${tyre.pattern || ""} ${tyre.size || ""} ${tyre.loadSpeed || ""}`.replace(/\s+/g, " ").trim(), brand: tyre.brand || "", pattern: tyre.pattern || "", size: tyre.size || "", loadSpeed: tyre.loadSpeed || "", season: tyre.season || "", supplier: tyre.supplier || "Oak Tyres / MIDAS", supplierCode: tyre.supplierCode || tyre.code || "", source: "midas", costExVat: Number(tyre.costExVat || 0), retailIncVat: Number(tyre.priceLevels?.retail ?? tyre.pricing?.retail ?? 0), special2PlusIncVat: Number(tyre.priceLevels?.special2Plus || 0), xtraIncVat: Number(tyre.priceLevels?.xtra || 0), supplyIncVat: Number(tyre.priceLevels?.supply || 0), stockQty: 0, reorderLevel: 2, midasId: String(tyre.id || ""), image: tyre.images?.tyre || "", brandLogo: tyre.brandLogo || tyre.images?.brand || "", runFlat: tyre.runFlat, extraLoad: tyre.extraLoad, vehicleType: tyre.vehicleType || "car", homologation: tyre.homologation || "", active: true });
  const addMidasProduct = (tyre) => saveProduct(midasProduct(tyre));
  const searchMatchedSets = async () => { setBusy("matched"); setMessage(""); setMatchedSets([]); try { const [front, rear] = await Promise.all([runMidasSearch(frontSize), runMidasSearch(rearSize)]); const rearProducts = rear.products || []; const pairs = []; (front.products || []).forEach((frontTyre) => { rearProducts.forEach((rearTyre) => { const sameBrand = String(frontTyre.brand).toLowerCase() === String(rearTyre.brand).toLowerCase(); const samePattern = String(frontTyre.pattern).toLowerCase() === String(rearTyre.pattern).toLowerCase(); if (sameBrand && (matchMode === "brand" || samePattern)) pairs.push({ front: frontTyre, rear: rearTyre, exact: samePattern }); }); }); setMatchedSets(pairs.sort((a, b) => Number(b.exact) - Number(a.exact)).slice(0, 80)); setMessage(`${pairs.length} matching front and rear combinations found.`); } catch (error) { setMessage(error.message); } finally { setBusy(""); } };
  const addMatchedSet = async (pair) => { setBusy("pair"); try { await authenticatedPost("saveStockProduct", { product: midasProduct(pair.front) }); await authenticatedPost("saveStockProduct", { product: midasProduct(pair.rear) }); setMessage(`${pair.front.brand} ${pair.front.pattern} front and rear added.`); } catch (error) { setMessage(error.message); } finally { setBusy(""); } };
  const importCsv = async (event) => { const file = event.target.files?.[0]; if (!file) return; setBusy("import"); setMessage(""); try { const parsed = parseStockCsv(await file.text()); if (!parsed.length) throw new Error("No valid rows. Include Stock Number/SKU and Description columns."); const data = await authenticatedPost("bulkImportStockProducts", { products: parsed, fileName: file.name }); setMessage(`${data.imported} stock products imported from ${file.name}.`); } catch (error) { setMessage(error.message); } finally { setBusy(""); event.target.value = ""; } };
  const exportStock = (category) => downloadCsv(`tyremen-${category === "all" ? "all-stock" : category}.csv`, ["SKU","Category","Description","Brand","Pattern","Size","Load Speed","Supplier","Supplier Code","Cost Ex VAT","Retail Inc VAT","2+ Special Inc VAT","Xtra Inc VAT","Supply Inc VAT","Stock Qty","Reorder Level","Vehicle Type","Homologation","Runflat","Extra Load","Brand Logo URL"], products.filter((product) => category === "all" || product.category === category).map((p) => [p.sku,p.category,p.description,p.brand,p.pattern,p.size,p.loadSpeed,p.supplier,p.supplierCode,p.costExVat,p.retailIncVat,p.special2PlusIncVat,p.xtraIncVat,p.supplyIncVat,p.stockQty,p.reorderLevel,p.vehicleType,p.homologation,p.runFlat,p.extraLoad,p.brandLogo]));
  const exportServices = () => downloadCsv("tyremen-service-master.csv", ["Code","Name","Category","Retail Inc VAT","Cost Ex VAT","VAT Rate","Notes"], services.map((s) => [s.code,s.name,s.category,s.retailIncVat,s.costExVat,s.vatRate,s.notes]));
  const importServices = async (event) => { const file = event.target.files?.[0]; if (!file) return; setBusy("services-import"); try { const rows = parseServiceCsv(await file.text()); if (!rows.length) throw new Error("No valid service records found."); if (!window.confirm(`Import ${rows.length} service lines?`)) return; let count = 0; for (let index = 0; index < rows.length; index += 100) { const result = await authenticatedPost("bulkImportServiceMaster", { items: rows.slice(index, index + 100), fileName: file.name }); count += result.imported; } setMessage(`${count} services imported.`); } catch (error) { setMessage(error.message); } finally { setBusy(""); event.target.value = ""; } };
  const recalculatePrices = async () => { if (!window.confirm("Recalculate 2+ Special, Xtra and Supply for every stock product?")) return; setBusy("recalculate"); try { const data = await authenticatedPost("recalculateStockPriceLevels", {}); setMessage(`${data.updated} stock products recalculated.`); } catch (error) { setMessage(error.message); } finally { setBusy(""); } };
  const setArchived = async (product, archived) => { if (archived && !window.confirm(`Remove ${product.sku} from the active Stock Master? Its history will be retained.`)) return; setBusy(`archive-${product.id}`); try { await authenticatedPost("setStockProductArchived", { productId: product.id, archived }); setMessage(`${product.sku} ${archived ? "removed from active stock" : "restored to active stock"}.`); } catch (error) { setMessage(error.message); } finally { setBusy(""); } };
  const saveService = async () => { setBusy("service"); setMessage(""); try { const data = await authenticatedPost("saveServiceMasterItem", { item: serviceEditor }); setServiceEditor(blankService()); setMessage(`${data.item.code} saved to Service Master.`); } catch (error) { setMessage(error.message); } finally { setBusy(""); } };
  const edit = (product) => { setEditor({ ...blankProduct(), ...product }); setTab("add"); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const timestamp = (value) => value?.toDate ? value.toDate().toLocaleString("en-GB") : value ? new Date(value).toLocaleString("en-GB") : "—";
  const inputSize = (value, setValue, key, label) => <label>{label}<input value={value[key]} onChange={(event) => setValue({ ...value, [key]: event.target.value })} /></label>;

  return <section className="adminPage stockPage">
    <div className="adminHero"><span>STOCK, SUPPLIERS &amp; COUNTS</span><h2>Stock Control</h2><p>Search stock only when needed, manage Oak/MIDAS supply, service lines, counts and permanent movement history.</p></div>
    <div className="stockSummary"><div><span>Product lines</span><strong>{totals.lines}</strong></div><div><span>Units in stock</span><strong>{totals.units}</strong></div><div><span>Stock cost ex VAT</span><strong>£{totals.cost.toFixed(2)}</strong></div><div className={totals.low ? "warning" : ""}><span>Low / reorder</span><strong>{totals.low}</strong></div></div>
    <div className="salesTabs stockTabs">{[['stock','Tyremen stock'],['midas','Partner stock'],['matched','Staggered matched sets'],['services','Service master'],['addService','Add service'],['add','Add product'],['count','Stock count'],['import','CSV import'],['history','Movement history']].map(([key, label]) => <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>)}</div>
    {message && <div className="adminInfoBox">{message}</div>}

    {tab === "stock" && <div className="adminPanel"><div className="stockMasterHeader"><div><h3>Tyremen stock</h3><p>Search first or deliberately choose All, In stock, Out of stock, Low stock or Archived.</p></div><div className="stockSearchControls"><input className="searchInput" placeholder="Stock number, size, brand or supplier…" value={search} onChange={(event) => setSearch(event.target.value)} /><select value={stockStatus} onChange={(event) => setStockStatus(event.target.value)}><option value="none">Search only</option><option value="all">All products</option><option value="in">In stock</option><option value="out">Out of stock</option><option value="low">Low / reorder</option><option value="archived">Archived / removed</option></select><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">All categories</option><option value="tyre">Tyres</option><option value="part">Parts</option><option value="alloy">Alloys</option><option value="space-saver">Space savers</option><option value="consumable">Consumables</option><option value="lawnmower-tyre">Lawnmower tyres</option><option value="tube">Tubes</option><option value="wheel-nut">Wheel nuts &amp; bolts</option><option value="battery">Batteries</option><option value="mechanical-part">Mechanical parts</option><option value="other">Other</option></select><select value={brandFilter} onChange={(event) => setBrandFilter(event.target.value)}><option value="all">All brands</option>{brands.map((brand) => <option key={brand}>{brand}</option>)}</select><button onClick={clearStockSearch}>Clear</button></div></div><div className="stockTable"><div className="stockHead"><span>Stock no.</span><span>Description</span><span>Supplier</span><span>Cost ex VAT</span><span>Retail</span><span>2+ Special</span><span>Xtra</span><span>Supply</span><span>Qty</span><span></span></div>{filtered.map((product) => { const prices = fallbackPrices(product); return <div className={`stockRow ${product.active === false ? "archivedRow" : ""}`} key={product.id}><b className="stockSku">{product.sku}</b><span className="stockDescription">{product.brandLogo && <img src={product.brandLogo} alt="" />}<span><strong>{product.description}</strong><small>{product.category} {product.size ? `· ${product.size}` : ""}</small><TyreBadges tyre={product} /></span></span><span>{product.supplier || "—"}</span><span>£{Number(product.costExVat || 0).toFixed(2)}</span><span>£{prices.retail.toFixed(2)}</span><span>£{prices.special2Plus.toFixed(2)}</span><span>£{prices.xtra.toFixed(2)}</span><span>£{prices.supply.toFixed(2)}</span><b className={Number(product.stockQty || 0) <= Number(product.reorderLevel || 0) ? "lowStock" : ""}>{Number(product.stockQty || 0)}</b><div className="stockRowActions"><button onClick={() => edit(product)}>Edit</button>{product.active === false ? <button className="restore" onClick={() => setArchived(product, false)} disabled={busy === `archive-${product.id}`}>Restore</button> : <button className="remove" onClick={() => setArchived(product, true)} disabled={busy === `archive-${product.id}`}>Remove</button>}</div></div>; })}{!search.trim() && stockStatus === "none" && categoryFilter === "all" && brandFilter === "all" && <div className="stockEmptyPrompt">No products are displayed until you search or choose a filter.</div>}{(search.trim() || stockStatus !== "none" || categoryFilter !== "all" || brandFilter !== "all") && !filtered.length && <div className="stockEmptyPrompt">No matching stock products.</div>}</div></div>}

    {tab === "midas" && <div className="adminPanel"><div className="adminEditHeader"><div><h3>Partner stock (Oak / MIDAS)</h3><p>No products display until Search Live Stock is pressed.</p></div>{midasResults.length > 0 && <button onClick={clearMidas}>Clear search</button>}</div><div className="midasAdminSearch">{inputSize(midas,setMidas,"width","Width")}{inputSize(midas,setMidas,"profile","Profile")}{inputSize(midas,setMidas,"rim","Rim")}{inputSize(midas,setMidas,"speed","Speed (optional)")}<button className="adminPrimaryButton" onClick={searchMidas} disabled={busy === "midas"}>{busy === "midas" ? "SEARCHING…" : "SEARCH LIVE STOCK"}</button></div>{midasResults.length > 0 && <div className="midasFilterBar"><label>Brand<select value={midasBrand} onChange={(event) => setMidasBrand(event.target.value)}><option value="all">All brands</option>{midasBrands.map((brand) => <option key={brand}>{brand}</option>)}</select></label><span>{visibleMidas.length} products shown</span></div>}<div className="midasStockResults">{visibleMidas.map((tyre) => <article key={`${tyre.id}-${tyre.code}`}><div className="midasIdentity">{tyre.brandLogo && <img src={tyre.brandLogo} alt={`${tyre.brand} logo`} />}<small>{tyre.code}</small><h4>{tyre.brand} {tyre.pattern}</h4><p>{tyre.size} {tyre.loadSpeed} · {tyre.season}</p><TyreBadges tyre={tyre} /><span>Local {tyre.stock?.available || 0} · Network {tyre.stock?.network || 0}</span></div><div className="midasPriceLevels"><small>PRIVATE COST EX VAT</small><b>£{Number(tyre.costExVat || 0).toFixed(2)}</b><span><i>Retail</i><strong>£{Number(tyre.priceLevels?.retail || 0).toFixed(2)}</strong></span><span><i>2+ Special</i><strong>£{Number(tyre.priceLevels?.special2Plus || 0).toFixed(2)}</strong></span><span><i>Xtra</i><strong>£{Number(tyre.priceLevels?.xtra || 0).toFixed(2)}</strong></span><span><i>Supply</i><strong>£{Number(tyre.priceLevels?.supply || 0).toFixed(2)}</strong></span><button onClick={() => addMidasProduct(tyre)} disabled={busy === "save"}>Add to stock master</button></div></article>)}</div></div>}

    {tab === "matched" && <div className="adminPanel"><div className="adminEditHeader"><div><h3>Staggered matched sets</h3><p>Search staggered sizes and match the same brand and pattern, or broaden to the same brand.</p></div></div><div className="matchedSizeSearch"><fieldset><legend>Front size</legend>{inputSize(frontSize,setFrontSize,"width","Width")}{inputSize(frontSize,setFrontSize,"profile","Profile")}{inputSize(frontSize,setFrontSize,"rim","Rim")}</fieldset><fieldset><legend>Rear size</legend>{inputSize(rearSize,setRearSize,"width","Width")}{inputSize(rearSize,setRearSize,"profile","Profile")}{inputSize(rearSize,setRearSize,"rim","Rim")}</fieldset><div className="matchChoice"><label><input type="radio" checked={matchMode === "pattern"} onChange={() => setMatchMode("pattern")} />Exact brand and pattern</label><label><input type="radio" checked={matchMode === "brand"} onChange={() => setMatchMode("brand")} />Same brand, different pattern allowed</label><button className="adminPrimaryButton" onClick={searchMatchedSets} disabled={busy === "matched"}>{busy === "matched" ? "MATCHING…" : "FIND MATCHED SETS"}</button></div></div><div className="matchedResults">{matchedSets.map((pair, index) => <article key={`${pair.front.code}-${pair.rear.code}-${index}`}><header><div>{pair.front.brandLogo && <img src={pair.front.brandLogo} alt="" />}<strong>{pair.front.brand}</strong><span className={pair.exact ? "exactMatch" : "brandMatch"}>{pair.exact ? "EXACT PATTERN MATCH" : "BRAND MATCH"}</span></div><button onClick={() => addMatchedSet(pair)} disabled={busy === "pair"}>Add both to stock</button></header><div className="matchedAxles"><section><small>FRONT</small><b>{pair.front.pattern}</b><span>{pair.front.size} {pair.front.loadSpeed}</span><strong>Retail £{Number(pair.front.priceLevels?.retail || 0).toFixed(2)}</strong><TyreBadges tyre={pair.front} /></section><section><small>REAR</small><b>{pair.rear.pattern}</b><span>{pair.rear.size} {pair.rear.loadSpeed}</span><strong>Retail £{Number(pair.rear.priceLevels?.retail || 0).toFixed(2)}</strong><TyreBadges tyre={pair.rear} /></section></div></article>)}{!matchedSets.length && busy !== "matched" && <div className="stockEmptyPrompt">Enter both sizes, choose the matching rule and search.</div>}</div></div>}

    {tab === "addService" && <div className="adminPanel stockEditor"><div className="adminEditHeader"><div><h3>{serviceEditor.id ? "Edit Service Master item" : "Add Service Master item"}</h3><p>Reusable non-stock labour, MOT, service and repair lines.</p></div>{serviceEditor.id && <button onClick={() => setServiceEditor(blankService())}>New item</button>}</div><div className="stockFormGrid"><label>Service code *<input value={serviceEditor.code} onChange={(event) => setServiceEditor({ ...serviceEditor, code: event.target.value.toUpperCase() })} /></label><label>Category<select value={serviceEditor.category} onChange={(event) => setServiceEditor({ ...serviceEditor, category: event.target.value })}><option value="mot">MOT</option><option value="service">Servicing</option><option value="alignment">Wheel alignment</option><option value="puncture">Puncture repair</option><option value="balancing">Wheel balancing</option><option value="diagnostics">Diagnostics</option><option value="aircon">Air-conditioning</option><option value="general-repair">General repair</option></select></label><label className="wide">Description *<input value={serviceEditor.name} onChange={(event) => setServiceEditor({ ...serviceEditor, name: event.target.value })} /></label><label>Retail inc VAT £<input type="number" step=".01" value={serviceEditor.retailIncVat} onChange={(event) => setServiceEditor({ ...serviceEditor, retailIncVat: Number(event.target.value) })} /></label><label>Estimated cost ex VAT £<input type="number" step=".01" value={serviceEditor.costExVat} onChange={(event) => setServiceEditor({ ...serviceEditor, costExVat: Number(event.target.value) })} /></label><label>VAT rate %<input type="number" value={serviceEditor.vatRate} onChange={(event) => setServiceEditor({ ...serviceEditor, vatRate: Number(event.target.value) })} /></label><label className="wide">Internal notes<input value={serviceEditor.notes} onChange={(event) => setServiceEditor({ ...serviceEditor, notes: event.target.value })} /></label></div><button className="adminPrimaryButton" onClick={saveService} disabled={busy === "service"}>{busy === "service" ? "SAVING…" : "SAVE SERVICE MASTER ITEM"}</button></div>}
    {tab === "services" && <div className="adminPanel"><div className="pageTitleRow"><div><h3>Search Service Master</h3><p>{services.length} reusable non-stock lines.</p><button type="button" onClick={exportServices}>Export services CSV</button>{role === "owner" && <label>Import services CSV<input type="file" accept=".csv,text/csv" onChange={importServices} disabled={busy === "services-import"} /></label>}</div><input className="searchInput" placeholder="Search code, service or category…" value={serviceSearch} onChange={(event) => setServiceSearch(event.target.value)} /></div><div className="serviceMasterList">{visibleServices.map((service) => <article key={service.id}><div><b>{service.code}</b><strong>{service.name}</strong><small>{service.category} · VAT {service.vatRate}%</small></div><span>£{Number(service.retailIncVat || 0).toFixed(2)}</span><button onClick={() => { setServiceEditor({ ...blankService(), ...service }); setTab("addService"); }}>Edit</button></article>)}</div></div>}

    {tab === "add" && <div className="adminPanel stockEditor"><div className="adminEditHeader"><div><h3>{editor.id ? "Edit stock product" : "Add stock product"}</h3><p>All four selling levels can be entered or recalculated from the published rules.</p></div>{editor.id && <button onClick={() => setEditor(blankProduct())}>New product</button>}</div><div className="stockFormGrid"><label>Stock number / SKU *<input value={editor.sku} onChange={(event) => setEditor({ ...editor, sku: event.target.value.toUpperCase() })} /></label><label>Category<select value={editor.category} onChange={(event) => setEditor({ ...editor, category: event.target.value })}><option value="tyre">Tyre</option><option value="part">Part</option><option value="alloy">Alloy wheel</option><option value="space-saver">Space saver</option><option value="consumable">Consumable</option></select></label><label className="wide">Description *<input value={editor.description} onChange={(event) => setEditor({ ...editor, description: event.target.value })} /></label><label>Brand<input value={editor.brand} onChange={(event) => setEditor({ ...editor, brand: event.target.value })} /></label><label>Pattern / model<input value={editor.pattern} onChange={(event) => setEditor({ ...editor, pattern: event.target.value })} /></label><label>Size<input value={editor.size} onChange={(event) => setEditor({ ...editor, size: event.target.value.toUpperCase() })} /></label><label>Load / speed<input value={editor.loadSpeed} onChange={(event) => setEditor({ ...editor, loadSpeed: event.target.value.toUpperCase() })} /></label><label>Vehicle type<select value={editor.vehicleType} onChange={(event) => setEditor({ ...editor, vehicleType: event.target.value })}><option value="car">Car</option><option value="suv">SUV / 4x4</option><option value="commercial">Commercial / van</option></select></label><label>Homologation<input value={editor.homologation} onChange={(event) => setEditor({ ...editor, homologation: event.target.value.toUpperCase() })} placeholder="AO, MO, *, N0…" /></label><label>Supplier<input value={editor.supplier} onChange={(event) => setEditor({ ...editor, supplier: event.target.value })} /></label><label>Supplier code<input value={editor.supplierCode} onChange={(event) => setEditor({ ...editor, supplierCode: event.target.value.toUpperCase() })} /></label><label>Cost ex VAT £<input type="number" step=".01" value={editor.costExVat} onChange={(event) => setEditor({ ...editor, costExVat: Number(event.target.value) })} /></label><label>Retail inc VAT £<input type="number" step=".01" value={editor.retailIncVat} onChange={(event) => setEditor({ ...editor, retailIncVat: Number(event.target.value) })} /></label><label>2+ Special inc VAT £<input type="number" step=".01" value={editor.special2PlusIncVat} onChange={(event) => setEditor({ ...editor, special2PlusIncVat: Number(event.target.value) })} /></label><label>Xtra inc VAT £<input type="number" step=".01" value={editor.xtraIncVat} onChange={(event) => setEditor({ ...editor, xtraIncVat: Number(event.target.value) })} /></label><label>Supply inc VAT £<input type="number" step=".01" value={editor.supplyIncVat} onChange={(event) => setEditor({ ...editor, supplyIncVat: Number(event.target.value) })} /></label><label>Opening stock<input type="number" value={editor.stockQty} onChange={(event) => setEditor({ ...editor, stockQty: Number(event.target.value) })} /></label><label>Reorder level<input type="number" value={editor.reorderLevel} onChange={(event) => setEditor({ ...editor, reorderLevel: Number(event.target.value) })} /></label><label className="checkField"><input type="checkbox" checked={editor.runFlat} onChange={(event) => setEditor({ ...editor, runFlat: event.target.checked })} />Run-flat</label><label className="checkField"><input type="checkbox" checked={editor.extraLoad} onChange={(event) => setEditor({ ...editor, extraLoad: event.target.checked })} />Extra Load / XL</label></div><button className="adminPrimaryButton" onClick={() => saveProduct()} disabled={busy === "save"}>{busy === "save" ? "SAVING…" : "SAVE STOCK PRODUCT"}</button></div>}

    {tab === "count" && <div className="adminPanel"><div className="adminEditHeader"><div><h3>Stock count</h3><p>Use the same search and filters in Stock Master, then enter actual quantities here.</p></div><button onClick={() => setTab("stock")}>Open stock filters</button></div><div className="countList">{filtered.map((product) => <div key={product.id}><span><b>{product.sku}</b><small>{product.description}</small></span><strong>System: {Number(product.stockQty || 0)}</strong><input type="number" placeholder="Actual" value={counts[product.id] ?? ""} onChange={(event) => setCounts({ ...counts, [product.id]: event.target.value })} /><button disabled={counts[product.id] === undefined || counts[product.id] === "" || busy === `count-${product.id}`} onClick={() => adjust(product, counts[product.id])}>Post count</button></div>)}{!filtered.length && <div className="stockEmptyPrompt">Search or choose a filter in Stock Master first.</div>}</div></div>}
    {tab === "import" && <div className="adminPanel stockImport"><div className="adminEditHeader"><div><h3>Bulk CSV import</h3><p>Includes Retail, 2+ Special, Xtra and Supply price columns.</p></div>{["owner", "manager"].includes(role) && <button onClick={recalculatePrices} disabled={busy === "recalculate"}>{busy === "recalculate" ? "RECALCULATING…" : "Recalculate all price levels"}</button>}</div><code className="csvHeaders">SKU,Category,Description,Brand,Pattern,Size,Load Speed,Supplier,Supplier Code,Cost Ex VAT,Retail Inc VAT,2+ Special Inc VAT,Xtra Inc VAT,Supply Inc VAT,Stock Qty,Reorder Level,Vehicle Type,Homologation,Runflat,Extra Load,Brand Logo URL</code><label className="vctImport">Choose stock CSV<input type="file" accept=".csv,text/csv" onChange={importCsv} disabled={busy === "import" || !["owner", "manager"].includes(role)} /></label><div className="stockExportControls"><label>Stock CSV category<select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">All stock</option>{["tyre","lawnmower-tyre","tube","wheel-nut","battery","mechanical-part","other","alloy","space-saver"].map((name) => <option key={name} value={name}>{name}</option>)}</select></label><button type="button" onClick={() => exportStock(categoryFilter)}>Export selected stock CSV</button></div>{!["owner", "manager"].includes(role) && <p>Owner or manager access is required for bulk imports.</p>}</div>}
    {tab === "history" && <div className="adminPanel"><h3>Stock movement history</h3><div className="movementList">{movements.map((movement) => <div key={movement.id}><span>{timestamp(movement.createdAt)}</span><b>{movement.sku || movement.productId}</b><span>{movement.description}</span><strong className={Number(movement.change) < 0 ? "negative" : "positive"}>{Number(movement.change) > 0 ? "+" : ""}{Number(movement.change || 0)}</strong><span>{movement.beforeQty} → {movement.afterQty}</span><span>{movement.reason}{movement.reference ? ` · ${movement.reference}` : ""}</span></div>)}{!movements.length && <p>No stock movements yet.</p>}</div></div>}
  </section>;
}
