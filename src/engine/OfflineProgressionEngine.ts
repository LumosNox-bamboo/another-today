// Offline and live use the same fixed-step kernel and persisted random stream.
// At most 30 game days (8,640 ticks) are processed; older absence is a clearly reported rest period.
export { catchUp as progressOffline, type CatchUpReport } from './SimulationClock';
