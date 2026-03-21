import {
  Navigate,
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { useAuth } from './auth/AuthProvider'
import { defaultRouteForRole } from './lib/utils'
import { LoginPage } from './pages/LoginPage'
import { ClientsPage } from './pages/ClientsPage'
import { InvoicesPage } from './pages/InvoicesPage'
import {
  CreateWaybillPage,
  OpsWaybillDetailPage,
  OpsWaybillListPage,
  RiderJobsPage,
  RiderWaybillDetailPage,
} from './pages/WaybillPages'
import { AdminUsersPage } from './pages/AdminPages'
import { ReportsPage } from './pages/ReportsPage'
import './styles.css'

function RootLayout() {
  return (
    <>
      <Outlet />
      {import.meta.env.DEV ? <TanStackRouterDevtools position="bottom-right" /> : null}
    </>
  )
}

function HomePage() {
  const auth = useAuth()

  if (auth.loading) {
    return (
      <div className="min-h-screen bg-slate-100 px-6 py-20 text-center text-slate-500">
        Loading workspace...
      </div>
    )
  }

  if (!auth.user) {
    return <Navigate to="/login" />
  }

  return <Navigate to={defaultRouteForRole(auth.user.role)} />
}

const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: () => (
    <div className="min-h-screen bg-slate-100 px-6 py-20 text-center text-slate-600">
      Page not found.
    </div>
  ),
})

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
})

const opsWaybillsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ops/waybills',
  component: OpsWaybillListPage,
})

const riderCreateWaybillRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/rider/jobs/new',
  component: CreateWaybillPage,
})

const opsWaybillDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ops/waybills/$waybillId',
  component: function OpsWaybillDetailRoute() {
    const { waybillId } = opsWaybillDetailRoute.useParams()
    return <OpsWaybillDetailPage waybillId={waybillId} />
  },
})

const riderJobsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/rider/jobs',
  component: RiderJobsPage,
})

const riderWaybillDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/rider/jobs/$waybillId',
  component: function RiderWaybillDetailRoute() {
    const { waybillId } = riderWaybillDetailRoute.useParams()
    return <RiderWaybillDetailPage waybillId={waybillId} />
  },
})

const reportRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ops/reports',
  component: ReportsPage,
})

const clientsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ops/clients',
  component: ClientsPage,
})

const opsRidersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ops/riders',
  component: function OpsRidersRoute() {
    return <AdminUsersPage filterRole="rider" />
  },
})

const invoicesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ops/invoices',
  component: InvoicesPage,
})

const adminUsersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/users',
  component: function AdminUsersRoute() {
    return <AdminUsersPage />
  },
})

const adminRidersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/riders',
  component: function AdminRidersRoute() {
    return <AdminUsersPage filterRole="rider" />
  },
})

const routeTree = rootRoute.addChildren([
  homeRoute,
  loginRoute,
  opsWaybillsRoute,
  opsWaybillDetailRoute,
  riderJobsRoute,
  riderCreateWaybillRoute,
  riderWaybillDetailRoute,
  reportRoute,
  opsRidersRoute,
  clientsRoute,
  invoicesRoute,
  adminUsersRoute,
  adminRidersRoute,
])

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
