const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
const cors = require("cors")({ origin: true });

admin.initializeApp();

const db = admin.firestore();

const API_KEY = process.env.VDG_API_KEY;

const VEHICLE_PACKAGE = "VehicleDetailsWithImage";
const TYRE_PACKAGE = "TyreDetails";
const MOT_PACKAGE = "MotHistoryDetails";

/* ==========================================================================
   VEHICLE LOOKUP
   ========================================================================== */

exports.vehicleLookup = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).send("");
  }

  try {
    const vrm = String(req.query.vrm || "")
      .toUpperCase()
      .replace(/\s/g, "");

    if (!vrm) {
      return res.status(400).json({
        success: false,
        error: "Missing VRM",
      });
    }

    if (!API_KEY) {
      return res.status(500).json({
        success: false,
        error: "Missing VDG_API_KEY environment variable",
      });
    }

    const cached = await db.collection("vehicleCache").doc(vrm).get();

    if (cached.exists) {
      return res.json({
        success: true,
        cached: true,
        vehicle: cached.data(),
      });
    }

    const vehicleUrl =
      "https://uk.api.vehicledataglobal.com/r2/lookup" +
      `?apiKey=${encodeURIComponent(API_KEY)}` +
      `&packageName=${encodeURIComponent(VEHICLE_PACKAGE)}` +
      `&vrm=${encodeURIComponent(vrm)}`;

    const tyreUrl =
      "https://uk.api.vehicledataglobal.com/r2/lookup" +
      `?apiKey=${encodeURIComponent(API_KEY)}` +
      `&packageName=${encodeURIComponent(TYRE_PACKAGE)}` +
      `&vrm=${encodeURIComponent(vrm)}`;

    const motUrl =
      "https://uk.api.vehicledataglobal.com/r2/lookup" +
      `?apiKey=${encodeURIComponent(API_KEY)}` +
      `&packageName=${encodeURIComponent(MOT_PACKAGE)}` +
      `&vrm=${encodeURIComponent(vrm)}`;

    const [vehicleRes, tyreRes, motRes] = await Promise.all([
      fetch(vehicleUrl),
      fetch(tyreUrl),
      fetch(motUrl),
    ]);

    const [data, tyreData, motData] = await Promise.all([
      vehicleRes.json(),
      tyreRes.json(),
      motRes.json(),
    ]);

    if (!vehicleRes.ok || !data.ResponseInformation?.IsSuccessStatusCode) {
      return res.status(vehicleRes.status || 400).json({
        success: false,
        error:
          data.ResponseInformation?.StatusMessage ||
          "Vehicle lookup failed",
      });
    }

    const tyreDetailsList =
      tyreData.Results?.TyreDetails?.TyreDetailsList ||
      tyreData.Results?.TyreDetails?.tyreDetailsList ||
      tyreData.Results?.tyreDetails?.TyreDetailsList ||
      tyreData.Results?.tyreDetails?.tyreDetailsList ||
      [];

    const firstStandard =
      tyreDetailsList.find((item) => item.IsStandardFitmentForVehicle) ||
      tyreDetailsList.find((item) => item.isStandardFitmentForVehicle) ||
      tyreDetailsList[0] ||
      null;

    const frontTyre =
      firstStandard?.Front?.Tyre ||
      firstStandard?.front?.tyre ||
      null;

    const rearTyre =
      firstStandard?.Rear?.Tyre ||
      firstStandard?.rear?.tyre ||
      null;

    const frontSize =
      frontTyre?.SizeDescription ||
      frontTyre?.sizeDescription ||
      "";

    const rearSize =
      rearTyre?.SizeDescription ||
      rearTyre?.sizeDescription ||
      "";

    const tyreSize = frontSize || rearSize || "";

    const engineCC =
      data.Results?.VehicleDetails?.DvlaTechnicalDetails?.EngineCapacityCc ||
      data.Results?.vehicleDetails?.dvlaTechnicalDetails?.engineCapacityCc ||
      data.Results?.ModelDetails?.Powertrain?.IceDetails?.EngineCapacityCc ||
      data.Results?.modelDetails?.powertrain?.iceDetails?.engineCapacityCc ||
      null;

    const engineLitres =
      data.Results?.ModelDetails?.Powertrain?.IceDetails?.EngineCapacityLitres ||
      data.Results?.modelDetails?.powertrain?.iceDetails?.engineCapacityLitres ||
      null;

    const grossWeightKg =
      data.Results?.VehicleDetails?.DvlaTechnicalDetails?.GrossWeightKg ||
      data.Results?.vehicleDetails?.dvlaTechnicalDetails?.grossWeightKg ||
      data.Results?.ModelDetails?.Weights?.GrossVehicleWeightKg ||
      data.Results?.modelDetails?.weights?.grossVehicleWeightKg ||
      null;

    const image =
      data.Results?.VehicleImageDetails?.VehicleImageList?.[0]?.ImageUrl ||
      data.Results?.VehicleImageDetails?.vehicleImageList?.[0]?.imageUrl ||
      data.Results?.vehicleImageDetails?.VehicleImageList?.[0]?.ImageUrl ||
      data.Results?.vehicleImageDetails?.vehicleImageList?.[0]?.imageUrl ||
      null;

    const vehicle = {
      vrm,

      make:
        data.Results?.ModelDetails?.ModelIdentification?.Make ||
        data.Results?.modelDetails?.modelIdentification?.make ||
        data.Results?.VehicleDetails?.VehicleIdentification?.DvlaMake ||
        data.Results?.vehicleDetails?.vehicleIdentification?.dvlaMake ||
        "",

      model:
        data.Results?.ModelDetails?.ModelIdentification?.Model ||
        data.Results?.modelDetails?.modelIdentification?.model ||
        data.Results?.VehicleDetails?.VehicleIdentification?.DvlaModel ||
        data.Results?.vehicleDetails?.vehicleIdentification?.dvlaModel ||
        "",

      year:
        data.Results?.VehicleDetails?.VehicleIdentification?.YearOfManufacture ||
        data.Results?.vehicleDetails?.vehicleIdentification?.yearOfManufacture ||
        "",

      fuel:
        data.Results?.ModelDetails?.Powertrain?.FuelType ||
        data.Results?.modelDetails?.powertrain?.fuelType ||
        data.Results?.VehicleDetails?.VehicleIdentification?.DvlaFuelType ||
        data.Results?.vehicleDetails?.vehicleIdentification?.dvlaFuelType ||
        "",

      body:
        data.Results?.ModelDetails?.BodyDetails?.BodyStyle ||
        data.Results?.modelDetails?.bodyDetails?.bodyStyle ||
        data.Results?.VehicleDetails?.VehicleIdentification?.DvlaBodyType ||
        data.Results?.vehicleDetails?.vehicleIdentification?.dvlaBodyType ||
        "",

      colour:
        data.Results?.VehicleDetails?.VehicleHistory?.ColourDetails
          ?.CurrentColour ||
        data.Results?.vehicleDetails?.vehicleHistory?.colourDetails
          ?.currentColour ||
        "",

      motDue:
        motData?.Results?.MotHistoryDetails?.MotDueDate ||
        motData?.Results?.MotHistoryDetails?.motDueDate ||
        motData?.Results?.motHistoryDetails?.MotDueDate ||
        motData?.Results?.motHistoryDetails?.motDueDate ||
        motData?.results?.MotHistoryDetails?.MotDueDate ||
        motData?.results?.MotHistoryDetails?.motDueDate ||
        motData?.results?.motHistoryDetails?.MotDueDate ||
        motData?.results?.motHistoryDetails?.motDueDate ||
        null,

      motMileage:
        motData?.Results?.MotHistoryDetails?.MotTestDetailsList?.[0]
          ?.OdometerReading ||
        motData?.Results?.motHistoryDetails?.motTestDetailsList?.[0]
          ?.odometerReading ||
        motData?.results?.motHistoryDetails?.motTestDetailsList?.[0]
          ?.odometerReading ||
        null,

      motAdvisories:
        motData?.Results?.MotHistoryDetails?.MotTestDetailsList?.[0]
          ?.AnnotationList ||
        motData?.Results?.MotHistoryDetails?.motTestDetailsList?.[0]
          ?.annotationList ||
        motData?.results?.motHistoryDetails?.motTestDetailsList?.[0]
          ?.annotationList ||
        [],

      image,

      engineCC: engineCC ? Number(engineCC) : null,
      engineLitres: engineLitres ? Number(engineLitres) : null,
      grossWeightKg: grossWeightKg ? Number(grossWeightKg) : null,

      tyreSize,
      frontTyreSize: frontSize,
      rearTyreSize: rearSize,
      tyreDetails: tyreDetailsList,
    };

    await db.collection("vehicleCache").doc(vrm).set(vehicle);

    return res.json({
      success: true,
      cached: false,
      vehicle,
    });
  } catch (err) {
    console.error("VEHICLE LOOKUP ERROR:", err);

    return res.status(500).json({
      success: false,
      error: "Server error",
      message: err.message,
    });
  }
});

