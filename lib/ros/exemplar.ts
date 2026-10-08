import type { RosDocument } from './types'

/**
 * The LJBTC End of Summer Luau drop-off ROS (Oct 9, 2026), the structural
 * template. Transcribed from docs/ros/reference/template-ljbtc-2026-10-09.docx.
 */
export const LJBTC_EXEMPLAR: RosDocument = {
  header: {
    clientName: 'La Jolla Beach & Tennis Club',
    eventName: 'End of Summer Luau',
    subtitle: 'LJBTC | End of Summer Luau Drop-Off',
  },
  info: [
    { label: 'Date', value: 'Friday, October 9, 2026' },
    { label: 'Delivery Time', value: '2:00 PM (service 3:00 PM – 5:00 PM, run by LJBTC)' },
    { label: 'Location', value: 'La Jolla Beach & Tennis Club, 2000 Spindrift Dr, La Jolla, CA 92037' },
    { label: 'Service Spot', value: 'Drop-off only' },
    { label: 'Day-Of Contact', value: 'Ilona Ermolova 858-551-4654' },
    { label: 'Total Coconuts', value: '100' },
    { label: 'Garnish', value: 'Umbrellas' },
  ],
  stampBox: ['Brand Stamp Logo', '[Logo TBD]', 'Requested from Trina 10/3'],
  entrance:
    'Please call event contact to inform them of your ETA. Park between the two hotel properties, outside the Beach Club near the kayak loading area, and wheel everything through the side entry gate. LJBTC will have someone there to open the gate. If that route is tough, unload at the Spindrift Pavilion area and walk items over.',
  callout: 'FRONT DESK WILL DIRECT YOU WHERE TO GO AS WELL',
  changes: null,
  days: [
    {
      heading: 'EVENT DAY — FRIDAY, OCTOBER 9',
      blocks: [
        {
          time: '12:45 PM',
          title: 'Warehouse Pickup',
          bullets: [
            'Load 100 coconuts, umbrellas, straws, napkins, coconut water and supplies listed below',
            'Warehouse: 9040 Kenamar Dr, Unit 403, San Diego',
          ],
        },
        {
          time: '1:30 PM',
          title: 'Arrive & Load In',
          bullets: [
            'Park near the kayak loading area and call the day-of contact for the side gate',
            'Backup: unload at Spindrift Pavilion and walk items over',
            'Last time (Aug 12) vendors checked in at the Ambassador booth. Overflow parking was the Marine Room Extended Lot, 1950 Spindrift Dr',
          ],
        },
        {
          time: '2:00 PM',
          title: 'Delivery & Handoff',
          bullets: [
            'Coconuts delivered by 2:00 PM, this is the time LJBTC asked for',
            'Hand off coconuts, garnish, and service items to LJBTC staff',
            'Walk them through how to open and serve the whole coconuts',
            'Grab photos for socials before leaving',
          ],
        },
        { time: '2:15 PM', title: 'Depart', bullets: ['Drop-off only, no Windansea staff during service'] },
        {
          time: 'Post Event',
          title: '',
          bullets: ['Add hours to the 2026 Timesheet', 'Confirm final payment received, follow up on invoice if not'],
        },
      ],
    },
  ],
  setTimes: null,
  breakdown: [
    { item: 'Total coconuts', detail: '100' },
    { item: 'Opened by start of service', detail: '100 cup-opened with coconut water on side' },
    { item: 'Garnish', detail: 'Umbrellas' },
    { item: 'Package', detail: 'Sandcastle' },
    { item: 'Certifications', detail: 'COI required' },
  ],
  supplies: [
    {
      heading: 'Delivery',
      bullets: [
        '1x foldable dolly for the walk through the side gate',
        'Coconut water in jugs',
        'Umbrella garnish, pack 100 (don’t count this out, just throw a bunch in a bag)',
        'Straws, pack 1x of the large packs',
        'Napkins, pack 100+',
        'Medium food handling gloves',
      ],
    },
  ],
  contacts: [
    { label: 'Event Manager', value: 'Trina Ngo, LJBTC, 858-551-4666, TNgo@ljbtc.com' },
    { label: 'Sales Coordinator', value: 'Ilona Ermolova, LJBTC, 858-551-4654, IErmolova@ljbtc.com' },
    { label: 'Client Team', value: 'Avery Huber, LJBTC, AHuber@ljbtc.com' },
    { label: 'Windansea', value: 'Trent LiVolsi, 732-575-5774' },
  ],
  openItems: ['Stamp logo file from Trina'],
}
