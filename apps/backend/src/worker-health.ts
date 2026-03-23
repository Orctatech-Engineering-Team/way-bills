import { getInvoiceAutomationStatus } from './lib/automation-status'
import { evaluateInvoiceAutomationHealth } from './lib/automation-health'

const status = await getInvoiceAutomationStatus()
const health = evaluateInvoiceAutomationHealth(status)

if (!health.healthy) {
  console.error(`[worker-health] ${health.reason}`)
  process.exit(1)
}

console.log(`[worker-health] ${health.reason}`)
