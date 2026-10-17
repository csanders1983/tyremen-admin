import '../office.css';
export function Field({
  label,
  children
}) {
  return <label className="ofField"><span>{label}</span>{children}</label>;
}
export function Panel({
  title,
  children,
  actions
}) {
  return <section className="ofPanel"><header><h2>{title}</h2>{actions && <div className="ofActions">{actions}</div>}</header>{children}</section>;
}
export function Toolbar({
  search,
  setSearch,
  archived,
  setArchived,
  children
}) {
  return <div className="ofToolbar"><input aria-label="Search records" type="search" placeholder="Search names, dates, notes or references…" value={search} onChange={e => setSearch(e.target.value)} />{setArchived && <label className="ofCheck"><input type="checkbox" checked={archived} onChange={e => setArchived(e.target.checked)} /> Include archived</label>}{children}</div>;
}
export function Modal({
  title,
  children,
  close
}) {
  return <div className="ofModal" onMouseDown={e => {
    if (e.target === e.currentTarget) close();
  }}><section role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button type="button" onClick={close}>Close</button></header>{children}</section></div>;
}
export function Empty({
  children = 'No matching records.'
}) {
  return <p className="ofEmpty">{children}</p>;
}
export function Table({
  headings,
  rows
}) {
  return <div className="ofTable"><table><thead><tr>{headings.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows}</tbody></table>{!rows.length && <Empty />}</div>;
}
