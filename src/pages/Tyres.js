import "../admin-pages.css";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function Tyres() {
  const [tyres, setTyres] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "tyres"), (snapshot) => {
      setTyres(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
    });

    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();

    return tyres.filter((tyre) => {
      return [
        tyre.size,
        tyre.brand,
        tyre.pattern,
        tyre.loadIndex,
        tyre.speedRating,
        tyre.runflat,
      ]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [tyres, search]);

  const updateTyre = async (id, field, value) => {
    await updateDoc(doc(db, "tyres", id), {
      [field]: value,
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <section className="page">
      <div className="pageTitleRow">
        <div>
          <h2>Tyre Stock</h2>
          <p>Search and edit live tyre prices used by the website.</p>
        </div>

        <input
          className="searchInput"
          placeholder="Search size, brand, pattern..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="panel">
        <div className="tyreTable">
          <div className="tyreHead">
            <span>Size</span>
            <span>Brand</span>
            <span>Pattern</span>
            <span>Load</span>
            <span>Speed</span>
            <span>Runflat</span>
            <span>Stock</span>
            <span>Price</span>
          </div>

          {filtered.map((tyre) => (
            <div className="tyreRow" key={tyre.id}>
              <input defaultValue={tyre.size || ""} onBlur={(e) => updateTyre(tyre.id, "size", e.target.value)} />
              <input defaultValue={tyre.brand || ""} onBlur={(e) => updateTyre(tyre.id, "brand", e.target.value)} />
              <input defaultValue={tyre.pattern || ""} onBlur={(e) => updateTyre(tyre.id, "pattern", e.target.value)} />
              <input defaultValue={tyre.loadIndex || ""} onBlur={(e) => updateTyre(tyre.id, "loadIndex", e.target.value)} />
              <input defaultValue={tyre.speedRating || ""} onBlur={(e) => updateTyre(tyre.id, "speedRating", e.target.value)} />
              <input defaultValue={tyre.runflat || ""} onBlur={(e) => updateTyre(tyre.id, "runflat", e.target.value)} />
              <input type="number" defaultValue={tyre.stock || 0} onBlur={(e) => updateTyre(tyre.id, "stock", Number(e.target.value))} />
              <input type="number" defaultValue={tyre.price || 0} onBlur={(e) => updateTyre(tyre.id, "price", Number(e.target.value))} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}