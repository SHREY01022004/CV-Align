import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import JobDescription from './components/JobDescription';
import JobOpenings from './components/JobOpenings';
import Dashboard from './components/Dashboard';
import './App.css';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [role, setRole] = useState('');

  useEffect(() => {
    if (token) {
      // Decode the JWT token to get the role
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setRole(payload.role);
      } catch (e) {
        console.error('Error decoding token:', e);
        setRole('');
        setToken('');
        localStorage.removeItem('token');
      }
    }
  }, [token]);

  const handleLogin = (newToken) => {
    setToken(newToken);
    localStorage.setItem('token', newToken);
  };

  const handleLogout = () => {
    setToken('');
    setRole('');
    localStorage.removeItem('token');
  };

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/job-description"
          element={
            token && (role === 'recruiter' || role === 'hiring_manager' || role === 'admin') ? (
              <JobDescription token={token} onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/job-openings"
          element={
            token && (role === 'job_seeker' || role === 'admin') ? (
              <JobOpenings token={token} onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/dashboard"
          element={
            token && (role === 'recruiter' || role === 'admin') ? (
              <Dashboard token={token} onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/"
          element={
            token ? (
              role === 'job_seeker' ? (
                <Navigate to="/job-openings" />
              ) : role === 'admin' ? (
                <Navigate to="/dashboard" />
              ) : (
                <Navigate to="/dashboard" />
              )
            ) : (
              <Navigate to="/login" />
            )
          }
        />
      </Routes>
    </Router>
  );
}

export default App;