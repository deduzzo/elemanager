import { Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { LoginPage } from '@/features/auth/LoginPage';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { HomePage } from '@/pages/HomePage';
import { HomePublicPage } from '@/pages/HomePublicPage';
import { DashboardPublicaPage } from '@/pages/DashboardPublicaPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { AdminLayout } from '@/features/admin/AdminLayout';
import { AdminIndexPage } from '@/features/admin/AdminIndexPage';
import { UsersPage } from '@/features/admin/users/UsersPage';
import { GiornateListPage } from '@/features/admin/giornate/GiornateListPage';
import { GiornataDetailPage } from '@/features/admin/giornate/GiornataDetailPage';
import { SezioniImportPage } from '@/features/admin/sezioni/SezioniImportPage';
import { AuditLogPage } from '@/features/admin/audit/AuditLogPage';
import { PresuntiIndexPage } from '@/features/admin/presunti/PresuntiIndexPage';
import { PresuntoCandidatoPage } from '@/features/admin/presunti/PresuntoCandidatoPage';
import { PresuntoSezionePage } from '@/features/admin/presunti/PresuntoSezionePage';
import { ConfrontoPage } from '@/features/admin/confronto/ConfrontoPage';
import { CandidatoDrillDown } from '@/features/admin/confronto/CandidatoDrillDown';
import { SezioneDrillDown } from '@/features/admin/confronto/SezioneDrillDown';
import { ProiezioniPage } from '@/features/admin/proiezioni/ProiezioniPage';
import { ReportSezioniPage } from '@/features/admin/report/ReportSezioniPage';
import { EditorHomePage } from '@/features/editor/EditorHomePage';
import { SezioniPickPage } from '@/features/editor/SezioniPickPage';
import { VoteEntryPage } from '@/features/editor/VoteEntryPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { LivePage } from '@/features/live/LivePage';

export function AppRouter() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<HomePublicPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/pubblico/elezioni/:elezioneId"
        element={<DashboardPublicaPage />}
      />

      {/* Authenticated app */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<HomePage />} />
        <Route
          path="admin"
          element={
            <ProtectedRoute allow={['admin']}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminIndexPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="giornate" element={<GiornateListPage />} />
          <Route path="giornate/:id" element={<GiornataDetailPage />} />
          <Route path="sezioni" element={<SezioniImportPage />} />
          <Route path="presunti" element={<PresuntiIndexPage />} />
          <Route path="presunti/candidato/:candidatoId" element={<PresuntoCandidatoPage />} />
          <Route path="presunti/sezione/:sezioneId" element={<PresuntoSezionePage />} />
          <Route path="confronto" element={<ConfrontoPage />} />
          <Route path="confronto/candidato/:candidatoId" element={<CandidatoDrillDown />} />
          <Route path="confronto/sezione/:sezioneId" element={<SezioneDrillDown />} />
          <Route path="proiezioni" element={<ProiezioniPage />} />
          <Route path="report-sezioni" element={<ReportSezioniPage />} />
          <Route path="audit" element={<AuditLogPage />} />
        </Route>
        <Route
          path="editor"
          element={
            <ProtectedRoute allow={['admin', 'editor']}>
              <Outlet />
            </ProtectedRoute>
          }
        >
          <Route index element={<EditorHomePage />} />
          <Route path="giornate/:giornataId" element={<SezioniPickPage />} />
          <Route
            path="giornate/:giornataId/sezioni/:sezioneId"
            element={<VoteEntryPage />}
          />
        </Route>
        <Route path="live" element={<LivePage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* Redirect compat per vecchi bookmark/share */}
      <Route path="/admin/*" element={<Navigate to="/app/admin" replace />} />
      <Route path="/editor/*" element={<Navigate to="/app/editor" replace />} />
      <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />
      <Route path="/live" element={<Navigate to="/app/live" replace />} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
