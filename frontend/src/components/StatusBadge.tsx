// StatusBadge maps status strings to appropriate badge classes
const STATUS_MAP: Record<string, string> = {
  // Visit
  'Scheduled':        'badge-gray',
  'Checked In':       'badge-blue',
  'Waiting':          'badge-yellow',
  'In Consultation':  'badge-purple',
  'Completed':        'badge-green',
  // Order
  'Ordered':          'badge-blue',
  'Assigned':         'badge-yellow',
  'In Progress':      'badge-orange',
  'Cancelled':        'badge-red',
  'Partially Completed': 'badge-yellow',
  // Sample
  'Awaiting Collection': 'badge-gray',
  'Collected':        'badge-blue',
  'Received':         'badge-yellow',
  'Accepted':         'badge-yellow',
  'Processing':       'badge-orange',
  'Processed':        'badge-green',
  'Rejected':         'badge-red',
  'Recollection Requested': 'badge-red',
  // Result
  'Awaiting Result':  'badge-gray',
  'Pending Review':   'badge-yellow',
  'Approved/Released': 'badge-green',
  'Held':             'badge-red',
  'Rerun Requested':  'badge-orange',
  // Priority
  'Routine':          'badge-gray',
  'Urgent':           'badge-orange',
  'STAT':             'badge-red',
}

export const StatusBadge = ({ status }: { status: string }) => {
  const cls = STATUS_MAP[status] ?? 'badge-gray'
  return <span className={cls}>{status}</span>
}

export const FlagBadge = ({ flag }: { flag?: string | null }) => {
  if (!flag) return null
  const isCritical = flag.includes('HH') || flag.includes('LL')
  return (
    <span className={isCritical ? 'badge-red font-bold' : 'badge-yellow'}>
      {isCritical && '⚠ '}
      {flag}
    </span>
  )
}
