import React, { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';

function Register() {
  const [formData, setFormData] = useState({ username: '', password: '', role: 'job_seeker' });
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://127.0.0.1:8000/register', formData);
      setMessage('Registration successful! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Registration failed.');
    }
  };

  return (
    <div className="App">
      <h1>Register for CvAlign</h1>
      <form onSubmit={handleSubmit} className="form">
        <div>
          <label className="form-label">Username:</label>
          <input
            type="text"
            name="username"
            value={formData.username}
            onChange={handleChange}
            required
            className="form-input"
          />
        </div>
        <div>
          <label className="form-label">Password:</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            className="form-input"
          />
        </div>
        <div>
          <label className="form-label">Role:</label>
          <select
            name="role"
            value={formData.role}
            onChange={handleChange}
            required
            className="form-input"
          >
            <option value="job_seeker">Job Seeker</option>
            <option value="recruiter">Recruiter</option>
            <option value="hiring_manager">Hiring Manager</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button type="submit" className="form-button">Register</button>
      </form>
      {message && <p className="form-message">{message}</p>}
      <p>
        Already have an account? <Link to="/login" className="modal-link">Login here</Link>
      </p>
    </div>
  );
}

export default Register;