import "../admin-pages.css";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import SystemIcon from "../components/SystemIcon";
export default function Settings() {
  const { can } = useAuth();
  const options = [["users","people","Staff access","Manage staff accounts and access levels.","/users"],["pricing","pricing","Prices, offers & capacity","Manage selling rules, service prices and booking limits.","/pricing-control"],["workshop","workshop","Workshop notifications","Set the service manager’s email and mobile in Workshop live.","/workshop"],["sales","sales","Customer & vehicle records","Search and maintain customers, accounts and their vehicles.","/directory"],["sales","stock","Import centre","Preview and import legacy system records.","/legacy-import"],["pages","pages","Website content","Manage the public website’s page content.","/pages"]];
  return <section className="adminPage"><div className="adminHero"><span>SYSTEM MANAGEMENT</span><h2>Settings & controls</h2><p>Go straight to the controls used to run Tyremen.</p></div><div className="sysSettingsGrid">{options.filter(([permission]) => can(permission)).map(([,icon,title,text,url]) => <Link to={url} key={title}><SystemIcon name={icon} size={24} /><div><h3>{title}</h3><p>{text}</p></div><SystemIcon name="arrow" size={18} /></Link>)}</div><div className="adminInfoBox">Changes to prices, workshop plans and notification settings are recorded by the system. Use the history in each workspace to review them.</div></section>;
}
