type PricingTier = 'standard' | 'overflow'

export type ClientPricing = {
  clientId: string
  standardDeliveryRateCents: number
  weeklyBandLimit: number | null
  overflowDeliveryRateCents: number | null
}

type DeliveryRecord = {
  id: string
  clientId: string | null
  completionTime: Date | null
}

export type DeliveryCharge = {
  deliveryChargeCents: number
  pricingTier: PricingTier
  weekStart: string
  weeklySequence: number
}

export function startOfBillingWeek(date: Date) {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )
  const day = start.getUTCDay()
  const offset = (day + 6) % 7
  start.setUTCDate(start.getUTCDate() - offset)
  start.setUTCHours(0, 0, 0, 0)
  return start
}

export function endOfBillingWeek(date: Date) {
  const end = startOfBillingWeek(date)
  end.setUTCDate(end.getUTCDate() + 7)
  end.setUTCMilliseconds(-1)
  return end
}

function weekKey(date: Date) {
  return startOfBillingWeek(date).toISOString().slice(0, 10)
}

export function calculateDeliveryCharges(
  deliveries: DeliveryRecord[],
  pricingByClientId: Map<string, ClientPricing>,
) {
  const byClientWeek = new Map<string, DeliveryRecord[]>()

  for (const delivery of deliveries) {
    if (!delivery.clientId || !delivery.completionTime) {
      continue
    }

    const key = `${delivery.clientId}:${weekKey(delivery.completionTime)}`
    const bucket = byClientWeek.get(key) ?? []
    bucket.push(delivery)
    byClientWeek.set(key, bucket)
  }

  const charges = new Map<string, DeliveryCharge>()

  for (const [key, bucket] of byClientWeek.entries()) {
    const [clientId, weekStart] = key.split(':')
    const pricing = pricingByClientId.get(clientId)

    if (!pricing) {
      continue
    }

    bucket.sort((left, right) => {
      const leftTime = left.completionTime?.getTime() ?? 0
      const rightTime = right.completionTime?.getTime() ?? 0

      if (leftTime !== rightTime) {
        return leftTime - rightTime
      }

      return left.id.localeCompare(right.id)
    })

    for (let index = 0; index < bucket.length; index += 1) {
      const delivery = bucket[index]
      const weeklySequence = index + 1
      const overflowApplies =
        pricing.weeklyBandLimit !== null &&
        pricing.weeklyBandLimit > 0 &&
        weeklySequence > pricing.weeklyBandLimit
      const pricingTier: PricingTier = overflowApplies ? 'overflow' : 'standard'

      charges.set(delivery.id, {
        deliveryChargeCents: overflowApplies
          ? pricing.overflowDeliveryRateCents ?? pricing.standardDeliveryRateCents
          : pricing.standardDeliveryRateCents,
        pricingTier,
        weekStart,
        weeklySequence,
      })
    }
  }

  return charges
}
