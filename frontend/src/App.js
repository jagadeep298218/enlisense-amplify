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
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
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
          {/* Public Route - Login */}
          <Route 
            path="/login" 
            element={<Login onLoginSuccess={handleLoginSuccess} />} 
          />
          
          {/* Default Route */}
          <Route 
            path="/" 
            element={
              !isAuthenticated ? (
                <Navigate to="/login" replace />
              ) : (
                <Layout>
                  <Dashboard />
                </Layout>
              )
            } 
          />
          
          {/* Protected Routes - All require authentication and Layout */}
          <Route 
            path="/users" 
            element={
              <ProtectedRoute>
                <Layout>
                  <FileTracker />
                </Layout>
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/user-versions/:username" 
            element={
              <ProtectedRoute>
                <Layout>
                  <UserVersions />
                </Layout>
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/user-versions/:username/version/:versionId" 
            element={
              <ProtectedRoute>
                <Layout>
                  <UserVersions />
                </Layout>
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/agp-report/:username" 
            element={
              <ProtectedRoute>
                <Layout>
                  <AGPReport />
                </Layout>
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/agp-comparison/:username1/:username2/:biomarkerType" 
            element={
              <ProtectedRoute>
                <Layout>
                  <AGPComparison />
                </Layout>
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/admin/biomarker-config" 
            element={
              <ProtectedRoute>
                <Layout>
                  <BiomarkerConfig />
                </Layout>
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/population-analysis" 
            element={
              <ProtectedRoute>
                <Layout>
                  <PopulationAnalysis />
                </Layout>
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/admin/paid-users" 
            element={
              <ProtectedRoute>
                <Layout>
                  <PaidUserManagement />
                </Layout>
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/demographic-filter" 
            element={
              <ProtectedRoute>
                <Layout>
                  <DemographicFilter />
                </Layout>
              </ProtectedRoute>
            } 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
