/**
 * FILE: App.js
 * PURPOSE: Main application component that handles routing, authentication, and application-wide state
 * DESCRIPTION: This is the root component of the EnLiSense Dashboard application. It manages user authentication,
 *              route protection, and provides the main navigation structure for the entire application.
 * 
 * FEATURES:
 * - Authentication state management
 * - Protected route system
 * - Client-side routing with React Router
 * - Persistent login state using localStorage
 * 
 * ERROR HANDLING:
 * - [CRITICAL] Token expiration not handled - Users may get stuck if token expires
 *   FIX: Add token validation and automatic logout on 401 errors
 * - [WARNING] No error boundary - Unhandled errors will crash the entire app
 *   FIX: Implement React Error Boundary component
 * - [WARNING] localStorage access without try-catch - May fail in private browsing
 *   FIX: Wrap localStorage calls in try-catch blocks
 */

import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

// Component imports - organized by functionality
import Login from './components/Login';
import FileTracker from './components/FileTracker';
import UserVersions from './components/UserVersions';
import AGPReport from './components/AGPReport';
import AGPComparison from './components/AGPComparison';
import BiomarkerConfig from './components/BiomarkerConfig';
import PopulationAnalysis from './components/PopulationAnalysis';
import PaidUserManagement from './components/PaidUserManagement';
import DemographicFilter from './components/DemographicFilter';

/**
 * COMPONENT: App
 * PURPOSE: Root application component managing authentication and routing
 * 
 * STATE:
 * - isAuthenticated: Boolean indicating if user is logged in
 * 
 * LIFECYCLE:
 * 1. Mount: Check localStorage for existing authentication token
 * 2. Render: Provide route-based navigation with authentication guards
 * 
 * ERROR PRONE AREAS:
 * - localStorage access (private browsing, storage quota)
 * - Token validation (expired tokens, malformed tokens)
 * - Route protection (authentication bypass attempts)
 */
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  /**
   * EFFECT: Authentication State Initialization
   * PURPOSE: Check for existing authentication token on app startup
   * DEPENDENCIES: [] (runs once on mount)
   * 
   * ERROR HANDLING NEEDED:
   * - [HIGH] localStorage may throw in private browsing mode
   * - [MEDIUM] Token format validation missing
   * - [LOW] Token expiration not checked
   */
  useEffect(() => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        // TODO: Add token validation/expiration check here
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Failed to access localStorage:', error);
      // Gracefully handle private browsing or localStorage issues
      setIsAuthenticated(false);
    }
  }, []);

  /**
   * FUNCTION: handleLoginSuccess
   * PURPOSE: Handle successful login and update authentication state
   * PARAMETERS: user - User object containing user information
   * 
   * ERROR HANDLING NEEDED:
   * - [LOW] User parameter validation missing
   */
  const handleLoginSuccess = (user) => {
    setIsAuthenticated(true);
    // Note: Token should already be stored by Login component
  };

  /**
   * COMPONENT: ProtectedRoute
   * PURPOSE: Wrapper component for routes that require authentication
   * OPTIMIZATION: Memoized to prevent unnecessary re-renders
   */
  const ProtectedRoute = useMemo(() => ({ children }) => {
    return isAuthenticated ? children : <Navigate to="/" replace />;
  }, [isAuthenticated]);

  return (
    <Router>
      <div className="App">       
        <Routes>
          {/* Public Route - Login/Dashboard */}
          <Route 
            path="/" 
            element={
              !isAuthenticated ? (
                <Login onLoginSuccess={handleLoginSuccess} />
              ) : (
                <FileTracker />
              )
            } 
          />
          
          {/* Protected Routes - All require authentication */}
          <Route 
            path="/user-versions/:username" 
            element={
              <ProtectedRoute>
                <UserVersions />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/user-versions/:username/version/:versionId" 
            element={
              <ProtectedRoute>
                <UserVersions />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/agp-report/:username" 
            element={
              <ProtectedRoute>
                <AGPReport />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/agp-comparison/:username1/:username2/:biomarkerType" 
            element={
              <ProtectedRoute>
                <AGPComparison />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/admin/biomarker-config" 
            element={
              <ProtectedRoute>
                <BiomarkerConfig />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/population-analysis" 
            element={
              <ProtectedRoute>
                <PopulationAnalysis />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/admin/paid-users" 
            element={
              <ProtectedRoute>
                <PaidUserManagement />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/demographic-filter" 
            element={
              <ProtectedRoute>
                <DemographicFilter />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
