import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useApp } from '../../hooks/useApp';

interface RoleBasedRouteProps {
  allowedRoles: string[];
  children?: React.ReactNode;
}

export const RoleBasedRoute: React.FC<RoleBasedRouteProps> = ({
  allowedRoles,
  children
}) => {
  const { currentUser } = useApp();
  const location = useLocation();

  // If no user, redirect to login
  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if user's role is in allowed roles
  if (!allowedRoles.includes(currentUser.role)) {
    // Redirect to appropriate dashboard based on role
    const redirectPath =
      currentUser.role === 'admin' ? '/admin' :
      ['pickup_staff', 'laundry_staff', 'delivery_staff'].includes(currentUser.role) ? '/staff' :
      '/dashboard';

    return <Navigate to={redirectPath} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

// Specific route components for convenience
interface RoleRouteWrapperProps {
  children?: React.ReactNode;
}

export const CustomerRoute: React.FC<RoleRouteWrapperProps> = ({ children }) => (
  <RoleBasedRoute allowedRoles={['customer']}>{children}</RoleBasedRoute>
);

export const StaffRoute: React.FC<RoleRouteWrapperProps> = ({ children }) => (
  <RoleBasedRoute allowedRoles={['pickup_staff', 'laundry_staff', 'delivery_staff']}>{children}</RoleBasedRoute>
);

export const AdminRoute: React.FC<RoleRouteWrapperProps> = ({ children }) => (
  <RoleBasedRoute allowedRoles={['admin']}>{children}</RoleBasedRoute>
);

export const AuthenticatedRoute: React.FC<RoleRouteWrapperProps> = ({ children }) => (
  <RoleBasedRoute allowedRoles={['customer', 'admin', 'pickup_staff', 'laundry_staff', 'delivery_staff']}>
    {children}
  </RoleBasedRoute>
);