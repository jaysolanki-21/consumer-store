import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

export default function ProtectedRoute({ children, roles = [] }) {
  const { user, token } = useSelector(state => state.auth);
  
  // Check if user is authenticated (has token and user object)
  const isAuthenticated = !!token && !!user;
  
  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  // If roles specified and user's role not in allowed roles
  if (roles.length > 0 && !roles.includes(user.role)) {
    // Redirect based on user's actual role
    if (user.role === 'admin') {
      return <Navigate to="/admin" replace />;
    } else if (user.role === 'staff') {
      return <Navigate to="/staff" replace />;
    }
    // Fallback to home
    return <Navigate to="/" replace />;
  }
  
  return children;
}