import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AdminLayout from "./components/AdminLayout";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import Calendar from "./pages/Calendar";
import Tyres from "./pages/Tyres";
import PagesEditor from "./pages/PagesEditor";
import Settings from "./pages/Settings";
import VctCommerce from "./pages/VctCommerce";
import PricingControl from "./pages/PricingControl";
import Sales from "./pages/Sales";
import Login from "./pages/Login";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import RequireAuth from "./auth/RequireAuth";
import Users from "./pages/Users";
import LegacyImport from "./pages/LegacyImport";
import Directory from "./pages/Directory";
import TyreForeman from "./pages/TyreForeman";
import WorkshopBoard from "./pages/WorkshopBoard";

function AdminHome() {
  const { role } = useAuth();
  if (role === "tyre-foreman") return <Navigate to="/tyre-foreman" replace />;
  return role === "service-manager" ? <Navigate to="/workshop-screen" replace /> : <RequireAuth permission="dashboard"><Dashboard /></RequireAuth>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
       <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/tyre-bay-screen" element={<RequireAuth permission="tyreForeman"><TyreForeman screen /></RequireAuth>} />
        <Route path="/workshop-screen" element={<RequireAuth permission="workshop"><WorkshopBoard screen /></RequireAuth>} />
        <Route path="/" element={<RequireAuth><AdminLayout /></RequireAuth>}>
          <Route index element={<AdminHome />} />
          <Route path="tyre-foreman" element={<RequireAuth permission="tyreForeman"><TyreForeman /></RequireAuth>} />
          <Route path="workshop" element={<RequireAuth permission="workshop"><WorkshopBoard /></RequireAuth>} />
          <Route path="orders" element={<RequireAuth permission="jobs"><Orders /></RequireAuth>} />
          <Route path="calendar" element={<RequireAuth permission="calendar"><Calendar /></RequireAuth>} />
          <Route path="tyres" element={<RequireAuth permission="stock"><Tyres /></RequireAuth>} />
          <Route path="services" element={<Navigate to="/pricing-control" replace />} />
          <Route path="sales" element={<RequireAuth permission="sales"><Sales /></RequireAuth>} />
          <Route path="directory" element={<RequireAuth permission="sales"><Directory /></RequireAuth>} />
          <Route path="legacy-import" element={<RequireAuth permission="sales"><LegacyImport /></RequireAuth>} />
          <Route path="pages" element={<RequireAuth permission="pages"><PagesEditor /></RequireAuth>} />
          <Route path="settings" element={<RequireAuth permission="settings"><Settings /></RequireAuth>} />
          <Route path="pricing-control" element={<RequireAuth permission="pricing"><PricingControl /></RequireAuth>} />
          <Route path="very-cheap-tyres" element={<RequireAuth permission="vct"><VctCommerce /></RequireAuth>} />
          <Route path="users" element={<RequireAuth permission="users"><Users /></RequireAuth>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
       </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
