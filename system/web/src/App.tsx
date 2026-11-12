import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { MotionConfig } from "motion/react";
import { IconContext } from "@phosphor-icons/react";
import { AppLayout, PublicLayout } from "./components/Layout";
import { SessionProvider } from "./session";
import { LandingPage } from "./pages/Landing";
import { OverviewPage } from "./pages/Overview";
import { ApprovalsPage } from "./pages/Approvals";
import { RunsPage } from "./pages/Runs";
import { EmailPage } from "./pages/Email";
import { CheckPage } from "./pages/Check";
import { ExtensionsPage } from "./pages/Extensions";
import { SettingsPage } from "./pages/Settings";
import { ApprovePublicPage, DeclinePublicPage } from "./pages/PublicLinks";
import { StudentPage, StudentExtensionPage } from "./pages/Student";

function NotFound() {
  return (
    <div className="card">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-sm">This address does not match a CrunchRadar page. If you followed a link from an email, open it again from that email.</p>
      <Link to="/" className="btn-ghost btn-sm mt-4">
        Go to the landing page
      </Link>
    </div>
  );
}

export function App() {
  return (
    <MotionConfig reducedMotion="user">
    <IconContext.Provider value={{ weight: "regular" }}>
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route index element={<LandingPage />} />
          <Route path="app" element={<AppLayout />}>
            <Route index element={<OverviewPage />} />
            <Route path="approvals" element={<ApprovalsPage />} />
            <Route path="runs" element={<RunsPage />} />
            <Route path="email" element={<EmailPage />} />
            <Route path="check" element={<CheckPage />} />
            <Route path="extensions" element={<ExtensionsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route element={<PublicLayout />}>
            <Route path="approve/:token" element={<ApprovePublicPage />} />
            <Route path="lecturer/:token/decline" element={<DeclinePublicPage />} />
            <Route path="student/extension" element={<StudentExtensionPage />} />
          </Route>
          <Route element={<PublicLayout wide />}>
            <Route path="student" element={<StudentPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SessionProvider>
    </IconContext.Provider>
    </MotionConfig>
  );
}
