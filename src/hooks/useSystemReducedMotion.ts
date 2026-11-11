/**
 * The one reduced-motion source is `src/ui/system/motion.ts`: a store the root layout seeds with the launch value and
 * keeps current from the accessibility change event and every return to the foreground. This name stays so the
 * screens that already read it keep reading the same answer as everything else.
 */
export { useReducedMotion as useSystemReducedMotion } from '../ui/system/motion';
