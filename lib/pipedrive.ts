/**
 * Pipedrive webhook payload checks shared by the webhook route and its tests.
 *
 * Pipedrive only enforces required-field rules in its own UI. Deals marked
 * Won by an automation, the API, or an AI assistant skip those rules, so the
 * webhook checks the payload itself and alerts the team when anything is blank.
 */

/** Payload keys the Pipedrive automation sends, with the label used in alerts. */
export const DEAL_FIELDS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'deal_title', label: 'Deal Title' },
  { key: 'pipedrive_deal_id', label: 'Pipedrive Deal ID' },
  { key: 'contact_name', label: 'Contact Name' },
  { key: 'contact_email', label: 'Contact Email' },
  { key: 'contact_phone', label: 'Contact Phone' },
  { key: 'event_date', label: 'Event Date' },
  { key: 'coconut_qty', label: 'Coconut Quantity' },
]

/** Labels of every expected field that is absent, blank, or whitespace-only. */
export function findMissingDealFields(payload: Record<string, unknown>): string[] {
  return DEAL_FIELDS.filter(({ key }) => {
    const value = payload[key]
    return typeof value !== 'string' || value.trim() === ''
  }).map(({ label }) => label)
}
