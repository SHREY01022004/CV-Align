import React, { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';

function JobDescription({ token, onLogout }) {
  const [formData, setFormData] = useState({
    jobTitle: '',
    skills: '',
    experience: '',
    traits: '',
  });
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  // Decode token to get role
  const role = token ? JSON.parse(atob(token.split('.')[1])).role : '';

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(
        'http://127.0.0.1:8000/api/job-description',
        formData,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setMessage(response.data.message);
      setFormData({ jobTitle: '', skills: '', experience: '', traits: '' });
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Error saving job description.');
    }
  };

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  return (
    <div className="App">
      <h1>Create Job Description</h1>
      <nav className="nav">
        <Link to="/job-description" className="nav-link">Job Description</Link>
        <Link to="/dashboard" className="nav-link">Dashboard</Link>
        {role === 'admin' && (
          <Link to="/job-openings" className="nav-link">Job Openings</Link>
        )}
        <button onClick={handleLogout} className="logout-button">Logout</button>
      </nav>

      {message && <p className="form-message">{message}</p>}

      <form onSubmit={handleSubmit} className="form">
        <div>
          <label className="form-label">Job Title:</label>
          <input
            type="text"
            name="jobTitle"
            value={formData.jobTitle}
            onChange={handleChange}
            required
            className="form-input"
          />
        </div>
        <div>
          <label className="form-label">Required Skills:</label>
          <input
            type="text"
            name="skills"
            value={formData.skills}
            onChange={handleChange}
            required
            className="form-input"
            placeholder="e.g., Python, JavaScript, leadership"
          />
        </div>
        <div>
          <label className="form-label">Preferred Experience:</label>
          <input
            type="text"
            name="experience"
            value={formData.experience}
            onChange={handleChange}
            required
            className="form-input"
            placeholder="e.g., 2+ years, internship"
          />
        </div>
        <div>
          <label className="form-label">Desired Traits:</label>
          <input
            type="text"
            name="traits"
            value={formData.traits}
            onChange={handleChange}
            className="form-input"
            placeholder="e.g., proactive, team player"
          />
        </div>
        <button type="submit" className="form-button">Save Job Description</button>
      </form>
    </div>
  );
}

export default JobDescription;