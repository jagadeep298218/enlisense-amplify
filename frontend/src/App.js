import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import FileTracker from './components/FileTracker';
import UserVersions from './components/UserVersions';
import Login from './components/Login';
import AggregatedViolinPlots from './components/AggregatedViolinPlots';
import './components/FileTracker.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLoginSuccess = (user) => {
    setIsAuthenticated(true);
  };

  return (
    <Router>
      <div className="App">
        <Routes>
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
          <Route 
            path="/user-versions/:username" 
            element={
              isAuthenticated ? (
                <UserVersions />
              ) : (
                <Navigate to="/" replace />
              )
            } 
          />
          <Route 
            path="/user-versions/:username/version/:versionId" 
            element={
              isAuthenticated ? (
                <UserVersions />
              ) : (
                <Navigate to="/" replace />
              )
            } 
          />
          <Route 
            path="/aggregated-analysis" 
            element={
              isAuthenticated ? (
                <AggregatedViolinPlots />
              ) : (
                <Navigate to="/" replace />
              )
            } 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
