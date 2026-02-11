import { IntegrationConfig } from './types'

export const INTEGRATIONS: IntegrationConfig[] = [
  {
    type: 'google_ads',
    label: 'Google Ads',
    description: 'Daily ad spend, impressions, clicks, and conversions from Google Ads campaigns.',
    icon: 'Search',
    color: 'blue',
    accountIdField: 'google_ads_customer_id',
  },
  {
    type: 'meta_ads',
    label: 'Meta Ads',
    description: 'Facebook and Instagram ad performance — spend, reach, clicks, and leads.',
    icon: 'Megaphone',
    color: 'indigo',
    accountIdField: 'meta_ad_account_id',
  },
  {
    type: 'call_tracking',
    label: 'Call Tracking (CTM)',
    description: 'Inbound and outbound calls — answered, missed, duration, and recordings.',
    icon: 'Phone',
    color: 'emerald',
    accountIdField: 'ctm_account_id',
  },
  {
    type: 'gbp',
    label: 'Google Business Profile',
    description: 'Reviews, ratings, search views, maps views, website clicks, and phone calls.',
    icon: 'MapPin',
    color: 'red',
    accountIdField: 'gbp_location_id',
  },
  {
    type: 'driveato',
    label: 'Driveato',
    description: 'Student enrollment, instructor assignments, vehicle fleet, and scheduling data.',
    icon: 'Car',
    color: 'amber',
    accountIdField: 'driveato_location_id',
  },
  {
    type: 'ghl',
    label: 'GoHighLevel',
    description: 'Lead pipeline stages, opportunity values, and contact activity.',
    icon: 'Workflow',
    color: 'purple',
    accountIdField: 'ghl_location_id',
  },
]