/* ==========================================================================
   MIDAS
   Current tyre endpoint: /api/ProductSearch_CachedV2
   ========================================================================== */

const MIDAS_BASE_URL =
  process.env.MIDAS_BASE_URL ||
  "https://api.thevirtualwarehouse.co.uk";

const MIDAS_USERNAME = process.env.MIDAS_USERNAME;
const MIDAS_PASSWORD = process.env.MIDAS_PASSWORD;
const MIDAS_API_KEY = process.env.MIDAS_API_KEY;
const MIDAS_SITE_ID = Number(process.env.MIDAS_SITE_ID || 3025);

const MIDAS_TOKEN_TTL_MS = 50 * 60 * 1000;
const MIDAS_SEARCH_TTL_MS = 5 * 60 * 1000;

let midasTokenCache = {
  token: null,
  expiresAt: 0,
};

const midasSearchCache = new Map();

// MIDAS uses this only to identify a browser/search session. The official
// client falls back to a random 1-10000 value when no web user ID is present.
const MIDAS_WEB_USER_ID = Math.floor(Math.random() * 10000) + 1;

function buildMidasSizeSearchParams(width, profile, rim, speed = "") {
  return {
    webUserId: MIDAS_WEB_USER_ID,
    key1: width,
    key2: profile,
    key3: rim,
    key4: speed,
    key5: "",
    Fsize: "",
    Rsize: "",
    grp: "",
    grplike: "",
    sectionId: "",
    sectionId2: "",
    sectionId3: "",
    includeAddOns: false,
    includeVat: false,
    finalNetPriceMultiplier: "",
    legacyCartMode: false,
    webCacheLastUpdateTime: "",
    searchTimeout: "",
    hideZeroStock: false,
    hideZeroPrice: false,
    startRow: "",
    endRow: "",
    manId: "",
    loadIndex: "",
    treadPattern: "",
    runFlat: "",
    extraLoad: "",
    tyreType: "",
    orderBy: "",
    cusCode: "",
    siteId: MIDAS_SITE_ID,
  };
}

