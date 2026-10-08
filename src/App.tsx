import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { Link, RouterProvider, useRouteError, type RouteObject } from 'react-router'
import { TicketDrawer } from './components/TicketDrawer'
import { ExplorerPage } from './pages/ExplorerPage'

function RouteError() {
  const error = useRouteError()
  console.error(error)
  return (
    <main className="page state">
      <h1>Something broke</h1>
      <p>An unexpected error occurred while rendering this page.</p>
      <a className="button" href="/">
        Reload the explorer
      </a>
    </main>
  )
}

function NotFound() {
  return (
    <main className="page state">
      <h1>Page not found</h1>
      <Link className="button" to="/">
        Go to the ticket list
      </Link>
    </main>
  )
}

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <ExplorerPage />,
    errorElement: <RouteError />,
    children: [{ path: 'tickets/:id', element: <TicketDrawer /> }],
  },
  { path: '*', element: <NotFound /> },
]

export function App({ router, queryClient }: { router: Parameters<typeof RouterProvider>[0]['router']; queryClient: QueryClient }) {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
