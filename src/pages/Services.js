import "../admin-pages.css";
import { useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase";

const engineBands = [
  { label: "0-1200cc", minCC: 0, maxCC: 1200 },
  { label: "1201cc-1500cc", minCC: 1201, maxCC: 1500 },
  { label: "1501cc-2000cc", minCC: 1501, maxCC: 2000 },
  { label: "2001cc-2400cc", minCC: 2001, maxCC: 2400 },
  { label: "2401cc-3500cc", minCC: 2401, maxCC: 3500 },
  { label: "3501cc-9999cc", minCC: 3501, maxCC: 9999 },
];

const serviceTypes = [
  { key: "oil", label: "Oil & Filter" },
  { key: "interim", label: "Interim Service" },
  { key: "full", label: "Full Service" },
  { key: "major", label: "Major Service" },
];

const motTypes = [
  { key: "class4", label: "Class 4 MOT", description: "Cars, SUVs, small vans" },
  { key: "class7", label: "Class 7 MOT", description: "Larger vans / commercials" },
];

const defaultPrices = {
  oil: [100, 100, 114.17, 114.17, 137.5, 137.5],
  interim: [120, 120, 137, 137, 165, 165],
  full: [155, 155, 175, 175, 210, 210],
  major: [180, 180, 205, 205, 245, 245],
};

const defaultMotPrices = {
  class4: 40,
  class7: 45,
};

const incVat = (exVat) => Number((Number(exVat || 0) * 1.2).toFixed(2));

const makeId = (serviceType, band) =>
  `${serviceType}-${band.minCC}-${band.maxCC}`;

export default function Services() {
  const [matrix, setMatrix] = useState([]);
  const [motPrices, setMotPrices] = useState({});
  const [draftPrices, setDraftPrices] = useState({});
  const [draftMotPrices, setDraftMotPrices] = useState({});
  const [activeType, setActiveType] = useState("oil");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, "servicePricingMatrix"),
      orderBy("serviceType", "asc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const rows = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      setMatrix(rows);

      setDraftPrices((prev) => {
        const next = { ...prev };

        rows.forEach((row) => {
          if (next[row.id] === undefined) {
            next[row.id] = String(row.priceExVat ?? "");
          }
        });

        return next;
      });
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "motPricing"), (snapshot) => {
      const rows = {};

      snapshot.docs.forEach((docSnap) => {
        rows[docSnap.id] = {
          id: docSnap.id,
          ...docSnap.data(),
        };
      });

      setMotPrices(rows);

      setDraftMotPrices((prev) => {
        const next = { ...prev };

        Object.keys(rows).forEach((key) => {
          if (next[key] === undefined) {
            next[key] = String(rows[key].price || "");
          }
        });

        return next;
      });
    });

    return () => unsub();
  }, []);

  const getRow = (serviceType, bandIndex) => {
    const band = engineBands[bandIndex];
    const id = makeId(serviceType, band);

    const found = matrix.find((row) => row.id === id);

    if (found) return found;

    const fallbackExVat = defaultPrices[serviceType]?.[bandIndex] || 0;

    return {
      id,
      serviceType,
      bandLabel: band.label,
      minCC: band.minCC,
      maxCC: band.maxCC,
      priceExVat: fallbackExVat,
      priceIncVat: incVat(fallbackExVat),
    };
  };

  const savePrice = async (serviceType, bandIndex, value) => {
    const band = engineBands[bandIndex];
    const id = makeId(serviceType, band);
    const priceExVat = Number(value || 0);
    const priceIncVat = incVat(priceExVat);

    const updatedRow = {
      id,
      serviceType,
      bandLabel: band.label,
      minCC: band.minCC,
      maxCC: band.maxCC,
      priceExVat,
      priceIncVat,
      updatedAt: new Date().toISOString(),
    };

    setMatrix((prev) => {
      const exists = prev.some((row) => row.id === id);

      if (exists) {
        return prev.map((row) => (row.id === id ? updatedRow : row));
      }

      return [...prev, updatedRow];
    });

    setDraftPrices((prev) => ({
      ...prev,
      [id]: String(priceExVat),
    }));

    setSaving(true);

    await setDoc(doc(db, "servicePricingMatrix", id), updatedRow, {
      merge: true,
    });

    setSaving(false);
  };

  const saveMotPrice = async (motKey, value) => {
    const price = Number(value || 0);

    const row = {
      key: motKey,
      price,
      updatedAt: new Date().toISOString(),
    };

    setMotPrices((prev) => ({
      ...prev,
      [motKey]: {
        id: motKey,
        ...row,
      },
    }));

    setDraftMotPrices((prev) => ({
      ...prev,
      [motKey]: String(price),
    }));

    setSaving(true);

    await setDoc(doc(db, "motPricing", motKey), row, {
      merge: true,
    });

    setSaving(false);
  };

  const activeService = serviceTypes.find((item) => item.key === activeType);

  return (
    <section className="adminPage">
      <div className="adminHero">
        <span>SERVICE MATRIX</span>
        <h2>Service Prices</h2>
        <p>
          Set service prices by engine size and control MOT Class 4 / Class 7
          prices live.
        </p>
      </div>

      <div className="adminStats">
        <div className="adminStat">
          <span>Service Types</span>
          <strong>{serviceTypes.length}</strong>
        </div>

        <div className="adminStat">
          <span>Engine Bands</span>
          <strong>{engineBands.length}</strong>
        </div>

        <div className="adminStat">
          <span>Status</span>
          <strong>{saving ? "Saving" : "Live"}</strong>
        </div>
      </div>

      <div className="adminGrid">
        <div className="adminPanel">
          <h3>Service Type</h3>

          <div className="adminList">
            {serviceTypes.map((service) => (
              <button
                key={service.key}
                type="button"
                className={
                  activeType === service.key ? "adminCard active" : "adminCard"
                }
                onClick={() => setActiveType(service.key)}
              >
                <h4>{service.label}</h4>
                <p>Matrix pricing by engine size</p>
              </button>
            ))}
          </div>

          <div className="adminInfoBox">
            <strong>MOT auto-detect:</strong> The website can recommend Class 7
            when gross weight is over 3000kg. Otherwise it will recommend Class
            4. Customer can still choose manually.
          </div>
        </div>

        <div className="adminPanel">
          <div className="adminEditHeader">
            <div>
              <h3>{activeService?.label}</h3>
              <p>Editable matrix by engine CC range</p>
            </div>
          </div>

          <div className="matrixTable">
            <div className="matrixHead">
              <span>Engine Size</span>
              <span>CC Range</span>
              <span>Sell ex VAT</span>
              <span>Inc VAT</span>
            </div>

            {engineBands.map((band, index) => {
              const row = getRow(activeType, index);
              const draftValue =
                draftPrices[row.id] !== undefined
                  ? draftPrices[row.id]
                  : String(row.priceExVat ?? "");

              const exVat = Number(draftValue || 0);
              const priceIncVat = incVat(exVat);

              return (
                <div className="matrixRow" key={row.id}>
                  <strong>{band.label}</strong>

                  <span>
                    {band.minCC} - {band.maxCC} cc
                  </span>

                  <label className="moneyInput">
                    £
                    <input
                      type="number"
                      value={draftValue}
                      onChange={(e) =>
                        setDraftPrices((prev) => ({
                          ...prev,
                          [row.id]: e.target.value,
                        }))
                      }
                      onBlur={(e) =>
                        savePrice(activeType, index, e.target.value)
                      }
                    />
                  </label>

                  <b>£{priceIncVat.toFixed(2)}</b>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="adminPanel">
        <div className="adminEditHeader">
          <div>
            <h3>MOT Prices</h3>
            <p>Control Class 4 and Class 7 MOT pricing live.</p>
          </div>
        </div>

        <div className="matrixTable motMatrixTable">
          <div className="matrixHead">
            <span>MOT Type</span>
            <span>Typical Vehicles</span>
            <span>Price</span>
            <span>Status</span>
          </div>

          {motTypes.map((mot) => {
            const draftValue =
              draftMotPrices[mot.key] !== undefined
                ? draftMotPrices[mot.key]
                : String(motPrices[mot.key]?.price ?? defaultMotPrices[mot.key]);

            return (
              <div className="matrixRow" key={mot.key}>
                <strong>{mot.label}</strong>

                <span>{mot.description}</span>

                <label className="moneyInput">
                  £
                  <input
                    type="number"
                    value={draftValue}
                    onChange={(e) =>
                      setDraftMotPrices((prev) => ({
                        ...prev,
                        [mot.key]: e.target.value,
                      }))
                    }
                    onBlur={(e) => saveMotPrice(mot.key, e.target.value)}
                  />
                </label>

                <b>Live</b>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}