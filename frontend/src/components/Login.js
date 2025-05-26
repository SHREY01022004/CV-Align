import React, { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';

function Login({ onLogin }) {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://127.0.0.1:8000/login', new URLSearchParams({
        username: formData.username,
        password: formData.password,
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      const token = response.data.access_token;
      onLogin(token);
      setMessage('Login successful!');
      // Decode token to get role and redirect accordingly
      const payload = JSON.parse(atob(token.split('.')[1]));
      const role = payload.role;
      if (role === 'job_seeker') {
        navigate('/job-openings');
      } else if (role === 'recruiter' || role === 'admin') {
        navigate('/dashboard');
      } else {
        navigate('/job-description');
      }
    } catch (error) {
      setMessage('Login failed. Check your credentials.');
      console.error(error.response?.data);
    }
  };

  return (
    <div className="App">
      <h1>Login to CvAlign</h1>
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
        <button type="submit" className="form-button">Login</button>
      </form>
      {message && <p className="form-message">{message}</p>}
      <p>
        Don't have an account? <Link to="/register" className="modal-link">Register here</Link>
      </p>
    </div>
  );
}

export default Login;