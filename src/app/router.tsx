import { Routes, Route, Outlet } from 'react-router-dom';
import { LoginPage } from '@/features/auth/LoginPage';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { HomePage } from '@/pages/HomePage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { AdminLayout } from '@/features/admin/AdminLayout';
import { AdminIndexPage } from '@/features/admin/AdminIndexPage';
import { UsersPage } from '@/features/admin/users/UsersPage';
import { GiornateListPage } from '@/features/admin/giornate/GiornateListPage';
import { GiornataDetailPage } from '@/features/admin/giornate/GiornataDetailPage';
import { SezioniImportPage } from '@/features/admin/sezioni/SezioniImportPage';
import { AuditLogPage } from '@/features/admin/audit/AuditLogPage';
import { EditorHomePage } from '@/features/editor/EditorHomePage';
import { SezioniPickPage } from '@/features/editor/SezioniPickPage';
import { VoteEntryPage } from '@/features/editor/VoteEntryPage';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
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
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