function assertMidasConfig() {
  const missing = [];

  if (!MIDAS_USERNAME) missing.push("MIDAS_USERNAME");
  if (!MIDAS_PASSWORD) missing.push("MIDAS_PASSWORD");
  if (!MIDAS_API_KEY) missing.push("MIDAS_API_KEY");

  if (missing.length > 0) {
    throw new Error(
      `Missing MIDAS environment variables: ${missing.join(", ")}`
    );
  }
}

function extractMidasToken(data) {
  if (typeof data === "string" && data.trim()) {
    const value = data.trim();

    if (
      /another device|log-in anyway|login anyway|already logged in/i.test(
        value
      )
    ) {
      return null;
    }

    return value;
  }

  return (
    data?.token ||
    data?.Token ||
    data?.accessToken ||
    data?.AccessToken ||
    null
  );
}

function getMidasLoginError(data) {
  if (typeof data === "string") return data;

  return (
    data?.Error ||
    data?.error ||
    data?.Message ||
    data?.message ||
    ""
  );
}

function isMidasSessionConflict(value) {
  const message = getMidasLoginError(value).toLowerCase();

  return (
    message.includes("another device") ||
    message.includes("log-in anyway") ||
    message.includes("login anyway") ||
    message.includes("already logged in")
  );
}

async function requestMidasToken(forceLogin = false) {
  return axios.post(
    `${MIDAS_BASE_URL}/api/GetLoginToken`,
    {
      username: MIDAS_USERNAME,
      password: MIDAS_PASSWORD,
      apiKey: MIDAS_API_KEY,
      forceLogin,
    },
    {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      timeout: 15000,
    }
  );
}

async function getMidasToken(forceRefresh = false, forceLogin = false) {
  assertMidasConfig();

  const now = Date.now();

  if (
    !forceRefresh &&
    midasTokenCache.token &&
    midasTokenCache.expiresAt > now
  ) {
    return midasTokenCache.token;
  }

  let loginResponse;

  try {
    loginResponse = await requestMidasToken(forceLogin);
  } catch (err) {
    if (forceLogin || !isMidasSessionConflict(err.response?.data)) throw err;

    console.warn("MIDAS session conflict detected; requesting takeover.");
    loginResponse = await requestMidasToken(true);
  }

  if (
    !extractMidasToken(loginResponse.data) &&
    isMidasSessionConflict(loginResponse.data) &&
    !forceLogin
  ) {
    console.warn("MIDAS session conflict returned with HTTP 200; requesting takeover.");
    loginResponse = await requestMidasToken(true);
  }

  const token = extractMidasToken(loginResponse.data);

  if (!token) {
    const loginError = getMidasLoginError(loginResponse.data);

    throw new Error(
      loginError || "MIDAS login succeeded but returned no token"
    );
  }

  midasTokenCache = {
    token,
    expiresAt: now + MIDAS_TOKEN_TTL_MS,
  };

  return token;
}

function clearMidasToken() {
  midasTokenCache = {
    token: null,
    expiresAt: 0,
  };
}

