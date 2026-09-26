import { Spinner } from "@fluentui/react-components";
import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ResultPage } from "@/features/order/ResultPage";
import { ShopPage } from "@/features/shop/ShopPage";
import { Shell } from "./Shell";
import { ThemeRoot } from "./theme";

const AdminPage = lazy(() => import("@/features/admin/AdminPage").then((module) => ({ default: module.AdminPage })));

export function App() {
  return (
    <ThemeRoot>
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <Shell>
                <ShopPage />
              </Shell>
            }
          />
          <Route
            path="/zpay"
            element={
              <Shell>
                <ShopPage />
              </Shell>
            }
          />
          <Route
            path="/order/:orderNo"
            element={
              <Shell>
                <ResultPage />
              </Shell>
            }
          />
          <Route
            path="/admin"
            element={
              <Suspense fallback={<Spinner style={{ paddingTop: "30vh" }} label="正在打开管理后台" />}>
                <AdminPage />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeRoot>
  );
}
