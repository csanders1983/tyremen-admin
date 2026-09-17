import "../admin-pages.css";
import { useEffect, useState } from "react";
import { collection, onSnapshot, doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

const pageKeys = [
  "home",
  "mot",
  "servicing",
  "brakes",
  "clutch",
  "cambelts",
  "aircon",
  "tyres",
];

export default function PagesEditor() {
  const [pages, setPages] = useState({});
  const [selected, setSelected] = useState("home");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "pages"), (snapshot) => {
      const data = {};

      snapshot.docs.forEach((docSnap) => {
        data[docSnap.id] = docSnap.data();
      });

      setPages(data);
    });

    return () => unsub();
  }, []);

  const current = pages[selected] || {};

  const updateCurrent = (field, value) => {
    setPages({
      ...pages,
      [selected]: {
        ...current,
        [field]: value,
      },
    });
  };

  const savePage = async () => {
    await setDoc(doc(db, "pages", selected), {
      pageKey: selected,
      title: current.title || "",
      description: current.description || "",
      heroTitle: current.heroTitle || "",
      heroText: current.heroText || "",
      seoText: current.seoText || "",
      updatedAt: new Date().toISOString(),
    });

    alert("Page saved.");
  };

  return (
    <section className="page">
      <div className="pageTitleRow">
        <div>
          <h2>Page Editor</h2>
          <p>Edit page titles, descriptions, hero text and SEO content.</p>
        </div>

        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          {pageKeys.map((key) => (
            <option key={key} value={key}>{key}</option>
          ))}
        </select>
      </div>

      <div className="panel">
        <div className="formStack">
          <label>
            Page Title
            <input value={current.title || ""} onChange={(e) => updateCurrent("title", e.target.value)} />
          </label>

          <label>
            Meta Description
            <textarea value={current.description || ""} onChange={(e) => updateCurrent("description", e.target.value)} />
          </label>

          <label>
            Hero Title
            <input value={current.heroTitle || ""} onChange={(e) => updateCurrent("heroTitle", e.target.value)} />
          </label>

          <label>
            Hero Text
            <textarea value={current.heroText || ""} onChange={(e) => updateCurrent("heroText", e.target.value)} />
          </label>

          <label>
            SEO Text
            <textarea value={current.seoText || ""} onChange={(e) => updateCurrent("seoText", e.target.value)} />
          </label>

          <button onClick={savePage}>Save Page</button>
        </div>
      </div>
    </section>
  );
}