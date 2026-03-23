import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { config } from './config'
import { handleError } from './lib/http'
import { authRoutes } from './routes/auth'
import { userRoutes } from './routes/users'
import { waybillRoutes } from './routes/waybills'
import { reportRoutes } from './routes/reports'
import { clientRoutes } from './routes/clients'
import { invoiceRoutes } from './routes/invoices'
import { notificationRoutes } from './routes/notifications'
import { shiftRoutes } from './routes/shifts'
import type { AppVariables } from './lib/auth'

const app = new Hono<{ Variables: AppVariables }>()

app.use('*', logger())
app.onError(handleError)
app.use(
  '*',
  cors({
    origin: (requestOrigin) => {
      if (!requestOrigin) {
        return config.appOrigin
      }

      return config.allowedAppOrigins.includes(requestOrigin)
        ? requestOrigin
        : config.appOrigin
    },
    credentials: true,
  }),
)

app.get('/health', (c) => c.json({ ok: true }))
app.route('/auth', authRoutes)
app.route('/users', userRoutes)
app.route('/waybills', waybillRoutes)
app.route('/clients', clientRoutes)
app.route('/invoices', invoiceRoutes)
app.route('/notifications', notificationRoutes)
app.route('/reports', reportRoutes)
app.route('/shifts', shiftRoutes)

if (import.meta.main) {
  Bun.serve({
    port: config.apiPort,
    fetch: app.fetch,
  })

  console.log(`waybill backend listening on http://localhost:${config.apiPort}`)
}

export default app