async function midasGet(path, params = {}, allowRetry = true) {
  const token = await getMidasToken();

  try {
    return await axios.get(`${MIDAS_BASE_URL}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "User-Agent": "TyremenWebsite/1.0",
      },
      params,
      timeout: 15000,
    });
  } catch (err) {
    const sessionConflict = isMidasSessionConflict(err.response?.data);
    const shouldRefreshSession =
      err.response?.status === 401 ||
      err.response?.status === 409 ||
      sessionConflict;

    if (allowRetry && shouldRefreshSession) {
      clearMidasToken();
      console.warn(
        "MIDAS request session rejected; forcing login and retrying once."
      );
      const freshToken = await getMidasToken(true, true);

      return axios.get(`${MIDAS_BASE_URL}${path}`, {
        headers: {
          Authorization: `Bearer ${freshToken}`,
          Accept: "application/json",
          "User-Agent": "TyremenWebsite/1.0",
        },
        params,
        timeout: 15000,
      });
    }

    throw err;
  }
}

function seasonName(value) {
  const season = String(value || "").toUpperCase();

  if (season === "S") return "Summer";
  if (season === "W") return "Winter";
  if (season === "A" || season === "AS") return "All Season";

  return "Summer";
}

function stockStatus(localQty, depotQty) {
  if (localQty > 0) return "Available Today";
  if (depotQty > 0) return "Available Next Working Day";
  return "Check Availability";
}

function numberFrom(record, keys) {
  for (const key of keys) {
    const value = record?.[key];

    if (value !== undefined && value !== null && value !== "") {
      const parsed = Number(value);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return 0;
}

const DEFAULT_TYRE_PRICING = {
  vatPercent: 20,
  websiteDiscountPercent: 0,
  roundingMode: "ceilPound",
  markupBands: [
    { upTo: 30, markup: 30 },
    { upTo: 50, markup: 33 },
    { upTo: 100, markup: 38 },
    { upTo: 999999, markup: 43 },
  ],
};

async function getTyrePricingRules() {
  const snapshot = await db.collection("pricingControl").doc("tyres").get();
  const stored = snapshot.exists ? snapshot.data() : {};

  return {
    ...DEFAULT_TYRE_PRICING,
    ...stored,
    markupBands:
      Array.isArray(stored.markupBands) && stored.markupBands.length
        ? stored.markupBands
        : DEFAULT_TYRE_PRICING.markupBands,
  };
}

function calculateTyrePrice(cost, rules) {
  const band = [...rules.markupBands]
    .sort((a, b) => Number(a.upTo) - Number(b.upTo))
    .find((item) => cost <= Number(item.upTo));
  const markup = Number(band?.markup || 0);
  const calculated = (cost + markup) * (1 + Number(rules.vatPercent || 0) / 100);
  const original = rules.roundingMode === "ceilPound" ? Math.ceil(calculated) : calculated;
  const retail = original * (1 - Number(rules.websiteDiscountPercent || 0) / 100);

  return {
    original: Number(original.toFixed(2)),
    retail: Number(retail.toFixed(2)),
    saving: Number((original - retail).toFixed(2)),
  };
}

function mapMidasTyre(tyre, width, profile, rim, speed, pricingRules) {
  const qty = numberFrom(tyre, [
    "qty",
    "Qty",
    "quantity",
    "Quantity",
    "stockQty",
  ]);

  const depotQty = numberFrom(tyre, [
    "depotsQty",
    "DepotsQty",
    "depotQty",
    "networkQty",
  ]);

  const cost = numberFrom(tyre, [
    "cost",
    "Cost",
    "price",
    "Price",
  ]);

  const noiseDb =
    tyre.noiseDb ??
    tyre.NoiseDb ??
    tyre.noiseDB ??
    "";

  return {
    id: tyre.objId ?? tyre.ObjId ?? tyre.id ?? null,
    code: tyre.code ?? tyre.Code ?? "",

    brand:
      tyre.manName ??
      tyre.ManName ??
      tyre.brand ??
      tyre.Brand ??
      "",

    pattern:
      tyre.treadPattern ??
      tyre.TreadPattern ??
      tyre.pattern ??
      tyre.Pattern ??
      tyre.longdescr ??
      tyre.LongDescr ??
      tyre.descr ??
      tyre.Description ??
      "",

    size: `${tyre.key1 ?? width}/${tyre.key2 ?? profile} R${
      tyre.key3 ?? rim
    }`,

    loadSpeed:
      tyre.loadIndex ??
      tyre.LoadIndex ??
      "",

    speedRating:
      tyre.key4 ??
      tyre.SpeedRating ??
      speed ??
      "",

    season: seasonName(tyre.season ?? tyre.Season),

    runFlat:
      String(tyre.runFlat ?? tyre.RunFlat ?? "").toUpperCase() === "Y",

    extraLoad:
      String(tyre.extraLoad ?? tyre.ExtraLoad ?? "").toUpperCase() === "Y",

    labels: {
      fuel:
        tyre.rrc_grade ??
        tyre.RrcGrade ??
        "",

      wetGrip:
        tyre.wetGrip_grade ??
        tyre.WetGripGrade ??
        "",

      noise: noiseDb !== "" ? `${noiseDb} dB` : "",
    },

    stock: {
      available: qty,
      network: depotQty,
      status: stockStatus(qty, depotQty),
    },

    _hasValidCost: cost > 0,
    pricing: calculateTyrePrice(cost, pricingRules),

    images: {
      tyre:
        tyre.productImagePath ??
        tyre.ProductImagePath ??
        "",

      brand:
        tyre.brandLogoPath ??
        tyre.BrandLogoPath ??
        "",
    },
  };
}

/* ==========================================================================
   MIDAS TEST LOGIN
   ========================================================================== */

exports.testMidasLogin = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    try {
      const token = await getMidasToken();

      return res.json({
        success: true,
        message: "MIDAS login worked",
        tokenPreview: `${String(token).substring(0, 20)}...`,
        siteId: MIDAS_SITE_ID,
      });
    } catch (err) {
      console.error(
        "MIDAS LOGIN ERROR:",
        err.response?.data || err.message
      );

      return res.status(err.response?.status || 500).json({
        success: false,
        error: "MIDAS login failed",
        details: err.response?.data || err.message,
      });
    }
  });
});

/* ==========================================================================
   MIDAS SITES
   ========================================================================== */

exports.midasSites = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    try {
      const response = await midasGet("/api/GetCusSiteDetails");

      return res.json({
        success: true,
        sites: response.data,
      });
    } catch (err) {
      console.error(
        "MIDAS SITE ERROR:",
        err.response?.data || err.message
      );

      return res.status(err.response?.status || 500).json({
        success: false,
        error: "MIDAS site lookup failed",
        details: err.response?.data || err.message,
      });
    }
  });
});

/* ==========================================================================
   MIDAS ENDPOINT TEST
   ========================================================================== */

exports.midasEndpointTest = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    const endpoints = [
      "/api/ProductSearch_CachedV2",
      "/api/GetCusSiteDetails",
      "/api/GetProductGroups",
    ];

    const results = [];

    for (const endpoint of endpoints) {
      try {
        const params =
          endpoint === "/api/ProductSearch_CachedV2"
            ? buildMidasSizeSearchParams("205", "55", "16")
            : {};

        const response = await midasGet(endpoint, params);

        results.push({
          endpoint,
          success: true,
          status: response.status,
          sample: response.data,
        });
      } catch (err) {
        results.push({
          endpoint,
          success: false,
          status: err.response?.status || null,
          error: err.response?.data || err.message,
        });
      }
    }

    return res.json(results);
  });
});

/* ==========================================================================
   MIDAS TYRE SEARCH
   ========================================================================== */

exports.midasTyreSearch = functions.https.onRequest(
  { maxInstances: 1, timeoutSeconds: 30 },
  (req, res) => {
  cors(req, res, async () => {
    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    try {
      const width = String(
        req.body?.width || req.query.width || ""
      ).trim();

      const profile = String(
        req.body?.profile || req.query.profile || ""
      ).trim();

      const rim = String(
        req.body?.rim || req.query.rim || ""
      ).trim();

      const speed = String(
        req.body?.speed || req.query.speed || ""
      ).trim();

      if (!width || !profile || !rim) {
        return res.status(400).json({
          success: false,
          error: "width, profile and rim are required",
        });
      }

      const pricingRules = await getTyrePricingRules();
      const rulesVersion = String(pricingRules.updatedAt || JSON.stringify(pricingRules));
      const cacheKey = `${width}-${profile}-${rim}-${speed || "ANY"}-${rulesVersion}`;
      const cached = midasSearchCache.get(cacheKey);

      if (cached && cached.expiresAt > Date.now()) {
        res.set("Cache-Control", "public, max-age=60, s-maxage=300");

        return res.status(200).json({
          ...cached.payload,
          cached: true,
        });
      }

      console.log("MIDAS SEARCH:", `${width}/${profile}R${rim}`);

      const response = await midasGet(
        "/api/ProductSearch_CachedV2",
        buildMidasSizeSearchParams(width, profile, rim, speed)
      );

      const responseData = response.data;

      const rawList = Array.isArray(responseData)
        ? responseData
        : responseData?.tyres ||
          responseData?.results ||
          responseData?.Results ||
          responseData?.data ||
          [];

      if (!Array.isArray(rawList)) {
        throw new Error(
          "MIDAS ProductSearch_CachedV2 returned an unexpected response"
        );
      }

      const cleanTyres = rawList
        .map((tyre) =>
          mapMidasTyre(tyre, width, profile, rim, speed, pricingRules)
        )
        .filter(
          (tyre) =>
            tyre._hasValidCost &&
            (tyre.stock.available > 0 || tyre.stock.network > 0)
        )
        .map(({ _hasValidCost, ...tyre }) => tyre)
        .sort((a, b) => a.pricing.retail - b.pricing.retail);

      const payload = {
        success: true,
        status: response.status,
        cached: false,
        search: {
          size: `${width}/${profile}R${rim}`,
          count: cleanTyres.length,
          rawCount: rawList.length,
          siteId: MIDAS_SITE_ID,
        },
        tyres: cleanTyres,
      };

      midasSearchCache.set(cacheKey, {
        payload,
        expiresAt: Date.now() + MIDAS_SEARCH_TTL_MS,
      });

      if (midasSearchCache.size > 250) {
        const now = Date.now();

        for (const [key, value] of midasSearchCache.entries()) {
          if (value.expiresAt <= now) {
            midasSearchCache.delete(key);
          }
        }

        if (midasSearchCache.size > 250) {
          const oldestKey = midasSearchCache.keys().next().value;

          if (oldestKey) {
            midasSearchCache.delete(oldestKey);
          }
        }
      }

      res.set("Cache-Control", "public, max-age=60, s-maxage=300");

      return res.status(200).json(payload);
    } catch (err) {
      console.error("MIDAS TYRE SEARCH ERROR:", {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data,
      });

      return res.status(err.response?.status || 500).json({
        success: false,
        error: "MIDAS tyre search failed",
        details: err.response?.data || err.message,
      });
    }
  });
});

/* ==========================================================================
   PUBLIC BASKET QUOTE
   Offer maths stays on the server; the browser receives totals only.
   ========================================================================== */

exports.calculateBasketPricing = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method === "OPTIONS") return res.status(204).send("");

    try {
      const items = Array.isArray(req.body?.items) ? req.body.items : [];
      const offerSnapshot = await db.collection("pricingControl").doc("offers").get();
      const offers = offerSnapshot.exists ? offerSnapshot.data() : {};
      const tyreOffer = offers.buyTwoTyres || {};
      const tyreQuantity = items
        .filter((item) => item.type === "tyre")
        .reduce((sum, item) => sum + Number(item.qty || item.quantity || 1), 0);
      const subtotal = items.reduce(
        (sum, item) =>
          sum + Number(item.price || 0) * Number(item.qty || item.quantity || 1),
        0
      );
      const tyreSubtotal = items
        .filter((item) => item.type === "tyre")
        .reduce(
          (sum, item) =>
            sum + Number(item.price || 0) * Number(item.qty || item.quantity || 1),
          0
        );
      const qualifies =
        tyreOffer.active === true &&
        tyreQuantity >= Number(tyreOffer.minimumQuantity || 2);
      const tyreDiscount = !qualifies
        ? 0
        : tyreOffer.discountType === "fixedPerTyre"
        ? tyreQuantity * Number(tyreOffer.discountAmount || 0)
        : tyreSubtotal * (Number(tyreOffer.discountPercent || 0) / 100);

      const itemText = (item) =>
        [item.name, item.service, item.category, item.serviceKey, item.type]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
      const motItem = items.find((item) => /\bmot\b/.test(itemText(item)));
      const qualifyingService = items.find((item) =>
        /(oil|interim|full service|major service|servicing)/.test(itemText(item))
      );
      const serviceMotOffer = offers.serviceMot || {};
      const serviceMotQualifies =
        serviceMotOffer.active === true && Boolean(motItem && qualifyingService);
      const motLineTotal = motItem
        ? Number(motItem.price || 0) * Number(motItem.qty || motItem.quantity || 1)
        : 0;
      const motOfferPrice = Number(serviceMotOffer.addOnPrice || 0);
      const serviceMotDiscount = serviceMotQualifies
        ? Math.max(0, motLineTotal - motOfferPrice)
        : 0;
      const discount = tyreDiscount + serviceMotDiscount;
      const appliedOffers = [
        ...(qualifies
          ? [tyreOffer.headline || "Tyre multi-buy offer"]
          : []),
        ...(serviceMotQualifies
          ? [serviceMotOffer.headline || "Service + MOT offer"]
          : []),
      ];

      return res.status(200).json({
        success: true,
        subtotal: Number(subtotal.toFixed(2)),
        discount: Number(discount.toFixed(2)),
        total: Number((subtotal - discount).toFixed(2)),
        offer: appliedOffers.length
          ? {
              applied: true,
              label: appliedOffers.join(" + "),
            }
          : { applied: false },
        discounts: {
          tyres: Number(tyreDiscount.toFixed(2)),
          serviceMot: Number(serviceMotDiscount.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("BASKET PRICING ERROR", error);
      return res.status(500).json({ success: false, error: "Unable to price basket" });
    }
  });
});

/* ========================================================================== 
   WORKSHOP BOOKING
   Capacity rules stay server-side. Public availability never exposes customer
   details, and booking creation re-checks the slot inside a transaction.
   ========================================================================== */

const WORKSHOP_HOURS = [
  "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00",
];

const DAILY_CAPACITY = {
  timing: 2,
  clutch: 4,
  airconR134a: 8,
  airconR1234yf: 8,
  brakes: 6,
};

function normaliseBookingItems(items) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    ...item,
    qty: Math.max(1, Number(item.qty || item.quantity || 1)),
  }));
}

function bookingText(jobOrItem) {
  return [
    jobOrItem?.name,
    jobOrItem?.service,
    jobOrItem?.serviceName,
    jobOrItem?.category,
    jobOrItem?.serviceKey,
    jobOrItem?.type,
    jobOrItem?.gasType,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function classifyBooking(items, job = {}) {
  const records = [job, ...normaliseBookingItems(items)];
  const text = records.map(bookingText).join(" ");
  const hasAircon = /(air\s*con|air conditioning|regas|re-gas)/.test(text);
  const explicitService = records.some((record) =>
    ["service", "servicing"].includes(
      String(record?.category || record?.serviceKey || "").toLowerCase()
    )
  );

  return {
    mot: /\bmot\b/.test(text),
    service: explicitService || /(oil\s*(and|&)?\s*filter|interim|full service|major service|servicing)/.test(text),
    tyres: /\btyres?\b/.test(text),
    alignment: /(wheel alignment|tracking)/.test(text),
    diagnostics: /diagnostic/.test(text),
    timing: /(cambelt|cam belt|timing belt|timing chain)/.test(text),
    clutch: /clutch/.test(text),
    brakes: /brake/.test(text),
    airconR1234yf: hasAircon && /(1234|new gas|r1234yf)/.test(text),
    airconR134a: hasAircon && !/(1234|new gas|r1234yf)/.test(text),
  };
}

function shiftHour(time, amount) {
  const index = WORKSHOP_HOURS.indexOf(time);
  return index < 0 ? null : WORKSHOP_HOURS[index + amount] || null;
}

function buildAllocations(items, time, job = {}) {
  const needs = classifyBooking(items, job);
  const allocations = [];
  let arrivalTime = time;

  if (needs.mot) allocations.push({ resource: "mot", time, units: 1 });
  if (needs.service) {
    const serviceTime = needs.mot ? shiftHour(time, 1) : time;
    allocations.push({ resource: "service", time: serviceTime, units: 1 });
  }
  if (needs.tyres && needs.mot) arrivalTime = shiftHour(time, -1);

  Object.keys(DAILY_CAPACITY).forEach((resource) => {
    if (needs[resource]) allocations.push({ resource, time: null, units: 1 });
  });

  return { needs, allocations, arrivalTime };
}

function activeJob(job) {
  return !["cancelled", "canceled", "deleted"].includes(
    String(job?.status || "").toLowerCase()
  );
}

function jobAllocations(job) {
  if (Array.isArray(job?.schedule?.allocations)) return job.schedule.allocations;
  return buildAllocations(job?.items || job?.tyres || [], job?.time, job).allocations;
}

function availabilityForDay(date, requestedItems, jobs, blocks, closed) {
  const day = new Date(`${date}T12:00:00Z`);
  const isSunday = Number.isNaN(day.getTime()) || day.getUTCDay() === 0;
  const activeJobs = jobs.filter(activeJob);
  const current = activeJobs.flatMap(jobAllocations);
  const requirementsAt = (time) => buildAllocations(requestedItems, time);
  const slots = {};

  WORKSHOP_HOURS.forEach((time) => {
    const requirement = requirementsAt(time);
    let reason = "";
    let remaining = null;

    if (closed || isSunday) reason = closed?.reason || "Workshop closed";
    if (!reason && requirement.needs.mot && requirement.needs.tyres && !requirement.arrivalTime) {
      reason = "Tyres need an earlier arrival time";
    }
    if (!reason && requirement.needs.mot && requirement.needs.service &&
        !requirement.allocations.find((item) => item.resource === "service")?.time) {
      reason = "Service would finish outside workshop hours";
    }

    for (const allocation of requirement.allocations) {
      if (reason) break;
      const capacity = allocation.resource === "mot"
        ? 2
        : allocation.resource === "service"
        ? 2
        : DAILY_CAPACITY[allocation.resource];
      const used = current
        .filter((item) => item.resource === allocation.resource &&
          (allocation.time === null || item.time === allocation.time))
        .reduce((sum, item) => sum + Number(item.units || 1), 0);
      const blocked = blocks
        .filter((item) =>
          (!item.resource || item.resource === "all" || item.resource === allocation.resource) &&
          (allocation.time === null || item.time === allocation.time || !item.time)
        )
        .reduce((sum, item) => sum + Number(item.units || 1), 0);
      const availableUnits = Math.max(0, Number(capacity || 9999) - used - blocked);
      remaining = remaining === null ? availableUnits : Math.min(remaining, availableUnits);
      if (availableUnits < Number(allocation.units || 1)) reason = "Fully booked";
    }

    slots[time] = {
      available: !reason,
      reason,
      remaining: requirement.allocations.length ? remaining : null,
      arrivalTime: requirement.arrivalTime,
      serviceTime: requirement.allocations.find((item) => item.resource === "service")?.time || null,
    };
  });

  return slots;
}

async function loadWorkshopDay(date, transaction = null) {
  const jobsQuery = db.collection("jobs").where("date", "==", date);
  const blocksQuery = db.collection("blockedSlots").where("date", "==", date);
  const closedRef = db.collection("closedDays").doc(date);
  const getter = transaction
    ? (value) => transaction.get(value)
    : (value) => value.get();
  const [jobsSnap, blocksSnap, closedSnap] = await Promise.all([
    getter(jobsQuery), getter(blocksQuery), getter(closedRef),
  ]);
  return {
    jobs: jobsSnap.docs.map((snap) => snap.data()),
    blocks: blocksSnap.docs.map((snap) => snap.data()),
    closed: closedSnap.exists ? closedSnap.data() : null,
  };
}

function nextDate(date, amount = 1) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

async function findAlternativeDates(date, items) {
  const alternatives = [];
  for (let offset = 1; offset <= 45 && alternatives.length < 3; offset += 1) {
    const candidate = nextDate(date, offset);
    const day = await loadWorkshopDay(candidate);
    const slots = availabilityForDay(candidate, items, day.jobs, day.blocks, day.closed);
    const availableTimes = WORKSHOP_HOURS.filter((time) => slots[time].available);
    if (availableTimes.length) alternatives.push({ date: candidate, times: availableTimes });
  }
  return alternatives;
}

exports.workshopAvailability = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method === "OPTIONS") return res.status(204).send("");
    try {
      const date = String(req.body?.date || req.query?.date || "");
      const items = normaliseBookingItems(req.body?.items || []);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ success: false, error: "Valid date required" });
      }
      const day = await loadWorkshopDay(date);
      const slots = availabilityForDay(date, items, day.jobs, day.blocks, day.closed);
      const hasAvailability = WORKSHOP_HOURS.some((time) => slots[time].available);
      const alternatives = hasAvailability ? [] : await findAlternativeDates(date, items);
      return res.json({ success: true, date, hours: WORKSHOP_HOURS, slots, alternatives });
    } catch (error) {
      console.error("WORKSHOP AVAILABILITY ERROR", error);
      return res.status(500).json({ success: false, error: "Availability unavailable" });
    }
  });
});

exports.createWorkshopBooking = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST") return res.status(405).json({ success: false });
    try {
      const payload = req.body || {};
      const date = String(payload.date || "");
      const time = String(payload.time || "");
      const items = normaliseBookingItems(payload.items);
      if (!payload.name || !payload.phone || !payload.registration ||
          !/^\d{4}-\d{2}-\d{2}$/.test(date) || !WORKSHOP_HOURS.includes(time) || !items.length) {
        return res.status(400).json({ success: false, error: "Missing booking details" });
      }

      const jobRef = db.collection("jobs").doc();
      let schedule;
      await db.runTransaction(async (transaction) => {
        const day = await loadWorkshopDay(date, transaction);
        const slots = availabilityForDay(date, items, day.jobs, day.blocks, day.closed);
        if (!slots[time]?.available) {
          const error = new Error(slots[time]?.reason || "Slot no longer available");
          error.code = "slot-full";
          throw error;
        }
        const built = buildAllocations(items, time, payload);
        schedule = {
          appointmentTime: time,
          arrivalTime: built.arrivalTime,
          serviceTime: built.allocations.find((item) => item.resource === "service")?.time || null,
          allocations: built.allocations,
          resources: built.needs,
        };
        transaction.set(jobRef, {
          name: String(payload.name).slice(0, 120),
          phone: String(payload.phone).slice(0, 40),
          email: String(payload.email || "").slice(0, 180),
          registration: String(payload.registration).toUpperCase().replace(/\s+/g, "").slice(0, 12),
          vehicle: payload.vehicle || null,
          service: String(payload.service || "Workshop booking").slice(0, 500),
          serviceKey: String(payload.serviceKey || "booking").slice(0, 80),
          type: String(payload.type || "service").slice(0, 40),
          tyres: items.filter((item) => item.type === "tyre"),
          items,
          date,
          time,
          appointmentTime: time,
          arrivalTime: schedule.arrivalTime,
          price: Number(payload.price || 0),
          total: Number(payload.total || payload.price || 0),
          status: "New",
          source: String(payload.source || "Website").slice(0, 40),
          schedule,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      return res.status(201).json({ success: true, id: jobRef.id, schedule });
    } catch (error) {
      const status = error.code === "slot-full" ? 409 : 500;
      console.error("CREATE WORKSHOP BOOKING ERROR", error);
      return res.status(status).json({
        success: false,
        error: error.message || "Booking could not be created",
      });
    }
  });
});

/* ==========================================================================
   MIDAS PRODUCT GROUPS
   ========================================================================== */

exports.midasProductGroups = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    try {
      const response = await midasGet("/api/GetProductGroups");

      return res.json({
        success: true,
        status: response.status,
        raw: response.data,
      });
    } catch (err) {
      console.error(
        "MIDAS PRODUCT GROUP ERROR:",
        err.response?.data || err.message
      );

      return res.status(err.response?.status || 500).json({
        success: false,
        error: "MIDAS product group lookup failed",
        details: err.response?.data || err.message,
      });
    }
  });
});
