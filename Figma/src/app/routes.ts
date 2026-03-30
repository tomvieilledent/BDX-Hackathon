import { createBrowserRouter } from 'react-router';
import { Layout } from './components/Layout';
import StatusPage from './pages/StatusPage';
import AlertsPage from './pages/AlertsPage';
import ConsignesPage from './pages/ConsignesPage';
import ChecklistPage from './pages/ChecklistPage';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: StatusPage },
      { path: 'alertes', Component: AlertsPage },
      { path: 'consignes', Component: ConsignesPage },
      { path: 'checklist', Component: ChecklistPage },
    ],
  },
]);
