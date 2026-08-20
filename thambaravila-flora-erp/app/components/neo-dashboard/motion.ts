const spring = {
  type: 'spring' as const,
  stiffness: 120,
  damping: 18,
};

export const dashboardShellVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      when: 'beforeChildren',
      staggerChildren: 0.08,
      delayChildren: 0.08,
    },
  },
};

export const sidebarVariants = {
  hidden: { x: -28, opacity: 0 },
  show: {
    x: 0,
    opacity: 1,
    transition: { ...spring, stiffness: 110 },
  },
};

export const headerVariants = {
  hidden: { y: -14, opacity: 0 },
  show: {
    y: 0,
    opacity: 1,
    transition: spring,
  },
};

export const widgetVariants = {
  hidden: { y: 26, opacity: 0 },
  show: {
    y: 0,
    opacity: 1,
    transition: { ...spring, stiffness: 130 },
  },
};

export const listItemVariants = {
  hover: { scale: 1.02, y: -1 },
  tap: { scale: 0.99 },
};

export const hoverLift = {
  whileHover: { scale: 1.02, y: -2 },
  whileTap: { scale: 0.985 },
  transition: { type: 'spring' as const, stiffness: 360, damping: 26 },
};

export const themeSwitchVariants = {
  dark: { x: 0 },
  light: { x: 22 },
};
