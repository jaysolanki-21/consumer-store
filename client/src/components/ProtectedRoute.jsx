import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

export default function ProtectedRoute({ children, roles = [] }) {
  const { user, token } = useSelector(state => state.auth);

  // Authoritative check: Redux state with synchronous localStorage fallback
  let currentUser = user;
  let currentToken = token;

  if (!currentUser || !currentToken) {
    const storedToken = localStorage.getItem('token') || localStorage.getItem('counterToken');
    const storedUserStr = localStorage.getItem('user') || localStorage.getItem('counterUser');
    if (storedToken && storedUserStr) {
      try {
        currentUser = JSON.parse(storedUserStr);
        currentToken = storedToken;
      } catch (e) {}
    }
  }

  const isAuthenticated = !!currentToken && !!currentUser;

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If roles specified and user's role not in allowed roles
  if (roles.length > 0 && !roles.includes(currentUser.role)) {
    // Redirect based on user's actual role
    if (currentUser.role === 'admin') {
      return <Navigate to="/admin" replace />;
    } else if (currentUser.role === 'staff') {
      return <Navigate to="/staff" replace />;
    } else if (currentUser.role === 'counter') {
      return <Navigate to="/consumer" replace />;
    }
    // Fallback to login if role is unknown
    return <Navigate to="/login" replace />;
  }

  return children;
}
