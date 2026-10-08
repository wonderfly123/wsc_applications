/**
 * Fixed Windansea facts the ROS writer may use without them appearing in the
 * event inputs. Anything NOT here and not in the inputs is an open item.
 */
export const HOUSE_STYLE = {
  companyName: 'Windansea Coconuts',
  warehouseAddress: '9040 Kenamar Dr, Unit 403, San Diego',
  windanseaContact: 'Trent LiVolsi, 732-575-5774',
  postEventSteps: [
    'Add hours to the 2026 Timesheet',
    'Confirm final payment received, follow up on invoice if not',
  ],
  packages: {
    Sandcastle: 'Delivery only: custom branded coconuts, prepped and hand-delivered. No Windansea staff during service.',
    Cabana: 'Delivery plus live service: a coconut specialist serves guests from a styled service cart.',
    Villa: 'Top tier: delivery, live service, and premium brand activation with tailored presentation.',
  },
  /** Standard packing list by category. The writer trims to what the event needs. */
  packingList: {
    'Coconuts & Service': [
      'Coconuts (stamped if a brand stamp applies)',
      'Garnish',
      'Straws',
      'Napkins',
      'Sporks or spoons (cut-open style)',
      'Coconut water in jugs (pre-opened orders)',
    ],
    Tools: [
      'Coconut openers and mallets',
      'Knives and wooden cutting board',
      'Opening station',
      'Scraper',
      'Coolers and ice',
      'Drain buckets and strainers',
    ],
    'Display & Setup': [
      'Cart with Windansea decal',
      'Umbrella',
      'Windansea signage',
      'Client signage',
      'Table if client is not providing a bar',
      'Weights or stakes to anchor on grass or wind',
    ],
    'Cleaning & Safety': [
      'Food-safe sanitizer spray',
      'Bar towels and paper towels',
      'Nitrile or food-handling gloves',
      'Floor mat or splash guard',
      'Heavy-duty trash bags',
      'Hand sanitizer pump',
      'First aid kit',
    ],
    Team: ['Aprons', 'Government photo ID when credentials are required'],
    Delivery: ['Foldable dolly'],
  },
  /** Rules repeated in every prompt. */
  rules: [
    'Never invent a fact. If it is not in the inputs or the house style, put it in openItems instead of the body.',
    'Times are Pacific. Write times like "2:00 PM". Write phone numbers like 858-551-4654.',
    'Keep the tone direct and operational, written for the crew on the day.',
    'Day headings are all caps: "EVENT DAY — FRIDAY, OCTOBER 9". Multi-day events get one heading per day plus a load-out day when strike is separate.',
    'Each block has a time label and a short title; bullets are complete instructions, no trailing periods.',
    'The breakdown table always includes Total coconuts, Opened by start of service, Garnish, Package, and Certifications.',
    'Contacts always end with the Windansea line from the house style.',
    'Post-event block always includes the house-style post-event steps.',
    'In UPDATE mode, keep the existing wording and any content that is not contradicted by new inputs, and list every change in changes.',
  ],
} as const
