import { motion } from 'framer-motion';

export default function MaintenanceAnimation() {
  return (
    <div className="relative w-48 h-48 sm:w-56 sm:h-56 mx-auto flex items-center justify-center">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/10 via-indigo-500/10 to-transparent rounded-full blur-2xl" />

      {/* Outer subtle rotating circle */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 24, ease: 'linear' }}
        className="absolute w-44 h-44 sm:w-52 sm:h-52 rounded-full border border-dashed border-slate-300 dark:border-slate-700/60"
      />

      {/* Large Gear */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 12, ease: 'linear' }}
        className="absolute -top-1 -left-1 text-amber-500/80 dark:text-amber-400/90"
      >
        <svg
          width="76"
          height="76"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" />
          <path d="m19.07 4.93-1.41 1.41" />
          <circle cx="12" cy="12" r="5" fill="currentColor" fillOpacity="0.08" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      </motion.div>

      {/* Small Interlocking Gear */}
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}
        className="absolute top-10 right-4 text-indigo-500/80 dark:text-indigo-400/90"
      >
        <svg
          width="54"
          height="54"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" />
          <path d="m19.07 4.93-1.41 1.41" />
          <circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity="0.08" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      </motion.div>

      {/* Center POS & Tool Hub with pulsing shield */}
      <motion.div
        animate={{ scale: [1, 1.04, 1] }}
        transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
        className="relative z-10 w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-br from-white to-slate-100 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700/80 shadow-2xl flex items-center justify-center p-4"
      >
        <div className="relative flex items-center justify-center">
          {/* Pulse ring */}
          <span className="absolute w-12 h-12 rounded-full bg-amber-400/20 dark:bg-amber-400/10 animate-ping" />

          {/* Center Hardware / Tool Icon */}
          <svg
            className="w-12 h-12 sm:w-14 sm:h-14 text-slate-800 dark:text-slate-100"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Monitor / POS terminal */}
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
            {/* Wrench indicator on screen */}
            <path
              d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l1.3-1.3a4 4 0 0 1-5.6-5.6l-1.3 1.3a1 1 0 0 0 0 1.4z"
              fill="currentColor"
              fillOpacity="0.15"
            />
            <path d="M7 13l3.5-3.5" />
          </svg>
        </div>
      </motion.div>

      {/* Orbiting maintenance wrench badge */}
      <motion.div
        animate={{ y: [-4, 4, -4] }}
        transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
        className="absolute -bottom-2 right-8 z-20 px-3 py-1 rounded-full bg-amber-500 text-white text-xs font-semibold shadow-lg flex items-center gap-1.5"
      >
        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
        <span>POS Service</span>
      </motion.div>
    </div>
  );
}
