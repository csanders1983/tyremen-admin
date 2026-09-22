import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AdminLayout from "./components/AdminLayout";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import Calendar from "./pages/Calendar";
import Tyres from "./pages/Tyres";
import Services from "./pages/Services";
import PagesEditor from "./pages/PagesEditor";
import Settings from "./pages/Settings";
import VctCommerce from "./pages/VctCommerce";
import PricingControl from "./pages/PricingControl";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="orders" element={<Orders />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="tyres" element={<Tyres />} />
          <Route path="services" element={<Services />} />
          <Route path="pages" element={<PagesEditor />} />
          <Route path="settings" element={<Settings />} />
          <Route path="pricing-control" element={<PricingControl />} />
          <Route path="very-cheap-tyres" element={<VctCommerce />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
