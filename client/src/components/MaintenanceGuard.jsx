import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import api from '../services/api';
import { setMaintenanceMode } from '../redux/slices/settingsSlice';

export default function MaintenanceGuard({ children }) {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const maintenance = useSelector((state) => state.settings?.maintenanceMode);
  const isEffectiveActive = useSelector((state) => state.settings?.isEffectiveActive);
  const lastChecked = useSelector((state) => state.settings?.lastChecked);

  const [hasVerified, setHasVerified] = useState(!!lastChecked);

  // Parse counter user if present in local storage
  let currentRole = user?.role;
  if (!currentRole) {
    try {
      const counterData = localStorage.getItem('counterUser');
      if (counterData) {
        const parsed = JSON.parse(counterData);
        if (parsed.role) currentRole = parsed.role;
      }
    } catch (e) {}
  }

  // 1. ADMIN is NEVER blocked by maintenance mode
  if (currentRole === 'admin') {
    return children;
  }

  // 2. Fetch fresh status if not checked yet (e.g. direct URL navigation or refresh)
  useEffect(() => {
    if (!lastChecked) {
      let isMounted = true;
      api
        .get('/settings/maintenance')
        .then(({ data }) => {
          if (isMounted && (data?.maintenanceMode || data?.isEffectiveActive !== undefined)) {
            dispatch(setMaintenanceMode(data));
            setHasVerified(true);
          }
        })
        .catch((err) => {
          console.error('Error verifying maintenance status in guard:', err);
          if (isMounted) setHasVerified(true);
        });

      return () => {
        isMounted = false;
      };
    } else {
      setHasVerified(true);
    }
  }, [lastChecked, dispatch]);

  // 3. While checking status on cold load, show quick seamless placeholder
  if (!hasVerified && !lastChecked) {
    return null;
  }

  // 4. If maintenance is active (manual or scheduled) and role is STAFF, COUNTER, or CONSUMER, redirect to /maintenance
  const isMaintenanceActive = Boolean(
    isEffectiveActive ||
    maintenance?.isEffectiveActive ||
    maintenance?.effectiveEnabled ||
    maintenance?.enabled
  );

  if (isMaintenanceActive) {
    return <Navigate to="/maintenance" replace />;
  }

  // 5. Normal access
  return children;
}
